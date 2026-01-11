const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const calculateBoxes = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                error: 'Message is required'
            });
        }

        // Get the generative model (using free model)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Create a prompt for box calculation
        const prompt = `
        You are a logistics expert. Based on the following message about items/goods that need to be packed, 
        calculate how many boxes are needed. Consider standard box sizes and efficient packing.
        
        Message: "${message}"
        
        Please respond with ONLY a JSON object in this exact format:
        {
            "numberOfBoxes": [number],
            "reasoning": "[brief explanation of your calculation]",
            "boxSize": "[recommended box size like 'small', 'medium', 'large']"
        }
        
        Do not include any other text or explanation outside the JSON.
        `;

        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Try to parse JSON from the response
        let geminiResponse;
        try {
            // Clean the response text and extract JSON
            const cleanedText = text.trim().replace(/```json|```/g, '');
            geminiResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            // If parsing fails, create a fallback response
            console.error('Failed to parse Gemini response:', parseError);
            geminiResponse = {
                numberOfBoxes: 1,
                reasoning: "Unable to parse AI response, defaulting to 1 box",
                boxSize: "medium"
            };
        }

        // Ensure the response has the required fields
        const finalResponse = {
            numberOfBoxes: geminiResponse.numberOfBoxes || 1,
            reasoning: geminiResponse.reasoning || "Calculated based on item description",
            boxSize: geminiResponse.boxSize || "medium",
            originalMessage: message
        };

        res.status(200).json(finalResponse);

    } catch (error) {
        console.error('Error calculating boxes with Gemini:', error);
        res.status(500).json({
            error: 'Failed to calculate box requirements',
            message: error.message
        });
    }
};

module.exports = {
    calculateBoxes
};