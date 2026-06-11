const { validationResult } = require('express-validator');
const ConversationService = require('../services/conversationService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

class ConversationController {
    // Get all conversations for current user
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

    // Create new conversation
    static async createConversation(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: error.array()
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
            if (!result.isExisting && req.io && result.participants && result.payload) {
                result.participants.forEach(userId => {
                    req.io.to(`user_${userId}`).emit('conversation_created', result.payload);
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
            const { conversationId, isIncludeMe = true } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const currentUserId = req.user.userId;

            const result = await ConversationService.getConversationParticipants(
                currentUserId,
                conversationId,
                isIncludeMe,
                baseUrl
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: result.participants,

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

            const conversation = await ConversationService.updateConversation(
                conversationId,
                currentUserId,
                req.body
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
            const { conversationId } = req.params;
            const currentUserId = req.user.userId;

            await ConversationService.leaveConversation(conversationId, currentUserId);

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: 'left_conversation_success',
            });
        } catch (error) {
            console.error('ConversationController - leaveConversation() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }
}

module.exports = ConversationController;
