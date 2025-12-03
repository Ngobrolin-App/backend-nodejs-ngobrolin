const { validationResult } = require('express-validator');
const NotificationService = require('../services/notificationService');

class NotificationController {
    // Register FCM token
    static async registerToken(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { token } = req.body;
            const result = await NotificationService.registerToken(req.user.userId, token);

            res.json(result);
        } catch (error) {
            console.error('Register FCM token error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Delete FCM token
    static async deleteToken(req, res) {
        try {
            const { token } = req.body;
            const result = await NotificationService.deleteToken(req.user.userId, token);

            res.json(result);
        } catch (error) {
            console.error('Delete FCM token error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = NotificationController;