const { Message, Conversation, ConversationParticipant, User, FCMToken } = require('../models');
const { Op } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');
const AppError = require('../utils/AppError');

class MessageService {
    /**
     * Get messages for a conversation
     */
    static async getMessages(conversationId, currentUserId, baseUrl, page = 1, limit = 50) {
        const offset = (page - 1) * limit;

        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: currentUserId
            }
        });

        if (!participation) {
            throw new AppError({
                code: 403,
                statusCode: 'FORBIDDEN',
                message: 'access_denied'
            });
        }

        const messages = await Message.findAndCountAll({
            where: { conversationId: conversationId },
            include: [
                {
                    model: User,
                    as: 'sender',
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        return {
            messages: messages.rows.reverse().map(m => {
                const json = m.toJSON();
                return {
                    ...json,
                    content: json.type == 'text' ? json.content : buildAvatarUrl(json.content, baseUrl),
                    sender: {
                        ...m.sender.toJSON(),
                        avatarUrl: buildAvatarUrl(m.sender.avatarUrl, baseUrl),
                    },
                    isSendByMe: m.senderId == currentUserId,
                };
            }),
            total: messages.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(messages.count / limit)
        };
    }

    /**
     * Send a message
     */
    static async sendMessage(userId, data, baseUrl) {
        const { conversationId, content, type = 'text' } = data;

        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError(
                {
                    'code': 403,
                    'statusCode': 'FORBIDDEN',
                    'message': 'access_denied'
                }
            );
        }

        // Create message
        const message = await Message.create({
            conversationId: conversationId,
            senderId: userId,
            content,
            type
        });

        // Get message with sender info
        const messageWithSender = await Message.findByPk(message.id, {
            include: [
                {
                    model: User,
                    as: 'sender',
                }
            ]
        });

        const msgOut = {
            ...messageWithSender.toJSON(),
            content: messageWithSender.type !== 'text' ? buildAvatarUrl(messageWithSender.content, baseUrl) : messageWithSender.content,
            sender: {
                ...messageWithSender.sender.toJSON(),
                avatarUrl: buildAvatarUrl(messageWithSender.sender.avatarUrl, baseUrl),
            }
        };

        // Ensure sender doesn't get unread count for their own message
        await ConversationParticipant.update(
            { lastReadMessageId: message.id },
            { where: { conversationId: conversationId, userId: userId } }
        );

        // Get participants for notification/socket
        const participants = await ConversationParticipant.findAll({
            where: { conversationId: conversationId }
        });

        return {
            message: msgOut,
            participants,
            messageRaw: messageWithSender // For FCM title/body construction if needed
        };
    }

    /**
     * Update message
     */
    static async updateMessage(userId, messageId, content) {
        const message = await Message.findByPk(messageId);

        if (!message) {
            throw new AppError({
                code: 404,
                statusCode: 'NOT_FOUND',
                message: 'message_not_found',
            });
        }

        // Check if user is the sender
        if (message.senderId !== userId) {
            throw new AppError({
                code: 403,
                statusCode: 'FORBIDDEN',
                message: 'can_only_edit_your_own_messages',
            });
        }

        // Update message
        await message.update({ content });

        // Get updated message with sender info
        const updatedMessage = await Message.findByPk(messageId, {
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'name', 'avatarUrl']
                }
            ]
        });

        return updatedMessage;
    }

    /**
     * Delete message
     */
    static async deleteMessage(userId, messageId) {
        const message = await Message.findByPk(messageId);

        if (!message) {
            throw new AppError({
                code: 404,
                statusCode: 'NOT_FOUND',
                message: 'message_not_found',
            });
        }

        // Check if user is the sender
        if (message.senderId !== userId) {
            throw new AppError({
                code: 403,
                statusCode: 'FORBIDDEN',
                message: 'can_only_delete_your_own_messages',
            });
        }

        const conversationId = message.conversationId;
        await message.destroy();

        return conversationId;
    }

    /**
     * Mark messages as read
     */
    static async markAsRead(userId, conversationId, messageId) {
        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                code: 403,
                statusCode: 'FORBIDDEN',
                message: 'access_denied'
            });
        }

        // Update last read message
        await participation.update({
            lastReadMessageId: messageId
        });

        // After updating this user's read state, check if all participants have read up to some point
        const participants = await ConversationParticipant.findAll({
            where: { conversationId: conversationId }
        });

        // If every participant has a non-null lastReadMessageId, mark messages that everyone has read as isRead=true
        const lastReadTimes = [];
        for (const p of participants) {
            if (!p.lastReadMessageId) {
                lastReadTimes.length = 0;
                break;
            }
            const lastReadMsg = await Message.findByPk(p.lastReadMessageId, { attributes: ['createdAt'] });
            if (!lastReadMsg || !lastReadMsg.createdAt) {
                lastReadTimes.length = 0;
                break;
            }
            lastReadTimes.push(lastReadMsg.createdAt);
        }

        let updatedMessageIds = [];

        if (lastReadTimes.length === participants.length && participants.length > 0) {
            const thresholdDate = new Date(Math.min(...lastReadTimes.map(d => new Date(d).getTime())));

            const toUpdate = await Message.findAll({
                attributes: ['id'],
                where: {
                    conversationId: conversationId,
                    isRead: false,
                    createdAt: { [Op.lte]: thresholdDate }
                }
            });

            if (toUpdate.length > 0) {
                await Message.update(
                    { isRead: true },
                    {
                        where: {
                            conversationId: conversationId,
                            isRead: false,
                            createdAt: { [Op.lte]: thresholdDate }
                        }
                    }
                );
                updatedMessageIds = toUpdate.map(m => m.id);
            }
        }

        return {
            updatedMessageIds
        };
    }
}

module.exports = MessageService;
