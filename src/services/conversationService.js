const { Conversation, ConversationParticipant, User, Message, BlockedUser } = require('../models');
const { Op } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');

class ConversationService {
    /**
     * Check if user is participant in conversation
     */
    static async isParticipant(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversation_id: conversationId,
                user_id: userId
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
            where: { user_id: userId },
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
                                    attributes: ['id', 'username', 'name', 'avatarUrl', 'isPrivate']
                                }
                            ]
                        },
                        {
                            model: Message,
                            as: 'messages',
                            limit: 1,
                            order: [['created_at', 'DESC']],
                            include: [
                                {
                                    model: User,
                                    as: 'sender',
                                    attributes: ['id', 'username', 'name']
                                }
                            ]
                        }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['joined_at', 'DESC']]
        });

        // Format response with accurate unread count
        const formattedConversations = await Promise.all(conversations.rows.map(async participant => {
            const conversation = participant.conversation;
            const otherParticipants = conversation.participants.filter(p => p.user_id !== userId);

            let baselineTime = participant.joined_at;
            if (participant.last_read_message_id) {
                const lastReadMsg = await Message.findByPk(participant.last_read_message_id, { attributes: ['created_at'] });
                if (lastReadMsg && lastReadMsg.created_at) {
                    baselineTime = lastReadMsg.created_at;
                }
            }

            const unreadCount = await Message.count({
                where: {
                    conversation_id: conversation.id,
                    created_at: { [Op.gt]: baselineTime },
                    sender_id: { [Op.ne]: userId }
                }
            });

            return {
                id: conversation.id,
                type: conversation.type,
                name: conversation.name,
                group_image: conversation.group_image,
                participants: otherParticipants.map(p => ({
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                })),
                lastMessage: conversation.messages[0] || null,
                joined_at: participant.joined_at,
                last_read_message_id: participant.last_read_message_id,
                unreadCount
            };
        }));

        // Sort conversations by last message time (fallback: joined_at)
        formattedConversations.sort((a, b) => {
            const ta = a.lastMessage?.created_at || a.joined_at;
            const tb = b.lastMessage?.created_at || b.joined_at;
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

    /**
     * Create a new conversation
     */
    static async createConversation(userId, data, baseUrl) {
        const { participantId, type = 'private', name, group_image } = data;

        // For private conversations
        if (type === 'private') {
            if (!participantId) {
                throw new Error('Participant ID is required for private conversations');
            }

            // Check if participant exists
            const participant = await User.findByPk(participantId);
            if (!participant) {
                const error = new Error('Participant not found');
                error.statusCode = 404;
                throw error;
            }

            // Block creating conversation if target account is private and it's not yourself
            if (participant.isPrivate && participant.id !== userId) {
                const error = new Error('Cannot create conversation with private account');
                error.statusCode = 403;
                throw error;
            }

            // Check if users are blocked
            const isBlocked = await BlockedUser.findOne({
                where: {
                    [Op.or]: [
                        { user_id: userId, blocked_user_id: participantId },
                        { user_id: participantId, blocked_user_id: userId }
                    ]
                }
            });

            if (isBlocked) {
                const error = new Error('Cannot create conversation with blocked user');
                error.statusCode = 403;
                throw error;
            }

            // Check if private conversation already exists
            const existingConversation = await ConversationParticipant.findAll({
                where: {
                    user_id: { [Op.in]: [userId, participantId] }
                },
                include: [
                    {
                        model: Conversation,
                        as: 'conversation',
                        where: { type: 'private' }
                    }
                ]
            });

            // Group by conversation_id and check if both users are in the same conversation
            const conversationGroups = {};
            existingConversation.forEach(cp => {
                if (!conversationGroups[cp.conversation_id]) {
                    conversationGroups[cp.conversation_id] = [];
                }
                conversationGroups[cp.conversation_id].push(cp.user_id);
            });

            for (const convId in conversationGroups) {
                if (conversationGroups[convId].length === 2) {
                    const conversation = existingConversation.find(cp => cp.conversation_id === convId).conversation;
                    return {
                        message: 'Conversation already exists',
                        conversation: {
                            id: conversation.id,
                            type: conversation.type,
                            created_at: conversation.created_at
                        },
                        isExisting: true
                    };
                }
            }
        }

        // Create conversation
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            group_image: type === 'group' ? group_image : null
        });

        // Add participants
        const participants = [userId];
        if (type === 'private' && participantId) {
            participants.push(participantId);
        }

        await Promise.all(
            participants.map(uid =>
                ConversationParticipant.create({
                    conversation_id: conversation.id,
                    user_id: uid
                })
            )
        );

        // Get participant details for real-time event
        const participantRows = await ConversationParticipant.findAll({
            where: { conversation_id: conversation.id },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'name', 'avatarUrl', 'isPrivate']
                }
            ]
        });

        const payload = {
            conversation: {
                id: conversation.id,
                type: conversation.type,
                name: conversation.name,
                group_image: conversation.group_image,
                participants: participantRows.map(p => ({
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                })),
                created_at: conversation.created_at
            }
        };

        return {
            message: 'Conversation created successfully',
            conversation: {
                id: conversation.id,
                type: conversation.type,
                name: conversation.name,
                group_image: conversation.group_image,
                created_at: conversation.created_at
            },
            isExisting: false,
            participants: participants, // List of user IDs
            payload: payload // Full payload for socket
        };
    }

    /**
     * Get conversation by ID
     */
    static async getConversationById(conversationId, userId, baseUrl) {
        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversation_id: conversationId,
                user_id: userId
            }
        });

        if (!participation) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }

        const conversation = await Conversation.findByPk(conversationId, {
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'name', 'avatarUrl', 'isPrivate']
                        }
                    ]
                }
            ]
        });

        if (!conversation) {
            const error = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        return {
            id: conversation.id,
            type: conversation.type,
            name: conversation.name,
            group_image: conversation.group_image,
            participants: conversation.participants.map(p => ({
                ...p.user.toJSON(),
                avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
            })),
            created_at: conversation.created_at
        };
    }

    /**
     * Update conversation (group)
     */
    static async updateConversation(conversationId, userId, data) {
        const { name, group_image } = data;

        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversation_id: conversationId,
                user_id: userId
            }
        });

        if (!participation) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }

        const conversation = await Conversation.findByPk(conversationId);

        if (!conversation) {
            const error = new Error('Conversation not found');
            error.statusCode = 404;
            throw error;
        }

        if (conversation.type !== 'group') {
            const error = new Error('Can only update group conversations');
            error.statusCode = 400;
            throw error;
        }

        // Update conversation
        await conversation.update({
            name: name || conversation.name,
            group_image: group_image !== undefined ? group_image : conversation.group_image
        });

        return {
            id: conversation.id,
            type: conversation.type,
            name: conversation.name,
            group_image: conversation.group_image
        };
    }

    /**
     * Leave conversation
     */
    static async leaveConversation(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversation_id: conversationId,
                user_id: userId
            }
        });

        if (!participation) {
            const error = new Error('You are not a participant in this conversation');
            error.statusCode = 404; // Or 403, keeping consistent with old code which was 404
            throw error;
        }

        await participation.destroy();

        // Check if conversation has no participants left
        const remainingParticipants = await ConversationParticipant.count({
            where: { conversation_id: conversationId }
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
