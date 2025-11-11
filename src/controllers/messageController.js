const { Message, Conversation, ConversationParticipant, User } = require('../models');
const { Op } = require('sequelize');
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
                messages: messages.rows.reverse().map(m => ({
                    ...m.toJSON(),
                    sender: {
                        ...m.sender.toJSON(),
                        avatarUrl: buildAvatarUrl(m.sender.avatarUrl, req),
                    }
                })),
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

            // Emit to socket (will be handled by socket handlers)
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('new_message', {
                    message: messageWithSender
                });

                // Also emit conversation update to participants' personal rooms so chat list stays in sync
                const participants = await ConversationParticipant.findAll({
                    where: { conversation_id: conversationId }
                });

                const payload = {
                    conversationId,
                    lastMessage: {
                        id: messageWithSender.id,
                        content: messageWithSender.content,
                        created_at: messageWithSender.created_at,
                        sender_id: messageWithSender.sender_id, // tambahkan sender_id untuk filter di frontend
                    }
                };

                participants.forEach(p => {
                    req.io.to(`user_${p.user_id}`).emit('conversation_updated', payload);
                });
            }

            res.status(201).json({
                message: 'Message sent successfully',
                data: messageWithSender
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
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