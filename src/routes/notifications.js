const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { FCMToken } = require('../models');
const { validationResult } = require('express-validator');

const router = express.Router();

const registerValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token is required')
        .isString()
        .withMessage('Token must be a string'),
];

router.post('/token/register', authenticateToken, registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { token } = req.body;

        const existing = await FCMToken.findOne({ where: { token } });
        if (existing) {
            if (existing.user_id !== req.user.userId) {
                await existing.update({ user_id: req.user.userId });
            }
        } else {
            await FCMToken.create({ user_id: req.user.userId, token });
        }

        return res.json({ message: 'FCM token registered' });
    } catch (error) {
        console.error('Register FCM token error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/token/delete', authenticateToken, registerValidation, async (req, res) => {
    try {
        const { token } = req.body;
        await FCMToken.destroy({ where: { token, user_id: req.user.userId } });
        return res.json({ message: 'FCM token deleted' });
    } catch (error) {
        console.error('Delete FCM token error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;