const { Conversation, ConversationParticipant, User, Message, BlockedUser } = require('../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

class ConversationController {
    // Get all conversations for current user
    static async getConversations(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const conversations = await ConversationParticipant.findAndCountAll({
                where: { user_id: req.user.userId },
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

            // Format response
            const formattedConversations = conversations.rows.map(participant => {
                const conversation = participant.conversation;
                const otherParticipants = conversation.participants.filter(p => p.user_id !== req.user.userId);
                
                return {
                    id: conversation.id,
                    type: conversation.type,
                    name: conversation.name,
                    group_image: conversation.group_image,
                    participants: otherParticipants.map(p => p.user),
                    lastMessage: conversation.messages[0] || null,
                    joined_at: participant.joined_at,
                    last_read_message_id: participant.last_read_message_id
                };
            });

            res.json({
                conversations: formattedConversations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: conversations.count,
                    totalPages: Math.ceil(conversations.count / limit)
                }
            });
        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(500).json({
                error: 'Internal server error'
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

            const { participantId, type = 'private', name, group_image } = req.body;

            // For private conversations
            if (type === 'private') {
                if (!participantId) {
                    return res.status(400).json({
                        error: 'Participant ID is required for private conversations'
                    });
                }

                // Check if participant exists
                const participant = await User.findByPk(participantId);
                if (!participant) {
                    return res.status(404).json({
                        error: 'Participant not found'
                    });
                }

                // Check if users are blocked
                const isBlocked = await BlockedUser.findOne({
                    where: {
                        [Op.or]: [
                            { user_id: req.user.userId, blocked_user_id: participantId },
                            { user_id: participantId, blocked_user_id: req.user.userId }
                        ]
                    }
                });

                if (isBlocked) {
                    return res.status(403).json({
                        error: 'Cannot create conversation with blocked user'
                    });
                }

                // Check if private conversation already exists
                const existingConversation = await ConversationParticipant.findAll({
                    where: {
                        user_id: { [Op.in]: [req.user.userId, participantId] }
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
                        return res.json({
                            message: 'Conversation already exists',
                            conversation: {
                                id: conversation.id,
                                type: conversation.type,
                                created_at: conversation.created_at
                            }
                        });
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
            const participants = [req.user.userId];
            if (type === 'private' && participantId) {
                participants.push(participantId);
            }

            await Promise.all(
                participants.map(userId =>
                    ConversationParticipant.create({
                        conversation_id: conversation.id,
                        user_id: userId
                    })
                )
            );

            res.status(201).json({
                message: 'Conversation created successfully',
                conversation: {
                    id: conversation.id,
                    type: conversation.type,
                    name: conversation.name,
                    group_image: conversation.group_image,
                    created_at: conversation.created_at
                }
            });
        } catch (error) {
            console.error('Create conversation error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Get conversation by ID
    static async getConversationById(req, res) {
        try {
            const { conversationId } = req.params;

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
                return res.status(404).json({
                    error: 'Conversation not found'
                });
            }

            res.json({
                conversation: {
                    id: conversation.id,
                    type: conversation.type,
                    name: conversation.name,
                    group_image: conversation.group_image,
                    participants: conversation.participants.map(p => p.user),
                    created_at: conversation.created_at
                }
            });
        } catch (error) {
            console.error('Get conversation error:', error);
            res.status(500).json({
                error: 'Internal server error'
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
            const { name, group_image } = req.body;

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

            const conversation = await Conversation.findByPk(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    error: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    error: 'Can only update group conversations'
                });
            }

            // Update conversation
            await conversation.update({
                name: name || conversation.name,
                group_image: group_image !== undefined ? group_image : conversation.group_image
            });

            res.json({
                message: 'Conversation updated successfully',
                conversation: {
                    id: conversation.id,
                    type: conversation.type,
                    name: conversation.name,
                    group_image: conversation.group_image
                }
            });
        } catch (error) {
            console.error('Update conversation error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Leave conversation
    static async leaveConversation(req, res) {
        try {
            const { conversationId } = req.params;

            const participation = await ConversationParticipant.findOne({
                where: {
                    conversation_id: conversationId,
                    user_id: req.user.userId
                }
            });

            if (!participation) {
                return res.status(404).json({
                    error: 'You are not a participant in this conversation'
                });
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

            res.json({
                message: 'Left conversation successfully'
            });
        } catch (error) {
            console.error('Leave conversation error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }
}

module.exports = ConversationController;