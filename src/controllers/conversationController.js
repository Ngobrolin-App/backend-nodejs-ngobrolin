const { validationResult } = require('express-validator');
const ConversationService = require('../services/conversationService');
const MessageService = require('../services/messageService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');

class ConversationController {
    static async getConversations(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const result = await ConversationService.getConversations(
                currentUserId,
                baseUrl,
                page,
                limit
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: {
                    conversations: result.conversations,
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }
            });
        } catch (error) {
            console.error('ConversationController - getConversations() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    static async uploadGroupImage(req, res) {
        try {
            if (!req.file) {
                throw new AppError({
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    message: 'no_file_uploaded',
                    errors: errors.array(),
                });
            }
            const url = `/uploads/group-images/${req.file.filename}`;
            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'data_retrieved',
                data: {
                    url: url,
                },
            });
        } catch (error) {
            console.error('ConversationController - uploadGroupImage() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Create new conversation
    static async createConversation(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const result = await ConversationService.createConversation(
                currentUserId,
                req.body,
                baseUrl
            );

            // Emit realtime events if not existing
            if (!result.isExisting && req.io && result.conversation.participants) {
                result.conversation.participants.forEach(participant => {
                    req.io.to(`user_${participant.id}`).emit('conversation_created', result.conversation);
                });
            }

            if (result.isExisting) {
                return ApiResponse.success(res, {
                    code: 200,
                    statusCode: 'OK',
                    message: result.message,
                    data: result.conversation,
                });
            } else {
                return ApiResponse.success(res, {
                    code: 201,
                    statusCode: 'CREATED',
                    message: result.message,
                    data: result.conversation,
                });
            }

        } catch (error) {
            console.error('ConversationController - createConversation() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Get conversation by ID
    static async getConversationById(req, res) {
        try {
            const { conversationId, isShowParticipants = true, isParticipantsIncludeMe = true } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const conversation = await ConversationService.getConversationById(
                conversationId,
                currentUserId,
                isShowParticipants,
                isParticipantsIncludeMe,
                baseUrl
            );

            ApiResponse.success(res, {
                message: 'data_retrieved',
                code: 200,
                statusCode: 'OK',
                data: conversation,
            });
        } catch (error) {
            console.error('ConversationController - getConversationById() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    static async getPrivateConversationByParticipantsIds(req, res) {
        try {
            const { partnerId } = req.body;
            const currentUserId = req.user.userId;

            if (!partnerId) {
                throw new AppError(
                    {
                        message: 'partnerid_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }

            const result = await ConversationService.getPrivateConversationByParticipantsIds(currentUserId, partnerId);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                messasge: 'data_retrieved',
                data: result.conversation,
            });

        } catch (error) {
            console.error('ConversationController - getPrivateConversationByParticipantsIds() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    static async getConversationParticipants(req, res) {
        try {
            const { page, limit, conversationId, isIncludeMe = true } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const result = await ConversationService.getConversationParticipants(
                currentUserId,
                conversationId,
                isIncludeMe,
                baseUrl,
                page,
                limit
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: {
                    participants: result.participants,
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }

            });
        } catch (error) {
            console.error('ConversationController - getConversationParticipants() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Update conversation (for groups)
    static async updateConversation(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array(),
                });
            }

            const { conversationId } = req.body;
            const currentUserId = req.user.userId;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const conversation = await ConversationService.updateConversation(
                conversationId,
                currentUserId,
                req.body,
                baseUrl,
                req.io,
            );

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'conversation_update_success',
                data: conversation,
            });
        } catch (error) {
            console.error('ConversationController - updateConversation() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Leave conversation
    static async leaveConversation(req, res) {
        try {
            const { conversationId } = req.body;
            const currentUserId = req.user.userId;

            const result = await ConversationService.leaveConversation(conversationId, currentUserId);

            if (result && req.io) {
                req.io.to(`conversation_${conversationId}`).emit('left_participant', currentUserId);

                if (result.message) {
                    req.io.to(`conversation_${conversationId}`).emit('new_message', result);
                }

                const participantIds = await ConversationService.getConversationParticipantIds(currentUserId, conversationId, false);

                for (const participantId of participantIds) {

                    const unreadCount = await MessageService.getUnreadCount(conversationId, participantId);

                    const conversationUpdatedPayload = {
                        conversationId: result.conversationId,
                        lastMessage: result.message,
                        unreadCount: unreadCount,
                    }

                    req.io.to(`user_${participantId}`).emit('conversation_updated', conversationUpdatedPayload);
                }
            }

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'left_conversation_success',
            });

        } catch (error) {
            console.error('ConversationController - leaveConversation() error:', error);
            ApiResponse.error(res, {
                code: error.code || 500,
                statusCode: error.statusCode || 'INTERNAL_SERVER_ERROR',
                message: error.message || 'An unexpected error occurred',
                errors: error.errors || []
            });
        }
    }

    // Add participants to an existing group conversation
    static async addConversationParticipants(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array(),
                });
            }

            const { conversationId, participantIds } = req.body;
            const currentUserId = req.user.userId;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            // Panggil service untuk memproses penambahan anggota
            const result = await ConversationService.addConversationParticipants(
                conversationId,
                participantIds,
                currentUserId,
                baseUrl
            );

            // Emit realtime events via Socket.io
            if (result && req.io) {
                if (result.message) {
                    req.io.to(`conversation_${conversationId}`).emit('new_message', {
                        conversationId: conversationId,
                        message: result.message,
                    });
                }

                req.io.to(`conversation_${conversationId}`).emit('participants_added', {
                    conversationId: conversationId,
                    addedParticipants: result.addedParticipants
                });

                const participantIds = await ConversationService.getConversationParticipantIds(currentUserId, conversationId, true);

                for (const participantId of participantIds) {
                    const unreadCount = await MessageService.getUnreadCount(conversationId, participantId);
                    req.io.to(`user_${participantId}`).emit('conversation_updated', {
                        conversationId: conversationId,
                        lastMessage: result.message,
                        unreadCount: unreadCount,
                    });
                }
            }

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'participants_added_success',
            });

        } catch (error) {
            console.error('ConversationController - addConversationParticipants() error:', error);
            ApiResponse.error(res, {
                code: error.code || 500,
                statusCode: error.statusCode || 'INTERNAL_SERVER_ERROR',
                message: error.message || 'An unexpected error occurred',
                errors: error.errors || []
            });
        }
    }
}

module.exports = ConversationController;
