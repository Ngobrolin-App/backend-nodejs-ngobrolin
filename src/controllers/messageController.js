const { validationResult } = require('express-validator');
const MessageService = require('../services/messageService');
const NotificationService = require('../services/notificationService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');

class MessageController {
    // Get messages for a conversation
    static async getMessages(req, res) {
        try {
            const { conversationId, page = 1, limit = 50 } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const result = await MessageService.getMessages(
                conversationId,
                currentUserId,
                baseUrl,
                page,
                limit
            );

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'data_retrieved',
                data: {
                    messages: result.messages,
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }
            });

        } catch (error) {
            console.error('MessageController - getMessages() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Send message
    static async sendMessage(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    message: 'validation_failed',
                    errors: errors.array(),
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const { conversationId } = req.body;
            const currentUserId = req.user.userId;

            const result = await MessageService.sendMessage(
                currentUserId,
                req.body,
                baseUrl
            );

            const { message, participants, messageRaw } = result;

            // Emit to socket (will be handled by socket handlers)
            if (req.io) {
                req.io.to(`conversation_${conversationId}`).emit('new_message', {
                    message: message
                });

                for (const p of participants) {
                    const unreadCount = await MessageService.getUnreadCount(conversationId, p.userId);
                    const payload = {
                        conversationId,
                        unreadCount,
                        lastMessage: message,
                    };
                    // GET UNREAD MESSAGE (USERID DAN CONVERSATION ID)
                    // PAYLOAD AKAN DITAMBAHKAN UNREAD COUNT
                    req.io.to(`user_${p.userId}`).emit('conversation_updated', payload);
                }

                // Send push notification
                await NotificationService.sendNewMessageNotification(
                    participants,
                    req.user.userId,
                    messageRaw,
                    conversationId,
                    baseUrl
                );
            }

            ApiResponse.success(res, {
                code: 201,
                statusCode: 'CREATED',
                message: 'message_sent_success',
                data: message,
            });
        } catch (error) {
            console.error('MessageController - sendMessage() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
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
            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'data_retrieved',
                data: {
                    url: url,
                    type: type
                },
            });
        } catch (error) {
            console.error('MessageController - uploadAttachment() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Update message (edit)
    static async updateMessage(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    message: 'validation_failed',
                    errors: errors.array()
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
                req.io.to(`conversation_${updatedMessage.conversationId}`).emit('message_updated', {
                    message: updatedMessage
                });
            }

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'message_update_success',
                data: updatedMessage,
            });
        } catch (error) {
            console.error('MessageController - updateMessage() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
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

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'message_delete_success',
            });
        } catch (error) {
            console.error('MessageController - deleteMessage() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
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
                // Emit to user's personal room to update ChatList (unread count -> 0)
                req.io.to(`user_${req.user.userId}`).emit('conversation_read_by_me', {
                    conversationId,
                    lastReadMessageId: messageId
                });
            }

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'messages_marked_as_read',
            });
        } catch (error) {
            console.error('MessageController - markAsRead() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }
}

module.exports = MessageController;
