const Groq = require('groq-sdk');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Initialize Groq AI
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Single flexible function to query transactions
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
                        description: "Filter by transaction type: income or expense (optional)"
                    },
                    groupBy: {
                        type: "string",
                        enum: ["category", "month", "type"],
                        description: "Group results by: category, month, or type (optional)"
                    },
                    sortBy: {
                        type: "string",
                        enum: ["amount", "date", "count"],
                        description: "Sort results by: amount, date, or count (optional, default: date)"
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

        // System context
        const systemContext = `You are a professional accountant assistant helping analyze financial data.

FORMATTING RULES:
- Use **bold text** for important numbers and key metrics (e.g., **$125,432.50**)
- Use ## for section headers (e.g., ## Q1 2024 Performance Summary)
- Use bullet points (•) for lists
- Format currency with dollar signs and commas (e.g., $1,234.56)
- Keep responses well-structured with clear sections
- Add brief insights and recommendations at the end

QUARTER DEFINITIONS:
Q1 = January-March, Q2 = April-June, Q3 = July-September, Q4 = October-December

DATA QUERYING STRATEGY:
You have ONE powerful function called "queryTransactions" that can handle ANY type of financial query.

CRITICAL: When user mentions "income" or "revenue", ALWAYS add type: "income"
CRITICAL: When user mentions "expense" or "spending", ALWAYS add type: "expense"

EXAMPLES:
1. "Show me Q1 performance" → queryTransactions({ startDate: "2024-01-01", endDate: "2024-03-31" })
2. "What are top expense categories?" → queryTransactions({ type: "expense", groupBy: "category", sortBy: "amount", limit: 10 })
3. "Income by category for Q2" → queryTransactions({ type: "income", startDate: "2024-04-01", endDate: "2024-06-30", groupBy: "category", sortBy: "amount" })
4. "Show travel expenses" → queryTransactions({ category: "Travel", type: "expense" })
5. "Monthly breakdown for 2024" → queryTransactions({ startDate: "2024-01-01", endDate: "2024-12-31", groupBy: "month" })
6. "Show all categories" → queryTransactions({ groupBy: "category", sortBy: "amount" })
7. "Best product in 2024 and 2023" → Make TWO calls:
   - queryTransactions({ type: "income", startDate: "2024-01-01", endDate: "2024-12-31", groupBy: "category", sortBy: "amount" })
   - queryTransactions({ type: "income", startDate: "2023-01-01", endDate: "2023-12-31", groupBy: "category", sortBy: "amount" })

RESPONSE STRATEGY:
- Use groupBy: "category" to get category-level summaries (faster, less data)
- Set includeTransactions: false unless user explicitly needs transaction details
- For year-over-year or period comparisons: Make SEPARATE calls for each period (don't combine date ranges)
- For single period analysis: Make ONE call with appropriate filters
- Pay attention to keywords: "income", "revenue" (type: "income") vs "expense", "spending" (type: "expense")
- Analyze the returned data yourself and present findings in well-formatted markdown

WHEN TO MAKE MULTIPLE CALLS:
- Comparing different time periods (2024 vs 2023, Q1 vs Q2, etc.) → separate calls for each period
- Comparing income vs expenses → separate calls with type filter
- Getting different groupings → separate calls with different groupBy values
- Otherwise, prefer a single optimized call

IMPORTANT - SUGGESTED QUESTIONS:
After your main response, you MUST generate 3-4 relevant follow-up questions that the user might ask based on the current conversation.
Add these questions at the END of your response after a special marker: "---SUGGESTED---"
Format them as a JSON array like this:
---SUGGESTED---
["Question 1?", "Question 2?", "Question 3?", "Question 4?"]

Current date: ${new Date().toISOString().split('T')[0]}`;

        // Build messages array for Groq
        const messages = [
            { role: "system", content: systemContext },
            ...conversationHistory.map(msg => ({
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
                temperature: 0.5,
                max_tokens: 2048
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
                    } else {
                        result = { error: 'Unknown function' };
                    }
                    
                    console.log(`Function ${functionName} result:`, result);
                    
                    // Add function result to messages
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: JSON.stringify(result)
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

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process chat',
            message: error.message
        });
    }
};

module.exports = { chat };
