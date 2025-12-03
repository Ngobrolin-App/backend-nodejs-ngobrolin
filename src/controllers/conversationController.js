const { validationResult } = require('express-validator');
const ConversationService = require('../services/conversationService');

class ConversationController {
    // Get all conversations for current user
    static async getConversations(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await ConversationService.getConversations(
                req.user.userId,
                baseUrl,
                page,
                limit
            );

            res.json({
                conversations: result.conversations,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Create new conversation
    static async createConversation(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await ConversationService.createConversation(
                req.user.userId,
                req.body,
                baseUrl
            );

            // Emit realtime events if not existing
            if (!result.isExisting && req.io && result.participants && result.payload) {
                result.participants.forEach(userId => {
                    req.io.to(`user_${userId}`).emit('conversation_created', result.payload);
                });
            }

            // If existing, we return 200 (default res.json is 200). If new, we might want 201.
            // The original code returned 200 for existing and 201 for new.
            if (result.isExisting) {
                return res.json({
                    message: result.message,
                    conversation: result.conversation
                });
            } else {
                return res.status(201).json({
                    message: result.message,
                    conversation: result.conversation
                });
            }

        } catch (error) {
            console.error('Create conversation error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Get conversation by ID
    static async getConversationById(req, res) {
        try {
            const { conversationId } = req.params;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const conversation = await ConversationService.getConversationById(
                conversationId,
                req.user.userId,
                baseUrl
            );

            res.json({ conversation });
        } catch (error) {
            console.error('Get conversation error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Update conversation (for groups)
    static async updateConversation(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { conversationId } = req.params;

            const conversation = await ConversationService.updateConversation(
                conversationId,
                req.user.userId,
                req.body
            );

            res.json({
                message: 'Conversation updated successfully',
                conversation
            });
        } catch (error) {
            console.error('Update conversation error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Leave conversation
    static async leaveConversation(req, res) {
        try {
            const { conversationId } = req.params;

            await ConversationService.leaveConversation(conversationId, req.user.userId);

            res.json({
                message: 'Left conversation successfully'
            });
        } catch (error) {
            console.error('Leave conversation error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = ConversationController;
