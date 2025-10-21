const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get messages for a conversation
router.get('/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Check if user is participant
        const participant = await pool.query(
            'SELECT id FROM tblconversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, req.user.id]
        );

        if (participant.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await pool.query(`
      SELECT m.id, m.content, m.type, m.created_at,
             u.id as sender_id, u.username as sender_username, u.name as sender_name
      FROM tblmessages m
      JOIN tbluser u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);

        res.json(messages.rows);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;