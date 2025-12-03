const { User, BlockedUser } = require('../models');
const { Op } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');

class UserService {
    /**
     * Search users
     */
    static async searchUsers(currentUserId, query, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        let whereClause = {
            id: { [Op.ne]: currentUserId } // Exclude current user
        };

        // Add search query if provided
        if (query && query.trim()) {
            whereClause = {
                ...whereClause,
                [Op.or]: [
                    { username: { [Op.iLike]: `%${query.trim()}%` } },
                    { name: { [Op.iLike]: `%${query.trim()}%` } }
                ]
            };
        }

        // Get blocked users to exclude them
        const blockedUsers = await BlockedUser.findAll({
            where: {
                [Op.or]: [
                    { user_id: currentUserId },
                    { blocked_user_id: currentUserId }
                ]
            }
        });

        const blockedUserIds = blockedUsers.map(block =>
            block.user_id === currentUserId ? block.blocked_user_id : block.user_id
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

        return {
            users: users.rows.map(u => ({ ...u.toJSON(), avatarUrl: buildAvatarUrl(u.avatarUrl, baseUrl) })),
            total: users.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(users.count / limit)
        };
    }

    /**
     * Get user by ID
     */
    static async getUserById(currentUserId, targetUserId, baseUrl) {
        // Check if user is blocked
        const isBlocked = await BlockedUser.findOne({
            where: {
                [Op.or]: [
                    { user_id: currentUserId, blocked_user_id: targetUserId },
                    { user_id: targetUserId, blocked_user_id: currentUserId }
                ]
            }
        });

        if (isBlocked) {
            const error = new Error('User is blocked');
            error.statusCode = 403;
            throw error;
        }

        const user = await User.findByPk(targetUserId, {
            attributes: ['id', 'username', 'name', 'bio', 'avatarUrl', 'isPrivate']
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        return { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) };
    }

    /**
     * Block user
     */
    static async blockUser(currentUserId, targetUserId) {
        if (targetUserId === currentUserId) {
            const error = new Error('Cannot block yourself');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const userToBlock = await User.findByPk(targetUserId);
        if (!userToBlock) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if already blocked
        const existingBlock = await BlockedUser.findOne({
            where: {
                user_id: currentUserId,
                blocked_user_id: targetUserId
            }
        });

        if (existingBlock) {
            const error = new Error('User is already blocked');
            error.statusCode = 400;
            throw error;
        }

        // Create block
        await BlockedUser.create({
            user_id: currentUserId,
            blocked_user_id: targetUserId
        });

        return true;
    }

    /**
     * Unblock user
     */
    static async unblockUser(currentUserId, targetUserId) {
        const blockedUser = await BlockedUser.findOne({
            where: {
                user_id: currentUserId,
                blocked_user_id: targetUserId
            }
        });

        if (!blockedUser) {
            const error = new Error('User is not blocked');
            error.statusCode = 404;
            throw error;
        }

        await blockedUser.destroy();

        return true;
    }

    /**
     * Get blocked users
     */
    static async getBlockedUsers(currentUserId, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const blockedUsers = await BlockedUser.findAndCountAll({
            where: { user_id: currentUserId },
            include: [{
                model: User,
                as: 'blockedUser',
                attributes: ['id', 'username', 'name', 'avatarUrl']
            }],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        return {
            blockedUsers: blockedUsers.rows.map(b => ({
                ...b.toJSON(),
                blockedUser: {
                    ...b.blockedUser.toJSON(),
                    avatarUrl: buildAvatarUrl(b.blockedUser.avatarUrl, baseUrl),
                }
            })),
            total: blockedUsers.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(blockedUsers.count / limit)
        };
    }
}

module.exports = UserService;
