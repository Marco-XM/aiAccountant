const Groq = require('groq-sdk');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Initialize Groq AI
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Parser for delimited text format
const parseDelimitedFormat = (text) => {
    const config = {
        sheetName: 'Sheet1',
        columnWidths: [],
        rowHeights: [],
        rows: [],
        formulas: [],
        mergedCells: []
    };

    const lines = text.trim().split('\n');
    let currentSection = '';
    const cellsByRow = {};

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Check for section headers
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1);
            continue;
        }

        const parts = line.split('|').map(p => p.trim());

        switch (currentSection) {
            case 'SHEET':
                // Excel sheet names max 31 chars
                config.sheetName = line.substring(0, 31);
                break;

            case 'COLUMNS':
                if (parts.length >= 2) {
                    const colName = parts[0].toUpperCase();
                    // Validate column name (A-Z, AA-ZZ, etc)
                    if (/^[A-Z]{1,3}$/.test(colName)) {
                        config.columnWidths.push({
                            column: colName,
                            width: parseInt(parts[1]) || 15
                        });
                    }
                }
                break;

            case 'ROWS':
                if (parts.length >= 2) {
                    config.rowHeights.push({
                        rowNumber: parseInt(parts[0]),
                        height: parseInt(parts[1]) || 15
                    });
                }
                break;

            case 'CELLS':
                if (parts.length >= 3) {
                    const rowNum = parseInt(parts[0]);
                    const col = parts[1].toUpperCase().trim();
                    // Validate column name (A-Z, AA-ZZ, etc)
                    if (!/^[A-Z]{1,3}$/.test(col)) {
                        console.warn(`Skipping invalid column in CELLS: "${parts[1]}" (cleaned: "${col}")`);
                        continue; // Skip invalid columns
                    }
                    const value = parts[2] === 'EMPTY' ? '' : parts[2];
                    const fillColor = parts[3] && parts[3] !== 'none' ? parts[3] : null;
                    const fontBold = parts[4] === 'true';
                    const fontSize = parseInt(parts[5]) || 11;
                    const fontColor = parts[6] || 'FF000000';
                    const alignH = parts[7] || 'left';
                    const alignV = parts[8] || 'middle';
                    const border = parts[9] || 'none';

                    if (!cellsByRow[rowNum]) {
                        cellsByRow[rowNum] = [];
                    }

                    const cellConfig = {
                        column: col,
                        value: value,
                        style: {}
                    };

                    if (fillColor) {
                        cellConfig.style.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: fillColor }
                        };
                    }

                    cellConfig.style.font = {
                        bold: fontBold,
                        size: fontSize,
                        color: { argb: fontColor }
                    };

                    cellConfig.style.alignment = {
                        horizontal: alignH,
                        vertical: alignV
                    };

                    if (border !== 'none') {
                        cellConfig.style.border = {
                            top: { style: border },
                            left: { style: border },
                            bottom: { style: border },
                            right: { style: border }
                        };
                    }

                    cellsByRow[rowNum].push(cellConfig);
                }
                break;

            case 'FORMULAS':
                if (parts.length >= 2) {
                    config.formulas.push({
                        cell: parts[0],
                        formula: parts[1]
                    });
                }
                break;

            case 'MERGE':
                if (line && !line.startsWith('[')) {
                    config.mergedCells.push(line);
                }
                break;
        }
    }

    // Convert cellsByRow to rows array
    Object.keys(cellsByRow).forEach(rowNum => {
        config.rows.push({
            rowNumber: parseInt(rowNum),
            cells: cellsByRow[rowNum]
        });
    });

    return config;
};

const generateExcelWithAI = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({
                error: 'Prompt is required'
            });
        }

        // Create a detailed prompt for Excel generation using delimited format
        const aiPrompt = `
        You are an Excel generation expert. Based on the user's request, create a COMPREHENSIVE and DETAILED Excel configuration.
        
        User Request: "${prompt}"
        
        IMPORTANT INSTRUCTIONS:
        - CREATE DETAILED, PROFESSIONAL spreadsheets with MULTIPLE rows and columns
        - Include AT LEAST 10-20 data rows unless user specifically asks for simple/minimal output
        - Add appropriate headers with styling (bold, colored backgrounds)
        - Use formulas for totals, averages, calculations where applicable
        - Apply borders to all cells for professional look
        - Use different colors to highlight headers, totals, and important sections
        - Include all relevant columns that make sense for the request
        - If it's a financial sheet: include columns like Date, Description, Category, Amount, Total, etc.
        - If it's a tracker: include Status, Priority, Assigned To, Due Date, etc.
        - Add summary rows with formulas (SUM, AVERAGE, COUNT, etc.)
        
        Respond using DELIMITED PLAIN TEXT format. Use pipe (|) as delimiter.
        
        FORMAT SECTIONS (FOLLOW EXACTLY):
        
        [SHEET]
        Sheet1
        
        [COLUMNS]
        A|20
        B|25
        C|15
        D|18
        
        [ROWS]
        1|30
        2|20
        
        [CELLS]
        1|A|Header 1|FFFFFF00|true|12|FF000000|center|middle|thin
        1|B|Header 2|FFFFFF00|true|12|FF000000|center|middle|thin
        2|A|Data Value|FFFFFFFF|false|11|FF000000|left|middle|thin
        2|B|100|FFFFFFFF|false|11|FF000000|right|middle|thin
        
        [FORMULAS]
        B10|=SUM(B2:B9)
        C10|=AVERAGE(C2:C9)
        
        [MERGE]
        A1:C1
        
        CRITICAL FORMAT RULES:
        1. Column names MUST be single letters A-Z or double letters AA-ZZ (no numbers, no words)
        2. Cell format: RowNumber|ColumnLetter|Value|FillColor|FontBold|FontSize|FontColor|AlignH|AlignV|Border
        3. Use EMPTY for empty/input cells
        4. Use "none" for no fill color or border
        5. NO SPACES around pipe delimiters
        6. Each line is ONE cell
        7. Create EVERY cell in the table (don't skip cells)
        
        FIELD VALUES:
        - FillColor: ARGB hex (FFFFFF00) or "none"
        - FontBold: true or false
        - FontSize: 10, 11, 12, 14, 16
        - FontColor: ARGB hex (FF000000 for black, FFFFFFFF for white)
        - AlignH: left, center, right
        - AlignV: top, middle, bottom
        - Border: thin, medium, thick, dotted, dashed, none
        
        COLORS (ARGB):
        Yellow=FFFFFF00, Green=FF00FF00, Red=FFFF0000, Blue=FF0000FF, 
        LightGreen=FF90EE90, LightBlue=FFADD8E6, Orange=FFFFA500, 
        Gray=FFD3D3D3, White=FFFFFFFF, Black=FF000000, DarkBlue=FF1F4E78
        
        STYLE GUIDELINES:
        - Headers: Bold, colored background (Yellow, Blue, or DarkBlue), centered, borders
        - Data rows: White/light background, borders, left-align text, right-align numbers
        - Total rows: Bold, light colored background (LightGreen, LightBlue), borders
        - Use appropriate column widths (20-30 for text, 12-18 for numbers)
        
        COMPREHENSIVE EXAMPLE for a Budget Sheet:
        [SHEET]
        Monthly Budget 2024
        
        [COLUMNS]
        A|25
        B|20
        C|15
        D|15
        E|15
        
        [ROWS]
        1|30
        
        [CELLS]
        1|A|Category|FF1F4E78|true|14|FFFFFFFF|center|middle|thin
        1|B|Description|FF1F4E78|true|14|FFFFFFFF|center|middle|thin
        1|C|Budget|FF1F4E78|true|14|FFFFFFFF|center|middle|thin
        1|D|Actual|FF1F4E78|true|14|FFFFFFFF|center|middle|thin
        1|E|Variance|FF1F4E78|true|14|FFFFFFFF|center|middle|thin
        2|A|Income|FFFFFFFF|false|11|FF000000|left|middle|thin
        2|B|Salary|FFFFFFFF|false|11|FF000000|left|middle|thin
        2|C|5000|FFFFFFFF|false|11|FF000000|right|middle|thin
        2|D|5000|FFFFFFFF|false|11|FF000000|right|middle|thin
        3|A|Expenses|FFFFFFFF|false|11|FF000000|left|middle|thin
        3|B|Rent|FFFFFFFF|false|11|FF000000|left|middle|thin
        3|C|1500|FFFFFFFF|false|11|FF000000|right|middle|thin
        3|D|1500|FFFFFFFF|false|11|FF000000|right|middle|thin
        4|A|Expenses|FFFFFFFF|false|11|FF000000|left|middle|thin
        4|B|Utilities|FFFFFFFF|false|11|FF000000|left|middle|thin
        4|C|300|FFFFFFFF|false|11|FF000000|right|middle|thin
        4|D|280|FFFFFFFF|false|11|FF000000|right|middle|thin
        5|A|Total|FF90EE90|true|12|FF000000|center|middle|thin
        5|B|EMPTY|FF90EE90|true|12|FF000000|center|middle|thin
        
        [FORMULAS]
        C5|=SUM(C2:C4)
        D5|=SUM(D2:D4)
        E2|=D2-C2
        E3|=D3-C3
        E4|=D4-C4
        E5|=D5-C5
        
        Remember: 
        - Create AT LEAST 10-20 rows of data unless explicitly asked for minimal output
        - Use ONLY single letters (A-Z) or double letters (AA-ZZ) for columns
        - Include formulas for calculations
        - Style professionally with colors and borders
        `;

        // Generate response from AI
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "user", content: aiPrompt }
            ],
            temperature: 0.3,
        });
        
        const text = completion.choices[0].message.content;

        // Clean AI response (remove markdown if present)
        const cleanedText = text.trim().replace(/```[a-z]*\n|```/g, '').trim();
        console.log('AI Response:', cleanedText);

        // Parse the delimited text response
        let excelConfig;
        try {
            excelConfig = parseDelimitedFormat(cleanedText);
            console.log('Parsed config:', JSON.stringify(excelConfig, null, 2));
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            console.error('AI Response:', text);
            return res.status(500).json({
                error: 'Failed to parse AI response',
                aiResponse: text,
                parseError: parseError.message
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(excelConfig.sheetName || 'Sheet1');

        // Apply column widths
        if (excelConfig.columnWidths) {
            excelConfig.columnWidths.forEach(colWidth => {
                const col = worksheet.getColumn(colWidth.column);
                col.width = colWidth.width || 15;
            });
        }

        // Apply row heights
        if (excelConfig.rowHeights) {
            excelConfig.rowHeights.forEach(rowHeight => {
                const row = worksheet.getRow(rowHeight.rowNumber);
                row.height = rowHeight.height || 15;
            });
        }

        // Add rows and cells with styling
        if (excelConfig.rows) {
            excelConfig.rows.forEach(rowConfig => {
                const row = worksheet.getRow(rowConfig.rowNumber);
                
                rowConfig.cells.forEach(cellConfig => {
                    // Validate column before processing
                    if (!cellConfig.column || !/^[A-Z]{1,3}$/.test(cellConfig.column)) {
                        console.warn('Skipping invalid column:', cellConfig.column);
                        return;
                    }
                    
                    const cell = row.getCell(cellConfig.column);
                    
                    // Set value (can be empty string for input cells)
                    if (cellConfig.value !== undefined) {
                        cell.value = cellConfig.value;
                    }
                    
                    // Apply styling
                    if (cellConfig.style) {
                        if (cellConfig.style.fill) {
                            cell.fill = cellConfig.style.fill;
                        }
                        if (cellConfig.style.font) {
                            cell.font = cellConfig.style.font;
                        }
                        if (cellConfig.style.alignment) {
                            cell.alignment = cellConfig.style.alignment;
                        }
                        if (cellConfig.style.border) {
                            cell.border = cellConfig.style.border;
                        }
                    }
                });
                
                row.commit();
            });
        }

        // Add formulas
        if (excelConfig.formulas) {
            excelConfig.formulas.forEach(formulaConfig => {
                const cell = worksheet.getCell(formulaConfig.cell);
                cell.value = { formula: formulaConfig.formula };
                
                // Apply formula cell styling if specified
                if (formulaConfig.style) {
                    if (formulaConfig.style.fill) {
                        cell.fill = formulaConfig.style.fill;
                    }
                    if (formulaConfig.style.font) {
                        cell.font = formulaConfig.style.font;
                    }
                    if (formulaConfig.style.alignment) {
                        cell.alignment = formulaConfig.style.alignment;
                    }
                    if (formulaConfig.style.border) {
                        cell.border = formulaConfig.style.border;
                    }
                }
            });
        }

        // Merge cells if specified
        if (excelConfig.mergedCells && excelConfig.mergedCells.length > 0) {
            console.log('Attempting to merge cells. Received:', JSON.stringify(excelConfig.mergedCells));
            excelConfig.mergedCells.forEach((range, index) => {
                try {
                    console.log(`Processing merge range ${index}:`, typeof range, range);
                    // Handle both string format "A1:B2" and object format {start: "A1", end: "B2"}
                    if (typeof range === 'string') {
                        worksheet.mergeCells(range);
                    } else if (range.start && range.end) {
                        worksheet.mergeCells(`${range.start}:${range.end}`);
                    } else if (range.topLeft && range.bottomRight) {
                        worksheet.mergeCells(`${range.topLeft}:${range.bottomRight}`);
                    } else {
                        console.warn('Invalid merged cell format:', range);
                    }
                } catch (mergeError) {
                    console.error('Error merging cells:', mergeError.message, 'Range:', range);
                }
            });
        } else {
            console.log('No merged cells to process');
        }

        // Generate Excel file
        const fileName = `excel_${Date.now()}.xlsx`;
        const uploadsDir = path.join(__dirname, '../uploads');
        
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, fileName);

        // Write to file
        await workbook.xlsx.writeFile(filePath);

        // Send response with file download
        res.json({
            success: true,
            message: 'Excel file generated successfully',
            fileName: fileName,
            downloadUrl: `/api/ai-excel/download/${fileName}`,
            config: excelConfig
        });

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({
            error: 'Failed to generate Excel file',
            details: error.message
        });
    }
};

const downloadExcel = async (req, res) => {
    try {
        const { fileName } = req.params;
        const filePath = path.join(__dirname, '../uploads', fileName);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Send file
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
            
            // Delete file after download
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 5000);
        });

    } catch (error) {
        console.error('Error downloading Excel:', error);
        res.status(500).json({
            error: 'Failed to download file',
            details: error.message
        });
    }
};

module.exports = {
    generateExcelWithAI,
    downloadExcel
};
