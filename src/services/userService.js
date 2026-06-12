const { User, BlockedUser } = require('../models');
const { Op } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');

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
                    { userId: currentUserId },
                    { blockedUserId: currentUserId }
                ]
            }
        });

        const blockedUserIds = blockedUsers.map(block =>
            block.userId === currentUserId ? block.blockedUserId : block.userId
        );

        if (blockedUserIds.length > 0) {
            whereClause.id = {
                ...whereClause.id,
                [Op.notIn]: blockedUserIds
            };
        }

        const users = await User.findAndCountAll({
            where: whereClause,
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
                    { userId: currentUserId, blockedUserId: targetUserId },
                    { userId: targetUserId, blockedUserId: currentUserId }
                ]
            }
        });

        if (isBlocked) {
            throw new AppError({
                message: 'user_is_blocked',
                code: 403,
                statusCode: 'FORBIDDEN'
            });
        }

        const user = await User.findByPk(targetUserId);

        if (!user) {
            throw new AppError({
                message: 'user_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        return { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) };
    }

    /**
     * Block user
     */
    static async blockUser(currentUserId, targetUserId) {
        if (targetUserId === currentUserId) {
            throw new AppError({
                message: 'cannot_block_yourself',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // Check if user exists
        const userToBlock = await User.findByPk(targetUserId);
        if (!userToBlock) {
            throw new AppError({
                message: 'user_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        // Check if already blocked
        const existingBlock = await BlockedUser.findOne({
            where: {
                userId: currentUserId,
                blockedUserId: targetUserId
            }
        });

        if (existingBlock) {
            throw new AppError({
                message: 'user_already_blocked',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // Create block
        await BlockedUser.create({
            userId: currentUserId,
            blockedUserId: targetUserId
        });

        return true;
    }

    /**
     * Unblock user
     */
    static async unblockUser(currentUserId, targetUserId) {
        const blockedUser = await BlockedUser.findOne({
            where: {
                userId: currentUserId,
                blockedUserId: targetUserId
            }
        });

        if (!blockedUser) {
            throw new AppError({
                message: 'user_is_not_blocked',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
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
            where: { userId: currentUserId },
            include: [{
                model: User,
                as: 'blockedUser',
            }],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        return {
            blockedUsers: blockedUsers.rows.map(b => ({
                ...b.blockedUser.toJSON(),
                avatarUrl: buildAvatarUrl(b.blockedUser.avatarUrl, baseUrl),
            })),
            total: blockedUsers.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(blockedUsers.count / limit)
        };
    }
}

module.exports = UserService;
