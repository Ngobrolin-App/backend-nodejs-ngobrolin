const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get user conversations
router.get('/', authenticateToken, async (req, res) => {
    try {
        const conversations = await pool.query(`
      SELECT DISTINCT c.id, c.type, c.name, c.created_at,
             u.id as partner_id, u.username as partner_username, u.name as partner_name,
             u.avatarUrl as partner_avatar
      FROM tblconversations c
      JOIN tblconversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN tblconversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
      LEFT JOIN tbluser u ON cp2.user_id = u.id
      WHERE cp.user_id = $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);

        res.json(conversations.rows);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;