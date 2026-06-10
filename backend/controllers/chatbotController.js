const Groq = require('groq-sdk');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const usageService = require('../services/usageService');
const localTransactionStore = require('../services/localTransactionStore');
const { isMongoObjectId } = require('../services/userIdentity');
const { loadUserTaxes, summarizeTransactionTaxes } = require('../services/taxService');

// Initialize Groq AI
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Single flexible function to query transactions (supports both MongoDB and local-store users)
const queryTransactions = async (userId, query) => {
    const { 
        startDate, 
        endDate, 
        category, 
        type, // 'income' or 'expense'
        groupBy, // 'category', 'month', 'type'
        sortBy, // 'amount', 'date', 'count'
        limit,
        includeTransactions = false
    } = query;

    // ── Local file-store path (dev / non-MongoDB users) ──────────────────────
    if (!isMongoObjectId(userId)) {
        const { transactions } = await localTransactionStore.listTransactions({
            userId: String(userId),
            type,
            category,
            dateFrom: startDate,
            dateTo: endDate,
            limit: 5000,
        });

        if (groupBy) {
            const groups = {};
            for (const t of transactions) {
                let key;
                if (groupBy === 'category') {
                    key = t.category || 'Uncategorized';
                } else if (groupBy === 'month') {
                    const d = new Date(t.date);
                    key = isNaN(d.getTime()) ? 'Unknown'
                        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                } else if (groupBy === 'type') {
                    key = t.type || 'expense';
                } else {
                    key = 'all';
                }
                if (!groups[key]) groups[key] = { total: 0, count: 0 };
                groups[key].total += Math.abs(Number(t.amount) || 0);
                groups[key].count += 1;
            }

            let results = Object.entries(groups).map(([k, v]) => ({
                [groupBy]: k, total: v.total, count: v.count,
            }));
            if (sortBy === 'amount') results.sort((a, b) => b.total - a.total);
            else if (sortBy === 'count') results.sort((a, b) => b.count - a.count);
            if (limit) results = results.slice(0, parseInt(limit));

            return { grouped: true, groupBy, results };
        }

        // Flat summary
        const summary = {
            totalTransactions: transactions.length,
            totalAmount: 0, totalIncome: 0, totalExpenses: 0,
            categories: {},
            dateRange: { startDate, endDate },
        };
        for (const t of transactions) {
            const amt = Math.abs(Number(t.amount) || 0);
            summary.totalAmount += amt;
            if (t.type === 'income') summary.totalIncome += amt;
            else if (t.type === 'expense') summary.totalExpenses += amt;
            const cat = t.category || 'Uncategorized';
            if (!summary.categories[cat]) summary.categories[cat] = { total: 0, count: 0 };
            summary.categories[cat].total += amt;
            summary.categories[cat].count += 1;
        }
        if (includeTransactions) {
            summary.transactions = transactions.slice(0, 20).map(t => ({
                date: t.date, description: t.desc, category: t.category,
                type: t.type, amount: t.amount,
            }));
        }
        return summary;
    }

    // ── MongoDB path ─────────────────────────────────────────────────────────
    // Build match filter
    const matchFilter = {
        userId: new mongoose.Types.ObjectId(userId)
    };

    if (startDate && endDate) {
        matchFilter.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    if (category) {
        matchFilter.category = category;
    }

    if (type) {
        matchFilter.type = type;
    }

    // If grouping is requested
    if (groupBy) {
        let groupField;
        if (groupBy === 'category') {
            groupField = '$category';
        } else if (groupBy === 'month') {
            groupField = { $month: '$date' };
        } else if (groupBy === 'type') {
            groupField = '$type';
        }

        const pipeline = [
            { $match: matchFilter },
            {
                $group: {
                    _id: groupField,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ];

        // Add sorting
        if (sortBy === 'amount') {
            pipeline.push({ $sort: { total: -1 } });
        } else if (sortBy === 'count') {
            pipeline.push({ $sort: { count: -1 } });
        }

        // Add limit
        if (limit) {
            pipeline.push({ $limit: parseInt(limit) });
        }

        const results = await Transaction.aggregate(pipeline);

        return {
            grouped: true,
            groupBy: groupBy,
            results: results.map(r => ({
                [groupBy]: groupBy === 'month' ? `Month ${r._id}` : r._id,
                total: r.total,
                count: r.count
            }))
        };
    }

    // Otherwise, return flat transaction list
    const transactions = await Transaction.find(matchFilter)
        .sort(sortBy === 'amount' ? { amount: -1 } : { date: -1 })
        .limit(limit ? parseInt(limit) : 1000);

    const summary = {
        totalTransactions: transactions.length,
        totalAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        categories: {},
        dateRange: { startDate, endDate }
    };

    transactions.forEach(t => {
        summary.totalAmount += t.amount;
        if (t.type === 'income') {
            summary.totalIncome += t.amount;
        } else if (t.type === 'expense') {
            summary.totalExpenses += t.amount;
        }

        if (!summary.categories[t.category]) {
            summary.categories[t.category] = { total: 0, count: 0 };
        }
        summary.categories[t.category].total += t.amount;
        summary.categories[t.category].count += 1;
    });

    if (includeTransactions) {
        summary.transactions = transactions.slice(0, 20).map(t => ({
            date: t.date,
            description: t.desc,
            category: t.category,
            type: t.type,
            amount: t.amount
        }));
    }

    return summary;
};

// Load every transaction for a user (used to compute per-transaction tax rollups).
const loadAllTransactions = async (userId) => {
    if (!isMongoObjectId(userId)) {
        const { transactions } = await localTransactionStore.listTransactions({
            userId: String(userId),
            limit: 5000,
        });
        return transactions || [];
    }
    return Transaction.find({ userId: new mongoose.Types.ObjectId(userId) })
        .limit(10000)
        .lean();
};

// Return the user's tax rules and the tax they imply on income, expenses and overall.
const getTaxInfo = async (userId) => {
    const taxes = await loadUserTaxes(userId);
    if (!taxes.length) {
        return {
            hasTaxes: false,
            message: "No tax rules are defined. Suggest the user add them on the Taxes page.",
            taxRules: [],
        };
    }

    const transactions = await loadAllTransactions(userId);
    const summary = summarizeTransactionTaxes(transactions, taxes);

    return {
        hasTaxes: true,
        taxRules: taxes.map((t) => ({
            name: t.name,
            type: t.type,
            rate: t.rate,
            amount: t.amount,
            appliesTo: t.appliesTo,
            compound: t.compound,
            active: t.active,
        })),
        incomeBase: summary.incomeBase,
        expenseBase: summary.expenseBase,
        taxOnIncome: summary.incomeTax,
        taxOnExpense: summary.expenseTax,
        totalTax: summary.totalTax,
        transactionsConsidered: transactions.length,
    };
};

// Tool definition for Groq
const tools = [
    {
        type: "function",
        function: {
            name: "queryTransactions",
            description: "Flexible function to query and analyze financial transactions. Can filter, group, sort and aggregate transaction data based on various criteria.",
            parameters: {
                type: "object",
                properties: {
                    startDate: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format (optional)"
                    },
                    endDate: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format (optional)"
                    },
                    category: {
                        type: "string",
                        description: "Filter by specific category (optional)"
                    },
                    type: {
                        type: "string",
                        enum: ["income", "expense"],
                        description: "Filter by transaction type: 'income' or 'expense'. OMIT this field entirely if not filtering by type — do NOT pass null."
                    },
                    groupBy: {
                        type: "string",
                        enum: ["category", "month", "type"],
                        description: "Group results by: category, month, or type. OMIT if not grouping — do NOT pass null."
                    },
                    sortBy: {
                        type: "string",
                        enum: ["amount", "date", "count"],
                        description: "Sort results by: amount, date, or count (default: date). OMIT if using default — do NOT pass null."
                    },
                    limit: {
                        type: "number",
                        description: "Limit number of results (optional, default: 1000)"
                    },
                    includeTransactions: {
                        type: "boolean",
                        description: "Include sample transactions in response (optional, default: false)"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getTaxInfo",
            description: "Get the user's configured tax rules and the resulting tax owed on their income, expenses, and overall. Use this for ANY question about taxes — VAT, GST, sales tax, tax liability, tax rules, or 'how much tax do I owe'.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    }
];

const chat = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { message, conversationHistory = [] } = req.body;
        const userId = req.user._id;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('Chat request from user:', userId);
        console.log('User message:', message);

        // System context — kept concise to minimise token usage
        const systemContext = `You are a professional accountant assistant. Use the queryTransactions function to answer financial questions.

FORMATTING: Use **bold** for key numbers, ## for headers, • for lists, $1,234.56 for currency. Add brief insights at the end.

QUARTERS: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec.

QUERY RULES:
- "income/revenue" → type:"income" | "expense/spending" → type:"expense"
- Use groupBy:"category" for summaries, groupBy:"month" for trends
- Set includeTransactions:false unless user needs individual transactions
- For period comparisons (e.g. 2024 vs 2023) make SEPARATE calls per period
- Prefer ONE optimised call when possible
- IMPORTANT: Omit optional parameters entirely — never pass null for any field

TAX RULES:
- For ANY tax question (taxes, VAT, GST, sales tax, tax liability, "how much tax do I owe", "what are my tax rules") → call getTaxInfo
- If getTaxInfo returns hasTaxes:false, tell the user no tax rules are set up and they can add them on the Taxes page

SUGGESTED QUESTIONS: End every response with ---SUGGESTED--- then a JSON array of 3-4 follow-up questions:
---SUGGESTED---
["Question 1?", "Question 2?", "Question 3?"]

Current date: ${new Date().toISOString().split('T')[0]}`;

        // Build messages array for Groq — limit history to last 8 messages to cap token usage
        const trimmedHistory = conversationHistory.slice(-8);
        const messages = [
            { role: "system", content: systemContext },
            ...trimmedHistory.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.content
            })),
            { role: "user", content: message }
        ];

        let finalResponse = '';
        let functionCallIterations = 0;
        const maxIterations = 5;

        while (functionCallIterations < maxIterations) {
            // Call Groq API
            const completion = await groq.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: messages,
                tools: tools,
                tool_choice: "auto",
                temperature: 0.3,
                max_tokens: 1024
            });

            const responseMessage = completion.choices[0].message;
            
            // If no tool calls, we're done
            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
                finalResponse = responseMessage.content;
                break;
            }

            // Add assistant's response to messages
            messages.push(responseMessage);

            // Process tool calls
            functionCallIterations++;
            console.log('AI requested tool calls:', responseMessage.tool_calls.map(tc => tc.function.name));

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`Calling function: ${functionName}`, functionArgs);

                try {
                    let result;
                    if (functionName === 'queryTransactions') {
                        result = await queryTransactions(userId, functionArgs);
                    } else if (functionName === 'getTaxInfo') {
                        result = await getTaxInfo(userId);
                    } else {
                        result = { error: 'Unknown function' };
                    }
                    
                    console.log(`Function ${functionName} result:`, result);
                    
                    // Add function result to messages
                    // Cap tool result size to avoid token spikes
                    const resultStr = JSON.stringify(result);
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: resultStr.length > 4000 ? resultStr.slice(0, 4000) + '…}' : resultStr
                    });
                } catch (error) {
                    console.error(`Error calling function ${functionName}:`, error);
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: JSON.stringify({ error: error.message })
                    });
                }
            }
        }

        console.log('AI response:', finalResponse);

        // Extract suggested questions if present
        let suggestedQuestions = [];
        let cleanMessage = finalResponse;
        
        if (finalResponse.includes('---SUGGESTED---')) {
            const parts = finalResponse.split('---SUGGESTED---');
            cleanMessage = parts[0].trim();
            
            try {
                const questionsText = parts[1].trim();
                suggestedQuestions = JSON.parse(questionsText);
            } catch (e) {
                console.error('Error parsing suggested questions:', e);
            }
        }

        res.json({
            message: cleanMessage,
            suggestedQuestions: suggestedQuestions,
            conversationHistory: [
                ...conversationHistory,
                { role: 'user', content: message },
                { role: 'model', content: cleanMessage }
            ]
        });
        // Increment usage after successful response
        usageService.increment(req.user?._id, 'aiChatMessages').catch(() => {});

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process chat',
            message: error.message
        });
    }
};

module.exports = { chat };
