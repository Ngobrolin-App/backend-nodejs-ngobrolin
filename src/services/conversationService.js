const { Conversation, ConversationParticipant, User, Message, BlockedUser } = require('../models');
const { Op, fn, col, where } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');
const AppError = require('../utils/appError');

class ConversationService {
    /**
     * Check if user is participant in conversation
     */
    static async isParticipant(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });
        return !!participation;
    }

    /**
     * Get all conversations for a user with pagination and formatting
     */
    static async getConversations(userId, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const conversations = await ConversationParticipant.findAndCountAll({
            where: { userId: userId },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                    include: [
                        {
                            model: ConversationParticipant,
                            as: 'participants',
                            include: [
                                {
                                    model: User,
                                    as: 'user',
                                }
                            ]
                        },
                        {
                            model: Message,
                            as: 'messages',
                            limit: 1,
                            order: [['createdAt', 'DESC']],
                            include: [
                                {
                                    model: User,
                                    as: 'sender',
                                }
                            ]
                        }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['joinedAt', 'DESC']]
        });

        // Format response with accurate unread count
        const formattedConversations = await Promise.all(conversations.rows.map(async participant => {
            const conversation = participant.conversation;
            const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
            let privatePartnerUser = null;
            if (conversation.type == 'private') {
                // Gunakan akses indeks [0] dan pastikan aman
                privatePartnerUser = otherParticipants[0]?.user;
            }

            let baselineTime = participant.joinedAt;
            if (participant.lastReadMessageId) {
                const lastReadMsg = await Message.findByPk(participant.lastReadMessageId, { attributes: ['createdAt'] });
                if (lastReadMsg && lastReadMsg.createdAt) {
                    baselineTime = lastReadMsg.createdAt;
                }
            }

            const unreadCount = await Message.count({
                where: {
                    conversationId: conversation.id,
                    createdAt: { [Op.gt]: baselineTime },
                    senderId: { [Op.ne]: userId }
                }
            });

            return {
                ...conversation.toJSON(),
                groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
                privatePartnerUser: (privatePartnerUser) ? {
                    ...privatePartnerUser.toJSON(),
                    avatarUrl: buildAvatarUrl(privatePartnerUser.avatarUrl, baseUrl),
                } : null,
                participants: otherParticipants.map(p => ({
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                })),
                lastMessage: conversation.messages[0] || null,
                joinedAt: participant.joinedAt,
                unreadCount
            };
        }));

        // Sort conversations by last message time (fallback: joinedAt)
        formattedConversations.sort((a, b) => {
            const ta = a.lastMessage?.createdAt || a.joinedAt;
            const tb = b.lastMessage?.createdAt || b.joinedAt;
            return new Date(tb) - new Date(ta);
        });

        return {
            conversations: formattedConversations,
            total: conversations.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(conversations.count / limit)
        };
    }

    static async getPrivateConversationByParticipantsIds(userId, partnerId) {
        if (!partnerId) {
            if (!conversationId) {
                throw new AppError({
                    message: 'partnerid_required',
                    code: 400,
                    statusCode: 'BAD_REQUEST'
                });
            }
        }

        const participantIds = [userId, partnerId];

        const result = await ConversationParticipant.findOne({
            attributes: ['conversationId'],
            where: {
                userId: {
                    [Op.in]: participantIds,
                }
            },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                }

            ],
            group: [
                'conversationId',
                'conversation.id',
                'conversation.type',
                'conversation.name',
                'conversation.groupImage'
            ],
            having: where(
                fn('COUNT', col('conversationId')),
                '=',
                participantIds.length
            )
        });

        return { conversation: result ? result.conversation : null };

    }

    static async getConversationParticipants(userId, conversationId, isIncludeMe = true, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const userWhere = {};

        if (!conversationId) {
            throw new AppError({
                message: 'conversationid_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        if (!isIncludeMe) {
            userWhere.id = {
                [Op.ne]: userId
            };
        }

        const participants = await ConversationParticipant.findAndCountAll({
            where: { conversationId: conversationId },
            include: [
                {
                    model: User,
                    as: 'user',
                    where: userWhere,
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });


        return {
            participants: participants.rows.map(p => ({
                ...p.toJSON(),
                user: {
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                },
            })),
            total: participants.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(participants.count / limit)
        }
    }

    static async getConversationParticipantIds(
        userId,
        conversationId,
        isIncludeMe = true
    ) {
        if (!conversationId) {
            throw new AppError({
                message: 'conversationid_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        const where = {
            conversationId,
        };

        if (!isIncludeMe) {
            where.userId = {
                [Op.ne]: userId,
            };
        }

        const participantRows = await ConversationParticipant.findAll({
            where,
            attributes: ['userId'],
        });

        return participantRows.map(participant => participant.userId);
    }

    /**
     * Create a new conversation
     */
    static async createConversation(userId, data, baseUrl) {
        const { type = 'private', participantId, name, participantIds, groupImage, createdByUserId } = data;

        // For private conversations
        if (type === 'private') {
            if (!participantId) {
                throw new AppError(
                    {
                        message: 'partnerid_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }

            // Check if participant exists
            const participant = await User.findByPk(participantId);
            if (!participant) {
                throw new AppError(
                    {
                        message: 'user_not_found',
                        code: 404,
                        statusCode: 'NOT_FOUND'
                    }
                );
            }

            // Block creating conversation if target account is private and it's not yourself
            if (participant.isPrivate && participant.id !== userId) {
                throw new AppError(
                    {
                        message: 'create_conversation_private_user_failed',
                        code: 403,
                        statusCode: 'FORBIDDEN'
                    }
                );
            }

            // Check if users are blocked
            const isBlocked = await BlockedUser.findOne({
                where: {
                    [Op.or]: [
                        { userId: userId, blockedUserId: participantId },
                        { userId: participantId, blockedUserId: userId }
                    ]
                }
            });

            if (isBlocked) {
                throw new AppError(
                    {
                        message: 'create_conversation_blocked_user_failed',
                        code: 403,
                        statusCode: 'FORBIDDEN'
                    }
                );
            }

            // Check if private conversation already exists
            const existingConversation = await ConversationParticipant.findAll({
                where: {
                    userId: { [Op.in]: [userId, participantId] }
                },
                include: [
                    {
                        model: Conversation,
                        as: 'conversation',
                        where: { type: 'private' }
                    }
                ]
            });

            // Group by conversationId and check if both users are in the same conversation
            const conversationGroups = {};
            existingConversation.forEach(cp => {
                if (!conversationGroups[cp.conversationId]) {
                    conversationGroups[cp.conversationId] = [];
                }
                conversationGroups[cp.conversationId].push(cp.userId);
            });

            for (const convId in conversationGroups) {
                if (conversationGroups[convId].length === 2) {
                    const conversation = existingConversation.find(cp => cp.conversationId === convId).conversation;
                    return {
                        message: 'Conversation already exists',
                        conversation: {
                            id: conversation.id,
                            type: conversation.type,
                            createdAt: conversation.createdAt
                        },
                        isExisting: true
                    };
                }
            }
        }
        if (type === 'group') {
            if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
                throw new AppError(
                    {
                        message: 'participantids_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }
            if (!createdByUserId) {
                throw new AppError(
                    {
                        message: 'createdbyuserid_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }
        }


        // Create conversation
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            groupImage: type === 'group' ? groupImage : null,
            createdByUserId: createdByUserId
        });

        let uniqueParticipantsToInsert = [];

        if (type === 'private') {
            uniqueParticipantsToInsert = [userId, participantId];
        } else if (type === 'group') {
            uniqueParticipantsToInsert = [...new Set([userId, ...participantIds])];
        }

        console.log('ConversationService - createConversation() uniqueParticipantsToInsert:', uniqueParticipantsToInsert);

        await Promise.all(
            uniqueParticipantsToInsert.map(uid =>
                ConversationParticipant.create({
                    conversationId: conversation.id,
                    userId: uid
                })
            )
        );

        const userData = await User.findByPk(userId);

        if (conversation.type == 'group') {
            const systemMessage = await Message.create({
                conversationId: conversation.id,
                senderId: userId,
                type: 'system',
                content: `${userData.name} created a group chat`,
                systemEventType: 'GROUP_CREATED',
                systemMetadata: {
                    actorId: userData.id,
                    actorName: userData.name,
                    conversationId: conversation.id,
                    groupName: conversation.name,
                }
            });
        }

        // Get participant details for real-time event
        const participantRows = await ConversationParticipant.findAll({
            where: { conversationId: conversation.id },
            include: [
                {
                    model: User,
                    as: 'user',
                }
            ]
        });

        const finalConversation = {
            ...conversation.toJSON(),
            groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
            participants: participantRows.map(p => ({
                ...p.user.toJSON(),
                avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
            })),
            createdAt: conversation.createdAt
        };

        return {
            message: 'create_conversation_success',
            conversation: finalConversation,
            isExisting: false,
        };
    }

    /**
     * Get conversation by ID
     */
    static async getConversationById(conversationId, userId, isShowParticipants = true, isParticipantsIncludeMe = true, baseUrl) {
        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                message: 'access_denied',
                code: 403,
                statusCode: 'FORBIDDEN',
            });
        }

        const userWhere = {};
        if (!isParticipantsIncludeMe) {
            userWhere.id = {
                [Op.ne]: userId
            };
        }

        const conversation = await Conversation.findByPk(conversationId, {
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                },
                ...(isShowParticipants
                    ? [{
                        model: ConversationParticipant,
                        as: 'participants',
                        include: [
                            {
                                model: User,
                                as: 'user',
                                where: userWhere,
                            }
                        ]
                    }]
                    : [])
            ]
        });

        if (!conversation) {
            throw new AppError({
                message: 'conversation_not_found',
                code: 404,
                statusCode: 'NOT_FOUND',
            });
        }

        let result = conversation.toJSON();

        result.groupImage = conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null;
        if (result.createdByUser) {
            result.createdByUser = {
                ...conversation.createdByUser.toJSON(),
                avatarUrl: conversation.createdByUser.avatarUrl ?
                    buildAvatarUrl(conversation.createdByUser.avatarUrl, baseUrl)
                    : null,
            };
        }
        if (isShowParticipants && conversation.participants) {
            result.participants = conversation.participants.map(p => ({
                ...p.user.toJSON(),
                avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
            }));
        }

        return result;
    }

    /**
     * Update conversation (group)
     */
    static async updateConversation(conversationId, userId, data) {
        const { name, groupImage } = data;

        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                message: 'access_denied',
                code: 403,
                statusCode: 'FORBIDDEN',
            });
        }

        const conversation = await Conversation.findByPk(conversationId);

        if (!conversation) {
            throw new AppError({
                message: 'conversation_not_found',
                code: 404,
                statusCode: 'NOT_FOUND',
            });
        }

        if (conversation.type !== 'group') {
            throw new AppError({
                message: 'can_only_update_group_conversations',
                code: 400,
                statusCode: 'BAD_REQUEST',
            });
        }

        // Update conversation
        await conversation.update({
            name: name || conversation.name,
            groupImage: groupImage !== undefined ? groupImage : conversation.groupImage
        });

        return conversation;
    }

    /**
     * Leave conversation
     */
    static async leaveConversation(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                message: 'you_are_not_a_participant',
                code: 404,
                statusCode: 'NOT_FOUND',
            });
        }

        await participation.destroy();

        // Check if conversation has no participants left
        const remainingParticipants = await ConversationParticipant.count({
            where: { conversationId: conversationId }
        });

        if (remainingParticipants === 0) {
            // Delete conversation if no participants left
            await Conversation.destroy({
                where: { id: conversationId }
            });
        }

        return true;
    }
}

module.exports = ConversationService;
