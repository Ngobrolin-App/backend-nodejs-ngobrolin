const { validationResult } = require('express-validator');
const MessageService = require('../services/messageService');
const NotificationService = require('../services/notificationService');

class MessageController {
    // Get messages for a conversation
    static async getMessages(req, res) {
        try {
            const { conversationId, page = 1, limit = 50 } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await MessageService.getMessages(
                conversationId,
                req.user.userId,
                baseUrl,
                page,
                limit
            );

            res.json({
                messages: result.messages,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
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

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const { conversationId } = req.body;

            const result = await MessageService.sendMessage(
                req.user.userId,
                req.body,
                baseUrl
            );

            const { message, participants, messageRaw } = result;

            // Emit to socket (will be handled by socket handlers)
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('new_message', {
                    message: message
                });

                // Also emit conversation update to participants' personal rooms so chat list stays in sync
                const payload = {
                    conversationId,
                    lastMessage: {
                        id: message.id,
                        content: message.content,
                        created_at: message.created_at,
                        sender_id: message.sender_id,
                        type: message.type,
                    }
                };

                participants.forEach(p => {
                    req.io.to(`user_${p.user_id}`).emit('conversation_updated', payload);
                });

                // Send push notification
                await NotificationService.sendNewMessageNotification(
                    participants,
                    req.user.userId,
                    messageRaw,
                    conversationId,
                    baseUrl
                );
            }

            res.status(201).json({
                message: 'Message sent successfully',
                data: message
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
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

            const updatedMessage = await MessageService.updateMessage(
                req.user.userId,
                messageId,
                content
            );

            // Emit to socket
            if (req.io) {
                req.io.to(`conversation_${updatedMessage.conversation_id}`).emit('message_updated', {
                    message: updatedMessage
                });
            }

            res.json({
                message: 'Message updated successfully',
                data: updatedMessage
            });
        } catch (error) {
            console.error('Update message error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Delete message
    static async deleteMessage(req, res) {
        try {
            const { messageId } = req.body;

            const conversationId = await MessageService.deleteMessage(req.user.userId, messageId);

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
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Mark messages as read
    static async markAsRead(req, res) {
        try {
            const { conversationId, messageId } = req.body;

            const result = await MessageService.markAsRead(
                req.user.userId,
                conversationId,
                messageId
            );

            // Emit to socket
            if (req.io) {
                if (result.updatedMessageIds.length > 0) {
                    req.io.to(`conversation_${conversationId}`).emit('messages_read_status_updated', {
                        conversationId,
                        messageIds: result.updatedMessageIds
                    });
                }

                req.io.to(`conversation_${conversationId}`).emit('messages_read', {
                    userId: req.user.userId,
                    messageId: messageId
                });

                // Emit to user's personal room to update ChatList (unread count -> 0)
                req.io.to(`user_${req.user.userId}`).emit('conversation_read_by_me', {
                    conversationId,
                    lastReadMessageId: messageId
                });
            }

            res.json({
                message: 'Messages marked as read'
            });
        } catch (error) {
            console.error('Mark as read error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = MessageController;
