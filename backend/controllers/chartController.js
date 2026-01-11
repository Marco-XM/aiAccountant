const Groq = require('groq-sdk');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const generateChart = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { query } = req.body;
        const userId = req.user._id;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Chart generation request:', query);

        // Step 1: Use AI to determine what data to fetch
        const analysisPrompt = `
You are a financial data analyst. Analyze this user query and determine what data to fetch and how to visualize it.

User Query: "${query}"

Respond with a JSON object ONLY (no markdown, no explanation):
{
  "chartType": "bar|line|pie|donut|area|composed",
  "dataQuery": {
    "type": "income|expense|both",
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null",
    "groupBy": "category|month|type|null",
    "sortBy": "amount|date|count",
    "limit": number or null
  },
  "title": "Chart title",
  "xAxisLabel": "X axis label",
  "yAxisLabel": "Y axis label"
}

Guidelines:
- Use "bar" for simple comparisons
- Use "line" for trends over time
- Use "pie" for proportions/percentages
- Use "donut" when user says "donut" or for cleaner proportion visualization
- Use "area" for cumulative trends
- Use "composed" for comparing two different metrics (e.g., income vs expenses)
- If query mentions months/time: groupBy "month"
- If query mentions categories: groupBy "category"
- If query mentions "vs" or "comparison": use "composed" type
- If query mentions top N: set limit to N
- Current date is ${new Date().toISOString().split('T')[0]}
- For "last 6 months": calculate startDate as 6 months ago
- For Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
            max_tokens: 500
        });

        let analysisResult;
        try {
            const responseText = completion.choices[0].message.content.trim();
            const cleanedText = responseText.replace(/```json|```/g, '').trim();
            analysisResult = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('Failed to parse AI analysis:', parseError);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        console.log('AI Analysis:', analysisResult);

        // Step 2: Fetch the data from database
        const dataQuery = analysisResult.dataQuery;
        const matchFilter = { userId: new mongoose.Types.ObjectId(userId) };

        if (dataQuery.startDate && dataQuery.endDate) {
            matchFilter.date = {
                $gte: new Date(dataQuery.startDate),
                $lte: new Date(dataQuery.endDate)
            };
        }

        if (dataQuery.type && dataQuery.type !== 'both') {
            matchFilter.type = dataQuery.type;
        }

        let chartData = [];

        if (dataQuery.groupBy) {
            // Aggregation query
            let groupField;
            if (dataQuery.groupBy === 'category') {
                groupField = '$category';
            } else if (dataQuery.groupBy === 'month') {
                groupField = { $month: '$date' };
            } else if (dataQuery.groupBy === 'type') {
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
                },
                { $sort: dataQuery.sortBy === 'amount' ? { total: -1 } : { count: -1 } }
            ];

            if (dataQuery.limit) {
                pipeline.push({ $limit: parseInt(dataQuery.limit) });
            }

            const results = await Transaction.aggregate(pipeline);
            
            chartData = results.map(r => {
                let name = r._id;
                if (dataQuery.groupBy === 'month') {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    name = monthNames[r._id - 1];
                }
                return {
                    name,
                    amount: r.total,
                    count: r.count
                };
            });
        } else {
            // Simple query
            const transactions = await Transaction.find(matchFilter)
                .sort({ date: -1 })
                .limit(dataQuery.limit || 100);

            chartData = transactions.map(t => ({
                name: t.category,
                date: t.date.toISOString().split('T')[0],
                amount: t.amount
            }));
        }

        // Step 3: Format data for the chart type
        let formattedData;
        let xKey, yKeys, valueKey, nameKey;

        switch (analysisResult.chartType) {
            case 'pie':
            case 'donut':
                formattedData = chartData;
                valueKey = 'amount';
                nameKey = 'name';
                break;

            case 'composed':
                // For composed charts, we need both income and expense data
                if (dataQuery.type === 'both' && dataQuery.groupBy === 'month') {
                    // Group by month and type to get income and expenses separately
                    const pipeline = [
                        { $match: matchFilter },
                        {
                            $group: {
                                _id: {
                                    month: { $month: '$date' },
                                    type: '$type'
                                },
                                total: { $sum: '$amount' }
                            }
                        },
                        { $sort: { '_id.month': 1 } }
                    ];

                    const results = await Transaction.aggregate(pipeline);
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    
                    // Organize data by month
                    const monthData = {};
                    results.forEach(r => {
                        const month = monthNames[r._id.month - 1];
                        if (!monthData[month]) {
                            monthData[month] = { name: month, income: 0, expenses: 0 };
                        }
                        if (r._id.type === 'income') {
                            monthData[month].income = r.total;
                        } else if (r._id.type === 'expense') {
                            monthData[month].expenses = r.total;
                        }
                    });

                    formattedData = Object.values(monthData);
                    xKey = 'name';
                    yKeys = ['income', 'expenses'];
                } else {
                    formattedData = chartData;
                    xKey = 'name';
                    yKeys = ['amount'];
                }
                break;

            case 'bar':
            case 'line':
            case 'area':
                formattedData = chartData;
                xKey = 'name';
                yKeys = ['amount'];
                break;

            default:
                formattedData = chartData;
                xKey = 'name';
                yKeys = ['amount'];
        }

        // Step 4: Generate explanation
        const explanationPrompt = `
Analyze this financial data and provide a brief, insightful explanation in 2-3 sentences.

Query: "${query}"
Chart Type: ${analysisResult.chartType}
Data: ${JSON.stringify(chartData.slice(0, 10))}

Provide insights about:
- Key findings or trends
- Notable patterns
- Recommendations if applicable

Be concise and professional.`;

        const explanationCompletion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: explanationPrompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        const explanation = explanationCompletion.choices[0].message.content.trim();

        res.json({
            chartConfig: {
                type: analysisResult.chartType,
                title: analysisResult.title,
                data: formattedData,
                xKey,
                yKeys,
                valueKey,
                nameKey,
                xAxisLabel: analysisResult.xAxisLabel,
                yAxisLabel: analysisResult.yAxisLabel
            },
            explanation: explanation
        });

    } catch (error) {
        console.error('Error generating chart:', error);
        res.status(500).json({
            error: 'Failed to generate chart',
            details: error.message
        });
    }
};

module.exports = { generateChart };
