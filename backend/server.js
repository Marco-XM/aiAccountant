const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');

/* Import Routes */
const authRoutes = require('./routes/authRoutes');
const geminiRoutes = require('./routes/geminiRoutes');
const excelRoutes = require('./routes/excelRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const aiExcelRoutes = require('./routes/aiExcelRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const chatRoutes = require('./routes/chatRoutes');
const chartRoutes = require('./routes/chartRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Database Connected Successfully'))
    .catch((err) => console.error('Faild to connect to database Reason: ', err));


app.use(cors({
    origin: ['https://localhost:5173', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

app.use(express.json());

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api', geminiRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai-excel', aiExcelRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/charts', chartRoutes);

app.get('/', (req, res) => {
    res.send('Backend is Working Correctly');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;