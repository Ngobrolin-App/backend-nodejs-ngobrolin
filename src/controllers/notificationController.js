const { validationResult } = require('express-validator');
const NotificationService = require('../services/notificationService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
class NotificationController {
    // Register FCM token
    static async registerToken(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError(
                    {
                        code: 400,
                        statusCode: 'BAD_REQUEST',
                        message: 'validation_failed',
                        errors: errors.array(),
                    }
                );
            }

            const { token } = req.body;
            const result = await NotificationService.registerToken(req.user.userId, token);

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: result.mesage,
            });
        } catch (error) {
            console.error('NotificationController - registerToken() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Delete FCM token
    static async deleteToken(req, res) {
        try {
            const { token } = req.body;
            const result = await NotificationService.deleteToken(req.user.userId, token);

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: result.mesage,
            });
        } catch (error) {
            console.error('NotificationController - deleteToken() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }
}

module.exports = NotificationController;