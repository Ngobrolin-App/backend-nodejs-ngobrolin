const { validationResult } = require('express-validator');
const UserService = require('../services/userService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

class UserController {
    // Search users
    static async searchUsers(req, res) {
        try {
            const { q, page = 1, limit = 20 } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await UserService.searchUsers(
                req.user.userId,
                q,
                baseUrl,
                page,
                limit
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: {
                    users: result.users,
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }
            });
        } catch (error) {
            console.error('UserController - searchUsers() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Get user by ID
    static async getUserById(req, res) {
        try {
            const { userId } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const user = await UserService.getUserById(
                req.user.userId,
                userId,
                baseUrl
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: user
            });
        } catch (error) {
            console.error('UserController - getUserById() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Block user
    static async blockUser(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const { userId } = req.body;

            await UserService.blockUser(req.user.userId, userId);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'user_blocked_successfully'
            });
        } catch (error) {
            console.error('UserController - blockUser() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Unblock user
    static async unblockUser(req, res) {
        try {
            const { userId } = req.body;

            await UserService.unblockUser(req.user.userId, userId);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'user_unblocked_successfully'
            });
        } catch (error) {
            console.error('UserController - unblockUser() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Get blocked users
    static async getBlockedUsers(req, res) {
        try {
            const { page = 1, limit = 20 } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await UserService.getBlockedUsers(
                req.user.userId,
                baseUrl,
                page,
                limit
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: {
                    blockedUsers: result.blockedUsers,
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }
            });
        } catch (error) {
            console.error('Get blocked users error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }
}

module.exports = UserController;
