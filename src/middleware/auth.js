const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expired' });
        }
        
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { authenticateToken };