const { validationResult } = require('express-validator');
const UserService = require('../services/userService');

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

            res.json({
                users: result.users,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Search users error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
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

            res.json({ user });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Block user
    static async blockUser(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { userId } = req.body;

            await UserService.blockUser(req.user.userId, userId);

            res.json({
                message: 'User blocked successfully'
            });
        } catch (error) {
            console.error('Block user error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Unblock user
    static async unblockUser(req, res) {
        try {
            const { userId } = req.body;

            await UserService.unblockUser(req.user.userId, userId);

            res.json({
                message: 'User unblocked successfully'
            });
        } catch (error) {
            console.error('Unblock user error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
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

            res.json({
                blockedUsers: result.blockedUsers,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get blocked users error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = UserController;
