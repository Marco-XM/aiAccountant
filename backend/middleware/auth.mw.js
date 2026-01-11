const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ message: 'Access Denied. No authorization header provided.' });
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Access Denied. No token provided.' });
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'a2bec79f51d4bc62954b6e7453870bf5a270bd742cf1b14096818384ea4b5163ac8c62a87a0843904bcaf2b6ec29efe0d4fd8b12401130ba250e69e14c14749c';

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        res.status(400).json({ message: 'Invalid token.', error: err.message });
    }
};

module.exports = authMiddleware;