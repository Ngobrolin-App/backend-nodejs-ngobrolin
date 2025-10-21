const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all users (for search)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT id, username, name, bio, avatarUrl FROM tbluser WHERE id != $1';
        let params = [req.user.id];

        if (search) {
            query += ' AND (username ILIKE $2 OR name ILIKE $2)';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY name LIMIT 50';

        const users = await pool.query(query, params);
        res.json(users.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, username, name, bio, avatarUrl, language, isPrivate FROM tbluser WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user.rows[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;