const { validationResult } = require('express-validator');
const UserService = require('../services/userService');
const ConversationService = require('../services/conversationService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');

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

            const { userId: targetUserId } = req.body;
            const currentUserId = req.user.userId;

            await UserService.blockUser(currentUserId, targetUserId);

            // Check if they have an existing private conversation
            const conversationId = await ConversationService.getPrivateConversationId(currentUserId, targetUserId);

            // If there is a conversation, emit a realtime event via Socket.io to update the UI
            if (conversationId && req.io) {
                // Notify blocker (eg: to update chat icon/status)
                req.io.to(`conversation_${conversationId}`).emit('block_status_updated', {
                    conversationId: conversationId,
                });
            }

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
            const { userId: targetUserId } = req.body;
            const currentUserId = req.user.userId;

            await UserService.unblockUser(currentUserId, targetUserId);

            // Check if they have a private conversation
            const conversationId = await ConversationService.getPrivateConversationId(currentUserId, targetUserId);

            // If there is a conversation, emit a realtime event via Socket.io
            if (conversationId && req.io) {
                req.io.to(`conversation_${conversationId}`).emit('block_status_updated', {
                    conversationId: conversationId,
                });
            }

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

    static async getBlockUserStatus(req, res) {
        try {
            const { userId } = req.body;

            const result = await UserService.getBlockUserStatus(req.user.userId, userId);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'block_status_retrieved_success',
                data: result,
            });
        } catch (error) {
            console.error('UserController - blockedUserStatus() error:', error);
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
