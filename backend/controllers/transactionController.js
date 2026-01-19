const Transaction = require("../models/Transaction");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const normalizeTransactionType = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();

  // Common synonyms from AI / human input
  if (
    ["income", "in", "revenue", "sale", "sales", "credit", "deposit"].includes(
      raw,
    )
  )
    return "income";
  if (
    [
      "expense",
      "exp",
      "cost",
      "debit",
      "withdrawal",
      "spend",
      "spending",
    ].includes(raw)
  )
    return "expense";
  if (["transfer", "xfer", "move"].includes(raw)) return "transfer";

  if (["income", "expense", "transfer"].includes(raw)) return raw;
  return undefined;
};

const normalizeStatus = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (["pending", "approved", "rejected", "needs_review"].includes(raw))
    return raw;
  if (raw === "needs review") return "needs_review";
  return undefined;
};

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /xlsx|xls|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype =
    allowedTypes.test(file.mimetype) ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/pdf";

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only Excel (.xlsx, .xls) and PDF files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

// Helper function to extract data from Excel
const extractDataFromExcel = (filePath) => {
  try {
    console.log("Reading Excel file:", filePath);
    const workbook = XLSX.readFile(filePath);
    console.log("Sheet names:", workbook.SheetNames);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log("Extracted rows count:", data.length);
    console.log("First few rows:", data.slice(0, 3));

    return data;
  } catch (error) {
    console.error("Excel parsing error:", error);
    throw new Error("Failed to parse Excel file: " + error.message);
  }
};

// Helper function to extract text from PDF
const extractDataFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error("Failed to parse PDF file: " + error.message);
  }
};

// AI analysis function
const analyzeWithAI = async (data, fileType) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let prompt;
    let dataToAnalyze;

    if (fileType === "excel") {
      // Check if data is already well-structured (like your expense data)
      const limitedData = Array.isArray(data) ? data.slice(0, 5) : [data];
      const firstRow = limitedData[0] || {};

      console.log("Analyzing", limitedData.length, "Excel rows with AI");
      console.log("Sample data structure:", firstRow);

      // Check if this looks like well-structured financial data.
      // If yes, process directly (bypass AI) but choose the correct transaction type.
      const keysLower = Object.keys(firstRow).map((k) =>
        String(k).toLowerCase(),
      );
      const hasKey = (needle) =>
        keysLower.some((k) => k === needle || k.includes(needle));
      const hasStructuredFields =
        hasKey("amount") ||
        hasKey("date") ||
        hasKey("description") ||
        hasKey("expense id") ||
        hasKey("sale");

      if (hasStructuredFields) {
        const hasAmountLike =
          hasKey("amount") ||
          hasKey("total") ||
          hasKey("net") ||
          hasKey("gross") ||
          hasKey("price");
        const salesSignals = [
          hasKey("sale"),
          hasKey("sales"),
          hasKey("customer"),
          hasKey("invoice"),
          hasKey("product") && hasKey("quantity"),
          hasKey("sales rep"),
        ].filter(Boolean).length;

        const transactionType =
          salesSignals >= 2 && hasAmountLike ? "income" : "expense";
        console.log(
          `Detected structured ${transactionType} data (bypassing AI), processing directly...`,
        );
        return processStructuredExcelData(data, transactionType);
      }

      dataToAnalyze = limitedData;

      prompt = `
            Analyze the following Excel data and extract financial transactions. 
            Each row represents a potential transaction. Look for columns that might contain:
            - Date information (any date format)
            - Amount/money values (numbers, could be positive or negative)
            - Description/details about the transaction
            - Category or type information
            
            Data sample: ${JSON.stringify(limitedData)}
            
            For each valid transaction row, respond with a JSON array:
            [
                {
                    "date": "YYYY-MM-DD format",
                    "description": "transaction description",
                    "amount": positive_number,
                    "category": "best_guess_category",
                    "vendor": "vendor if identifiable",
                    "type": "expense",
                    "confidence": 0.8
                }
            ]
            
            Important: 
            - Convert all dates to YYYY-MM-DD format
            - Make amounts positive numbers
            - If no clear transactions found, return empty array []
            - Only include rows that clearly look like financial transactions
            `;
    } else {
      // PDF
      dataToAnalyze = data;
      prompt = `
            Analyze the following PDF text and extract financial transactions.
            Look for transaction patterns like dates, amounts, descriptions.
            
            Text: ${data}
            
            Please respond with ONLY a JSON array in this format:
            [
                {
                    "date": "YYYY-MM-DD",
                    "description": "transaction description",
                    "amount": number,
                    "category": "suggested category",
                    "vendor": "vendor name if available",
                    "type": "expense",
                    "confidence": 0.9
                }
            ]
            
            If no transactions found, return empty array [].
            `;
    }

    console.log("Sending prompt to AI...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI Response:", text.substring(0, 500));

    // Clean and parse JSON response
    let aiTransactions = [];
    try {
      const cleanedText = text.trim().replace(/```json|```/g, "");
      aiTransactions = JSON.parse(cleanedText);

      if (!Array.isArray(aiTransactions)) {
        console.log("AI response is not an array, wrapping in array");
        aiTransactions = [aiTransactions];
      }

      console.log("AI found", aiTransactions.length, "transactions");
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw AI response:", text);
      aiTransactions = [];
    }

    // If Excel data and AI found transactions, try to process more rows
    if (
      fileType === "excel" &&
      Array.isArray(data) &&
      data.length > 50 &&
      aiTransactions.length > 0
    ) {
      console.log("Processing remaining Excel rows...");

      // Process remaining rows using the pattern from successful AI analysis
      const remainingRows = data.slice(50);
      const additionalTransactions = processExcelRowsBasedOnPattern(
        remainingRows,
        aiTransactions[0],
      );

      aiTransactions = [...aiTransactions, ...additionalTransactions];
      console.log(
        "Total transactions after processing all rows:",
        aiTransactions.length,
      );
    }

    return aiTransactions;
  } catch (error) {
    console.error("AI Analysis error:", error);
    return [];
  }
};

// Process well-structured Excel data directly (bypassing AI)
const processStructuredExcelData = (data, transactionType = "expense") => {
  console.log(
    "Processing",
    data.length,
    "structured Excel rows directly as",
    transactionType,
    "...",
  );
  const transactions = [];

  // Log a sample of the data structure for debugging
  if (data.length > 0) {
    console.log("Sample row structure:", Object.keys(data[0]));
    console.log("First row data:", JSON.stringify(data[0], null, 2));
    if (data.length > 1) {
      console.log("Second row data:", JSON.stringify(data[1], null, 2));
    }
  }

  data.forEach((row, index) => {
    try {
      // Get all available keys for this row
      const keys = Object.keys(row);

      // Map the Excel columns to our transaction format (more flexible mapping)
      const expenseId =
        row["Expense ID"] ||
        row["ExpenseID"] ||
        row["ID"] ||
        row["id"] ||
        `TXN${index + 1}`;

      // Try multiple variations for date field
      let date =
        row["Date"] ||
        row["date"] ||
        row["Transaction Date"] ||
        row["DATE"] ||
        row["Date of Transaction"] ||
        row["TransactionDate"] ||
        row["Txn Date"];

      // If still no date found, look for any field with "date" in the name
      if (!date) {
        const dateKey = keys.find((key) => key.toLowerCase().includes("date"));
        if (dateKey) date = row[dateKey];
      }

      // Try multiple variations for description
      let description =
        row["Description"] ||
        row["description"] ||
        row["Vendor"] ||
        row["vendor"] ||
        row["Purpose"] ||
        row["Details"] ||
        row["details"] ||
        row["Memo"] ||
        row["memo"] ||
        row["Transaction Description"] ||
        row["Expense Description"] ||
        "Transaction";

      // Try multiple variations for amount
      let amount = parseFloat(
        row["Amount"] ||
          row["amount"] ||
          row["Total"] ||
          row["total"] ||
          row["Cost"] ||
          row["cost"] ||
          row["Price"] ||
          row["price"] ||
          row["Value"] ||
          row["value"] ||
          row["Net Amount"] ||
          row["Gross Amount"] ||
          row["Net Total"] ||
          row["Total Amount"] ||
          0,
      );

      // If still no amount found, look for any numeric field
      if (amount === 0) {
        const numericKey = keys.find((key) => {
          const value = row[key];
          return typeof value === "number" && value > 0;
        });
        if (numericKey) amount = parseFloat(row[numericKey]);
      }

      const category =
        row["Category"] ||
        row["category"] ||
        row["Type"] ||
        row["type"] ||
        row["Product"] ||
        row["product"] ||
        "Uncategorized";
      const vendor =
        row["Vendor"] ||
        row["vendor"] ||
        row["Supplier"] ||
        row["supplier"] ||
        row["Company"] ||
        row["company"] ||
        row["Customer"] ||
        row["customer"] ||
        "";
      const employee =
        row["Employee"] ||
        row["employee"] ||
        row["Name"] ||
        row["name"] ||
        row["Requestor"] ||
        row["requestor"] ||
        row["Sales Rep"] ||
        row["Rep"] ||
        "";
      const department =
        row["Department"] ||
        row["department"] ||
        row["Dept"] ||
        row["dept"] ||
        row["Region"] ||
        row["region"] ||
        "";
      const status =
        row["Status"] ||
        row["status"] ||
        row["State"] ||
        row["state"] ||
        "pending";

      // Log the extracted values for debugging
      if (index < 5) {
        console.log(`Row ${index + 1} extracted values:`, {
          date: date,
          amount: amount,
          description: description,
          rawAmount:
            row["Amount"] || row["amount"] || row["Total"] || row["Cost"],
          rawDate:
            row["Date"] ||
            row["date"] ||
            row["Transaction Date"] ||
            row["DATE"],
        });
      }

      // Validate required fields
      if (date && amount > 0) {
        // Parse date more robustly
        let parsedDate;
        try {
          parsedDate = new Date(date);
          // Check if it's a valid date
          if (isNaN(parsedDate.getTime())) {
            // Try different date formats
            const dateStr = date.toString();
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/");
              if (parts.length === 3) {
                // Try MM/DD/YYYY format
                parsedDate = new Date(
                  `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(
                    2,
                    "0",
                  )}`,
                );
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing date "${date}" in row ${index}:`, e);
          parsedDate = new Date(); // Use current date as fallback
        }

        if (!isNaN(parsedDate.getTime())) {
          const transaction = {
            date: parsedDate.toISOString().split("T")[0],
            description: `${description}${employee ? ` - ${employee}` : ""}`,
            amount: Math.abs(amount),
            category: category,
            vendor: vendor,
            type: transactionType,
            confidence: 0.95,
            department: department,
            originalStatus: status,
            originalRowIndex: index,
          };
          transactions.push(transaction);

          // Log first few transactions for debugging
          if (index < 3) {
            console.log(`Transaction ${index + 1}:`, transaction);
          }
        } else {
          console.warn(`Invalid date "${date}" in row ${index}, skipping`);
        }
      } else {
        console.warn(`Missing required data in row ${index}:`, {
          date: date,
          amount: amount,
          hasDate: !!date,
          hasValidAmount: amount > 0,
          rawDate:
            row["Date"] ||
            row["date"] ||
            row["Transaction Date"] ||
            row["DATE"],
          rawAmount:
            row["Amount"] || row["amount"] || row["Total"] || row["Cost"],
        });
      }
    } catch (error) {
      console.error("Error processing structured row", index, ":", error);
      console.error("Row data:", row);
    }
  });

  console.log(
    `Successfully processed ${transactions.length} out of ${data.length} total rows`,
  );
  return transactions;
};

// Helper function to process remaining Excel rows based on AI pattern
const processExcelRowsBasedOnPattern = (rows, sampleTransaction) => {
  const additionalTransactions = [];

  // Try to identify column patterns from the sample
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow);

  console.log("Processing", rows.length, "additional rows using pattern...");

  rows.forEach((row, index) => {
    try {
      // Look for date-like columns
      let date = null;
      let amount = null;
      let description = "";

      // Find date column
      for (let key of keys) {
        const value = row[key];
        if (
          value &&
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("time"))
        ) {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate)) {
            date = parsedDate.toISOString().split("T")[0];
            break;
          }
        }
      }

      // Find amount column
      for (let key of keys) {
        const value = row[key];
        if (typeof value === "number" && Math.abs(value) > 0) {
          amount = Math.abs(value);
          break;
        } else if (
          typeof value === "string" &&
          /^\$?[\d,]+\.?\d*$/.test(value.replace(/[^\d.,]/g, ""))
        ) {
          amount = Math.abs(parseFloat(value.replace(/[^\d.]/g, "")));
          break;
        }
      }

      // Find description column
      for (let key of keys) {
        const value = row[key];
        if (
          typeof value === "string" &&
          value.length > 3 &&
          !key.toLowerCase().includes("date")
        ) {
          description = value;
          break;
        }
      }

      // Create transaction if we found essential data
      if (date && amount && amount > 0) {
        additionalTransactions.push({
          date: date,
          description: description || `Transaction ${index + 1}`,
          amount: amount,
          category: "Uncategorized",
          vendor: "",
          type: "expense",
          confidence: 0.7,
        });
      }
    } catch (error) {
      console.error("Error processing row", index, ":", error);
    }
  });

  console.log(
    "Processed",
    additionalTransactions.length,
    "additional transactions",
  );
  return additionalTransactions;
};

// Upload and analyze file
const uploadAndAnalyzeFile = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      console.error("❌ Upload failed: User not authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!req.file) {
      console.error("❌ Upload failed: No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileType = path
      .extname(req.file.originalname)
      .toLowerCase()
      .includes("pdf")
      ? "pdf"
      : "excel";

    console.log(
      `📁 Processing ${fileType} file: ${req.file.originalname} for user: ${req.user._id}`,
    );
    console.log(`📍 File path: ${filePath}`);

    let extractedData;
    if (fileType === "excel") {
      extractedData = extractDataFromExcel(filePath);
      console.log(
        "Excel data extracted successfully, rows:",
        extractedData.length,
      );

      // Check if this is a well-structured report (sales or expenses)
      const firstRow = extractedData[0];
      const keysLower = firstRow
        ? Object.keys(firstRow).map((k) => String(k).toLowerCase())
        : [];

      const hasKey = (needle) =>
        keysLower.some((k) => k === needle || k.includes(needle));

      const hasAmountLike =
        hasKey("amount") ||
        hasKey("total") ||
        hasKey("net") ||
        hasKey("gross") ||
        hasKey("price");
      const hasDateLike = hasKey("date");

      // Sales indicators
      const salesSignals = [
        hasKey("sale"),
        hasKey("sales"),
        hasKey("customer"),
        hasKey("invoice"),
        hasKey("order"),
        hasKey("product") && hasKey("quantity"),
        hasKey("sales rep"),
      ].filter(Boolean).length;

      // Expense indicators
      const expenseSignals = [
        hasKey("expense"),
        hasKey("vendor"),
        hasKey("employee"),
        hasKey("supplier"),
        hasKey("department"),
      ].filter(Boolean).length;

      const hasSalesStructure =
        !!firstRow && salesSignals >= 2 && hasAmountLike;
      const hasExpenseStructure =
        !!firstRow &&
        (hasKey("expense id") ||
          (expenseSignals >= 2 && hasAmountLike && hasDateLike));

      const transactionType = hasSalesStructure ? "income" : "expense";

      if (hasExpenseStructure || hasSalesStructure) {
        console.log(
          `Detected structured ${transactionType} data, processing directly...`,
        );
        const transactions = processStructuredExcelData(
          extractedData,
          transactionType,
        );
        console.log(
          `processStructuredExcelData returned ${transactions.length} transactions`,
        );

        if (transactions.length > 0) {
          // Save structured transactions directly to database using bulk insert (much faster)
          const userId = req.user._id;
          console.log(
            `Starting to save ${transactions.length} transactions for user: ${userId}`,
          );
          console.log(`User ID type: ${typeof userId}, Value: ${userId}`);

          // Prepare all transactions for bulk insert
          const transactionsToInsert = transactions.map((transaction, i) => {
            if (i === 0) {
              console.log(`Sample transaction to save:`, {
                date: transaction.date,
                amount: transaction.amount,
                description: transaction.description,
                category: transaction.category,
                type: transaction.type,
              });
            }

            return {
              userId: userId,
              date: new Date(transaction.date),
              desc: transaction.description || "Transaction",
              amount: Math.abs(transaction.amount),
              category: transaction.category || "Uncategorized",
              vendor: transaction.vendor || "",
              type: normalizeTransactionType(transaction.type) || "expense",
              status: "needs_review",
              sourceFile: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                fileType: fileType,
                uploadDate: new Date(),
              },
              aiAnalysis: {
                confidence: transaction.confidence || 0.95,
                extractedText: JSON.stringify(extractedData.slice(0, 10)), // Sample only
                processingNotes: "Processed directly from structured Excel",
              },
            };
          });

          // Bulk insert - much faster than individual saves
          let savedTransactions = [];
          try {
            savedTransactions = await Transaction.insertMany(
              transactionsToInsert,
              {
                ordered: false, // Continue on error
              },
            );
            console.log(
              `✅ Successfully bulk inserted ${savedTransactions.length} transactions`,
            );
          } catch (bulkError) {
            // insertMany with ordered:false still inserts valid docs even if some fail
            if (bulkError.insertedDocs) {
              savedTransactions = bulkError.insertedDocs;
              console.log(
                `⚠️ Bulk insert completed with some errors. Saved ${savedTransactions.length} out of ${transactions.length}`,
              );
            } else {
              console.error(`❌ Bulk insert failed:`, bulkError.message);
              // Fallback to individual saves
              for (let i = 0; i < transactionsToInsert.length; i++) {
                try {
                  const saved = await Transaction.create(
                    transactionsToInsert[i],
                  );
                  savedTransactions.push(saved);
                } catch (saveError) {
                  console.error(
                    `❌ Error saving transaction ${i + 1}:`,
                    saveError.message,
                  );
                }
              }
            }
          }

          console.log(
            `Successfully saved ${savedTransactions.length} out of ${transactions.length} transactions`,
          );

          // Clean up uploaded file
          fs.unlinkSync(filePath);

          return res.json({
            success: true,
            message: `Successfully processed ${savedTransactions.length} transactions from structured Excel file`,
            data: {
              transactions: savedTransactions,
              totalProcessed: savedTransactions.length,
              transactionsSaved: savedTransactions.length,
              transactionsFound: transactions.length,
              processedDirectly: true,
            },
          });
        } else {
          console.warn("No valid transactions found in structured Excel data");
          // Clean up uploaded file
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: "No valid transactions found in the Excel file",
            debug: "processStructuredExcelData returned 0 transactions",
          });
        }
      }
    } else {
      extractedData = await extractDataFromPDF(filePath);
      console.log("PDF text extracted, length:", extractedData.length);
    }

    if (
      !extractedData ||
      (Array.isArray(extractedData) && extractedData.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "No data found in the uploaded file" });
    }

    // Analyze with AI
    console.log("Starting AI analysis...");
    const aiAnalysis = await analyzeWithAI(extractedData, fileType);
    console.log(
      "AI analysis completed, found transactions:",
      aiAnalysis.length,
    );

    // Save transactions to database using bulk insert (faster)
    const userId = req.user._id; // Get user ID from authenticated user

    const transactionsToInsert = aiAnalysis.map((transaction) => ({
      userId: userId,
      date: new Date(transaction.date),
      desc: transaction.description,
      amount: Math.abs(transaction.amount),
      category: transaction.category || "Uncategorized",
      vendor: transaction.vendor,
      type: normalizeTransactionType(transaction.type) || "expense",
      sourceFile: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: fileType,
        uploadDate: new Date(),
      },
      aiAnalysis: {
        confidence: transaction.confidence || 0.8,
        extractedText:
          fileType === "pdf"
            ? extractedData.substring(0, 1000) // Limit text size
            : JSON.stringify(extractedData.slice(0, 10)), // Sample only
        suggestedCategory: transaction.category,
        processingNotes: "Processed with Gemini AI",
      },
      status: "needs_review",
    }));

    // Bulk insert for better performance
    let savedTransactions = [];
    try {
      savedTransactions = await Transaction.insertMany(transactionsToInsert, {
        ordered: false, // Continue even if some fail
      });
      console.log(
        `✅ Successfully bulk inserted ${savedTransactions.length} AI-analyzed transactions`,
      );
    } catch (bulkError) {
      // insertMany with ordered:false still inserts valid docs
      if (bulkError.insertedDocs) {
        savedTransactions = bulkError.insertedDocs;
        console.log(
          `⚠️ Bulk insert completed with some errors. Saved ${savedTransactions.length} out of ${aiAnalysis.length}`,
        );
      } else {
        console.error(
          "Bulk insert failed, trying individual saves:",
          bulkError.message,
        );
        // Fallback to individual saves
        for (const transactionData of transactionsToInsert) {
          try {
            const saved = await Transaction.create(transactionData);
            savedTransactions.push(saved);
          } catch (saveError) {
            console.error(
              "Error saving individual transaction:",
              saveError.message,
            );
          }
        }
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: "File processed successfully",
      transactionsFound: aiAnalysis.length,
      transactionsSaved: savedTransactions.length,
      transactions: savedTransactions,
    });
  } catch (error) {
    console.error("Error processing file:", error);

    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error cleaning up file:", unlinkError);
      }
    }

    res.status(500).json({
      error: "Failed to process file",
      message: error.message,
    });
  }
};

// Create a single transaction (manual entry)
// POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user._id;
    const {
      date,
      desc,
      amount,
      category,
      type,
      status,
      vendor,
      currency,
      notes,
      reference,
      account,
      paymentMethod,
    } = req.body;

    const parsedAmount = Number(amount);
    if (!date || !desc || !Number.isFinite(parsedAmount) || !category) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "date, desc, amount, and category are required.",
      });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const normalizedType = normalizeTransactionType(type) || "expense";

    console.log("\n📝 Creating transaction:");
    console.log("  Type (input):", type);
    console.log("  Type (normalized):", normalizedType);
    console.log("  Amount:", Math.abs(parsedAmount));
    console.log("  Category:", String(category));

    const transaction = new Transaction({
      userId,
      date: parsedDate,
      desc: String(desc),
      amount: Math.abs(parsedAmount),
      category: String(category),
      type: normalizedType,
      status: normalizeStatus(status) || "pending",
      vendor: vendor ? String(vendor) : undefined,
      currency: currency ? String(currency) : undefined,
      notes: notes ? String(notes) : undefined,
      reference: reference ? String(reference) : undefined,
      account: account ? String(account) : undefined,
      paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
    });

    const saved = await transaction.save();
    console.log(
      "✅ Transaction saved with ID:",
      saved._id,
      "Type:",
      saved.type,
    );
    return res.status(201).json(saved);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return res
      .status(500)
      .json({ error: "Failed to create transaction", message: error.message });
  }
};

// Get all transactions for user
const getTransactions = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user._id;
    const { page = 1, limit = 1000, category, status, type } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(5000, parseInt(limit, 10) || 1000));

    const filter = { userId };
    if (category) filter.category = category;
    if (status) {
      filter.status = normalizeStatus(status) || status;
    }
    if (type) {
      // Normalize the filter type to match database values
      const normalizedFilterType = normalizeTransactionType(type);
      if (normalizedFilterType) {
        filter.type = normalizedFilterType;
      } else {
        // Fallback to case-insensitive regex for backward compatibility
        filter.type = { $regex: `^${String(type)}$`, $options: "i" };
      }
    }

    console.log(
      "Fetching transactions for user:",
      userId,
      "with filter:",
      JSON.stringify(filter),
      "limit:",
      limitNum,
    );

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Transaction.countDocuments(filter);

    // Debug: Check if there are ANY transactions in the database
    const allTransactionsCount = await Transaction.countDocuments({});
    console.log(
      `📊 Database stats: ${allTransactionsCount} total transactions in DB, ${total} for current user`,
    );
    console.log(
      `Found ${transactions.length} transactions out of ${total} total for user ${userId}`,
    );

    // Debug: log transaction types in results
    if (transactions.length > 0) {
      const typeCounts = transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      console.log("  Transaction types in result:", typeCounts);
    }

    res.json({
      transactions: transactions.map((t) => {
        const obj = t.toObject();
        // Ensure type and status are normalized
        obj.type = normalizeTransactionType(obj.type) || obj.type;
        obj.status = normalizeStatus(obj.status) || obj.status;
        return obj;
      }),
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch transactions", message: error.message });
  }
};

// Update transaction
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Only allow specific fields to be updated.
    const updates = {};
    const allowed = [
      "date",
      "desc",
      "amount",
      "category",
      "type",
      "status",
      "vendor",
      "currency",
      "notes",
      "reference",
      "account",
      "paymentMethod",
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.type !== undefined) {
      updates.type = normalizeTransactionType(updates.type) || updates.type;
    }
    if (updates.status !== undefined) {
      updates.status = normalizeStatus(updates.status) || updates.status;
    }
    if (updates.amount !== undefined) {
      const parsedAmount = Number(updates.amount);
      if (Number.isFinite(parsedAmount))
        updates.amount = Math.abs(parsedAmount);
    }
    if (updates.date !== undefined) {
      const parsedDate = new Date(updates.date);
      if (!Number.isNaN(parsedDate.getTime())) updates.date = parsedDate;
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOneAndDelete({ _id: id, userId });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
};

// Bulk delete transactions
const bulkDeleteTransactions = async (req, res) => {
  try {
    console.log("=== BULK DELETE REQUEST ===");
    console.log("User ID:", req.user._id);
    console.log("Request body:", req.body);

    const { ids } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(ids) || ids.length === 0) {
      console.log("Validation failed: No IDs provided");
      return res.status(400).json({ error: "No transaction IDs provided" });
    }

    console.log("Attempting to delete", ids.length, "transactions");
    const result = await Transaction.deleteMany({
      _id: { $in: ids },
      userId: userId,
    });

    console.log("Deleted", result.deletedCount, "transactions");
    res.json({
      message: `${result.deletedCount} transaction(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting transactions:", error);
    res.status(500).json({ error: "Failed to delete transactions" });
  }
};

// Delete all transactions
const deleteAllTransactions = async (req, res) => {
  try {
    console.log("=== DELETE ALL REQUEST ===");
    console.log("User ID:", req.user._id);

    const userId = req.user._id;

    // First, count how many transactions exist
    const countBefore = await Transaction.countDocuments({ userId: userId });
    console.log(
      `Found ${countBefore} transactions to delete for user:`,
      userId,
    );

    // Delete all transactions for this user
    const result = await Transaction.deleteMany({ userId: userId });

    // Verify deletion
    const countAfter = await Transaction.countDocuments({ userId: userId });
    console.log(`Deleted ${result.deletedCount} transactions`);
    console.log(`Remaining transactions: ${countAfter}`);

    if (countAfter > 0) {
      console.warn(
        `⚠️ Warning: ${countAfter} transactions still remain after deletion!`,
      );
    } else {
      console.log("✅ All transactions successfully deleted");
    }

    res.json({
      message: `All ${result.deletedCount} transaction(s) deleted successfully`,
      deletedCount: result.deletedCount,
      remainingCount: countAfter,
    });
  } catch (error) {
    console.error("Error deleting all transactions:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to delete all transactions" });
  }
};

// Get transaction statistics
const getTransactionStats = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Convert userId string to ObjectId for aggregation
    const userId = new mongoose.Types.ObjectId(req.user._id);

    console.log("Fetching stats for user:", userId);

    const stats = await Transaction.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
            },
          },
          totalExpenses: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ["$status", ["needs_review", "pending"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const categoryStats = await Transaction.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    console.log("Stats calculated:", stats[0]);
    console.log("Category breakdown count:", categoryStats.length);

    const result = {
      summary: stats[0] || {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpenses: 0,
        pendingCount: 0,
      },
      categoryBreakdown: categoryStats,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching transaction stats:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch statistics", message: error.message });
  }
};

module.exports = {
  upload,
  uploadAndAnalyzeFile,
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
  deleteAllTransactions,
  getTransactionStats,
};
