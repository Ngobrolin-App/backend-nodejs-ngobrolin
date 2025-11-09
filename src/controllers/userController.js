const { User, BlockedUser } = require('../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

function buildAvatarUrl(path, req) {
    if (!path) return null;
    const base = `${req.protocol}://${req.get('host')}`;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
}

class UserController {
    // Search users
    static async searchUsers(req, res) {
        try {
            const { q, page = 1, limit = 20 } = req.body;
            const offset = (page - 1) * limit;

            let whereClause = {
                id: { [Op.ne]: req.user.userId } // Exclude current user
            };

            // Add search query if provided
            if (q && q.trim()) {
                whereClause = {
                    ...whereClause,
                    [Op.or]: [
                        { username: { [Op.iLike]: `%${q.trim()}%` } },
                        { name: { [Op.iLike]: `%${q.trim()}%` } }
                    ]
                };
            }

            // Get blocked users to exclude them
            const blockedUsers = await BlockedUser.findAll({
                where: {
                    [Op.or]: [
                        { user_id: req.user.userId },
                        { blocked_user_id: req.user.userId }
                    ]
                }
            });

            const blockedUserIds = blockedUsers.map(block => 
                block.user_id === req.user.userId ? block.blocked_user_id : block.user_id
            );

            if (blockedUserIds.length > 0) {
                whereClause.id = {
                    ...whereClause.id,
                    [Op.notIn]: blockedUserIds
                };
            }

            const users = await User.findAndCountAll({
                where: whereClause,
                attributes: ['id', 'username', 'name', 'bio', 'avatarUrl', 'isPrivate'],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['name', 'ASC']]
            });

            res.json({
                users: users.rows.map(u => ({ ...u.toJSON(), avatarUrl: buildAvatarUrl(u.avatarUrl, req) })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: users.count,
                    totalPages: Math.ceil(users.count / limit)
                }
            });
        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Get user by ID
    static async getUserById(req, res) {
        try {
            const { userId } = req.body;

            // Check if user is blocked
            const isBlocked = await BlockedUser.findOne({
                where: {
                    [Op.or]: [
                        { user_id: req.user.userId, blocked_user_id: userId },
                        { user_id: userId, blocked_user_id: req.user.userId }
                    ]
                }
            });

            if (isBlocked) {
                return res.status(403).json({
                    error: 'User is blocked'
                });
            }

            const user = await User.findByPk(userId, {
                attributes: ['id', 'username', 'name', 'bio', 'avatarUrl', 'isPrivate']
            });

            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            res.json({ user: { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, req) } });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                error: 'Internal server error'
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

            if (userId === req.user.userId) {
                return res.status(400).json({
                    error: 'Cannot block yourself'
                });
            }

            // Check if user exists
            const userToBlock = await User.findByPk(userId);
            if (!userToBlock) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            // Check if already blocked
            const existingBlock = await BlockedUser.findOne({
                where: {
                    user_id: req.user.userId,
                    blocked_user_id: userId
                }
            });

            if (existingBlock) {
                return res.status(400).json({
                    error: 'User is already blocked'
                });
            }

            // Create block
            await BlockedUser.create({
                user_id: req.user.userId,
                blocked_user_id: userId
            });

            res.json({
                message: 'User blocked successfully'
            });
        } catch (error) {
            console.error('Block user error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Unblock user
    static async unblockUser(req, res) {
        try {
            const { userId } = req.body;

            const blockedUser = await BlockedUser.findOne({
                where: {
                    user_id: req.user.userId,
                    blocked_user_id: userId
                }
            });

            if (!blockedUser) {
                return res.status(404).json({
                    error: 'User is not blocked'
                });
            }

            await blockedUser.destroy();

            res.json({
                message: 'User unblocked successfully'
            });
        } catch (error) {
            console.error('Unblock user error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Get blocked users
    static async getBlockedUsers(req, res) {
        try {
            const { page = 1, limit = 20 } = req.body;
            const offset = (page - 1) * limit;

            const blockedUsers = await BlockedUser.findAndCountAll({
                where: { user_id: req.user.userId },
                include: [{
                    model: User,
                    as: 'blockedUser',
                    attributes: ['id', 'username', 'name', 'avatarUrl']
                }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            res.json({
                blockedUsers: blockedUsers.rows.map(b => ({
                    ...b.toJSON(),
                    blockedUser: {
                        ...b.blockedUser.toJSON(),
                        avatarUrl: buildAvatarUrl(b.blockedUser.avatarUrl, req),
                    }
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: blockedUsers.count,
                    totalPages: Math.ceil(blockedUsers.count / limit)
                }
            });
        } catch (error) {
            console.error('Get blocked users error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }
}

module.exports = UserController;