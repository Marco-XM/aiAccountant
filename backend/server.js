const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');

/* Import Routes */
const authRoutes = require('./routes/authRoutes');

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

app.get('/', (req, res) => {
    res.send('Backend is Working Correctly');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;