const { Message, Conversation, ConversationParticipant, User, FCMToken } = require('../models');
const { Op } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');

class MessageService {
    /**
     * Get messages for a conversation
     */
    static async getMessages(conversationId, userId, baseUrl, page = 1, limit = 50) {
        const offset = (page - 1) * limit;

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

        const messages = await Message.findAndCountAll({
            where: { conversation_id: conversationId },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'name', 'avatarUrl']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        return {
            messages: messages.rows.reverse().map(m => {
                const json = m.toJSON();
                return {
                    ...json,
                    content: json.type !== 'text' ? buildAvatarUrl(json.content, baseUrl) : json.content,
                    sender: {
                        ...m.sender.toJSON(),
                        avatarUrl: buildAvatarUrl(m.sender.avatarUrl, baseUrl),
                    }
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
                conversation_id: conversationId,
                user_id: userId
            }
        });

        if (!participation) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }

        // Create message
        const message = await Message.create({
            conversation_id: conversationId,
            sender_id: userId,
            content,
            type
        });

        // Get message with sender info
        const messageWithSender = await Message.findByPk(message.id, {
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'name', 'avatarUrl']
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
            { last_read_message_id: message.id },
            { where: { conversation_id: conversationId, user_id: userId } }
        );

        // Get participants for notification/socket
        const participants = await ConversationParticipant.findAll({
            where: { conversation_id: conversationId }
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
            const error = new Error('Message not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user is the sender
        if (message.sender_id !== userId) {
            const error = new Error('Can only edit your own messages');
            error.statusCode = 403;
            throw error;
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
            const error = new Error('Message not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user is the sender
        if (message.sender_id !== userId) {
            const error = new Error('Can only delete your own messages');
            error.statusCode = 403;
            throw error;
        }

        const conversationId = message.conversation_id;
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
                conversation_id: conversationId,
                user_id: userId
            }
        });

        if (!participation) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }

        // Update last read message
        await participation.update({
            last_read_message_id: messageId
        });

        // After updating this user's read state, check if all participants have read up to some point
        const participants = await ConversationParticipant.findAll({
            where: { conversation_id: conversationId }
        });

        // If every participant has a non-null last_read_message_id, mark messages that everyone has read as is_read=true
        const lastReadTimes = [];
        for (const p of participants) {
            if (!p.last_read_message_id) {
                lastReadTimes.length = 0;
                break;
            }
            const lastReadMsg = await Message.findByPk(p.last_read_message_id, { attributes: ['created_at'] });
            if (!lastReadMsg || !lastReadMsg.created_at) {
                lastReadTimes.length = 0;
                break;
            }
            lastReadTimes.push(lastReadMsg.created_at);
        }

        let updatedMessageIds = [];

        if (lastReadTimes.length === participants.length && participants.length > 0) {
            const thresholdDate = new Date(Math.min(...lastReadTimes.map(d => new Date(d).getTime())));

            const toUpdate = await Message.findAll({
                attributes: ['id'],
                where: {
                    conversation_id: conversationId,
                    is_read: false,
                    created_at: { [Op.lte]: thresholdDate }
                }
            });

            if (toUpdate.length > 0) {
                await Message.update(
                    { is_read: true },
                    {
                        where: {
                            conversation_id: conversationId,
                            is_read: false,
                            created_at: { [Op.lte]: thresholdDate }
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
