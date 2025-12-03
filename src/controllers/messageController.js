const { Message, Conversation, ConversationParticipant, User, FCMToken } = require('../models');
const { Op } = require('sequelize');
const { admin } = require('../config/firebase');
const { validationResult } = require('express-validator');

function buildAvatarUrl(path, req) {
    if (!path) return null;
    const base = `${req.protocol}://${req.get('host')}`;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
}

class MessageController {
    // Get messages for a conversation
    static async getMessages(req, res) {
        try {
            const { conversationId, page = 1, limit = 50 } = req.body;
            const offset = (page - 1) * limit;

            // Check if user is participant
            const participation = await ConversationParticipant.findOne({
                where: {
                    conversation_id: conversationId,
                    user_id: req.user.userId
                }
            });

            if (!participation) {
                return res.status(403).json({
                    error: 'Access denied'
                });
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

            res.json({
                messages: messages.rows.reverse().map(m => {
                    const json = m.toJSON();
                    return {
                        ...json,
                        content: json.type !== 'text' ? buildAvatarUrl(json.content, req) : json.content,
                        sender: {
                            ...m.sender.toJSON(),
                            avatarUrl: buildAvatarUrl(m.sender.avatarUrl, req),
                        }
                    };
                }),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: messages.count,
                    totalPages: Math.ceil(messages.count / limit)
                }
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Send message
    static async sendMessage(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { conversationId, content, type = 'text' } = req.body;

            // Check if user is participant
            const participation = await ConversationParticipant.findOne({
                where: {
                    conversation_id: conversationId,
                    user_id: req.user.userId
                }
            });

            if (!participation) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }

            // Create message
            const message = await Message.create({
                conversation_id: conversationId,
                sender_id: req.user.userId,
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
                content: messageWithSender.type !== 'text' ? buildAvatarUrl(messageWithSender.content, req) : messageWithSender.content,
                sender: {
                    ...messageWithSender.sender.toJSON(),
                    avatarUrl: buildAvatarUrl(messageWithSender.sender.avatarUrl, req),
                }
            };

            // Ensure sender doesn't get unread count for their own message
            await ConversationParticipant.update(
                { last_read_message_id: message.id },
                { where: { conversation_id: conversationId, user_id: req.user.userId } }
            );

            // Emit to socket (will be handled by socket handlers)
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('new_message', {
                    message: msgOut
                });

                // Also emit conversation update to participants' personal rooms so chat list stays in sync
                const participants = await ConversationParticipant.findAll({
                    where: { conversation_id: conversationId }
                });

                const payload = {
                  conversationId,
                  lastMessage: {
                    id: messageWithSender.id,
                    content: messageWithSender.type !== 'text' ? buildAvatarUrl(messageWithSender.content, req) : messageWithSender.content,
                    created_at: messageWithSender.created_at,
                    sender_id: messageWithSender.sender_id,
                    type: messageWithSender.type,
                  }
                };

                participants.forEach(p => {
                    req.io.to(`user_${p.user_id}`).emit('conversation_updated', payload);
                });

                try {
                  const recipientIds = participants.map(p => p.user_id).filter(id => id !== req.user.userId);
                  if (recipientIds.length > 0) {
                    const tokens = await FCMToken.findAll({
                      where: { user_id: { [Op.in]: recipientIds } },
                      attributes: ['token']
                    });
                    const tokenList = tokens.map(t => t.token);
                    if (tokenList.length > 0) {
                      const notifBody = messageWithSender.type === 'text' ? messageWithSender.content : 'Sent an attachment';
                      const validTokens = tokenList.filter(t => typeof t === 'string' && t.length > 0);
                      if (validTokens.length > 0) {
                        const result = await admin.messaging().sendEachForMulticast({
                          tokens: validTokens,
                          notification: {
                            title: messageWithSender.sender.name || messageWithSender.sender.username || 'New message',
                            body: notifBody
                          },
                          data: {
                            userId: String(messageWithSender.sender_id || ''),
                            name: String((messageWithSender.sender.name || messageWithSender.sender.username || '')),
                            avatarUrl: String(buildAvatarUrl(messageWithSender.sender.avatarUrl, req) || ''),
                            conversationId: String(conversationId || '')
                          }
                        });
                        const invalidIndexes = result.responses
                          .map((r, idx) => ({ r, idx }))
                          .filter(x => !x.r.success && x.r.error && x.r.error.code === 'messaging/registration-token-not-registered')
                          .map(x => x.idx);
                        if (invalidIndexes.length > 0) {
                          const toDelete = invalidIndexes.map(i => validTokens[i]);
                          await FCMToken.destroy({ where: { token: { [Op.in]: toDelete } } });
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error('FCM send error:', e);
                }
            }

            res.status(201).json({
                message: 'Message sent successfully',
                data: msgOut
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    static async uploadAttachment(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            const type = req.body.type || req.query.type || 'file';
            const url = `/uploads/messages/${req.file.filename}`;
            res.json({ url, type });
        } catch (error) {
            console.error('Upload attachment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update message (edit)
    static async updateMessage(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { messageId, content } = req.body;

            const message = await Message.findByPk(messageId);

            if (!message) {
                return res.status(404).json({
                    error: 'Message not found'
                });
            }

            // Check if user is the sender
            if (message.sender_id !== req.user.userId) {
                return res.status(403).json({
                    error: 'Can only edit your own messages'
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

            // Emit to socket
            if (req.io) {
                req.io.to(`conversation_${message.conversation_id}`).emit('message_updated', {
                    message: updatedMessage
                });
            }

            res.json({
                message: 'Message updated successfully',
                data: updatedMessage
            });
        } catch (error) {
            console.error('Update message error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Delete message
    static async deleteMessage(req, res) {
        try {
            const { messageId } = req.body;

            const message = await Message.findByPk(messageId);

            if (!message) {
                return res.status(404).json({
                    error: 'Message not found'
                });
            }

            // Check if user is the sender
            if (message.sender_id !== req.user.userId) {
                return res.status(403).json({
                    error: 'Can only delete your own messages'
                });
            }

            const conversationId = message.conversation_id;
            await message.destroy();

            // Emit to socket
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('message_deleted', {
                    messageId: messageId
                });
            }

            res.json({
                message: 'Message deleted successfully'
            });
        } catch (error) {
            console.error('Delete message error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Mark messages as read
    static async markAsRead(req, res) {
        try {
            const { conversationId, messageId } = req.body;

            // Check if user is participant
            const participation = await ConversationParticipant.findOne({
                where: {
                    conversation_id: conversationId,
                    user_id: req.user.userId
                }
            });

            if (!participation) {
                return res.status(403).json({
                    error: 'Access denied'
                });
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

                    if (req.io) {
                        req.io.to(`conversation_${conversationId}`).emit('messages_read_status_updated', {
                            conversationId,
                            messageIds: toUpdate.map(m => m.id)
                        });
                    }
                }
            }

            // Emit to socket
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('messages_read', {
                    userId: req.user.userId,
                    messageId: messageId
                });
            }

            res.json({
                message: 'Messages marked as read'
            });
        } catch (error) {
            console.error('Mark as read error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }
}

module.exports = MessageController;