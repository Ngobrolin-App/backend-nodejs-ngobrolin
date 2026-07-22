const { sequelize, Conversation, ConversationParticipant, User, Message, BlockedUser } = require('../models');
const MessageService = require('../services/messageService');
const { Op, fn, col, where } = require('sequelize');
const { buildAvatarUrl } = require('../utils/urlHelper');
const AppError = require('../utils/appError');

class ConversationService {
    static async isParticipant(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });
        return !!participation;
    }

    static async searchGroupConversations(currentUserId, query, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        let whereClause = {
            type: 'group'
        };

        if (query && query.trim()) {
            whereClause = {
                ...whereClause,
                name: { [Op.iLike]: `%${query.trim()}%` }
            };
        }

        const groupConversations = await Conversation.findAndCountAll({
            where: whereClause,
            distinct: true,
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                },
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    attributes: ['id', 'userId'],
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
        });

        return {
            groupConversations: groupConversations.rows.map((group) => {
                const groupData = group.toJSON();

                const isMember = groupData.participants
                    ? groupData.participants.some(
                        (p) => String(p.userId) === String(currentUserId)
                    )
                    : false;

                return {
                    ...groupData,
                    groupImage: groupData.groupImage ? buildAvatarUrl(groupData.groupImage, baseUrl) : null,
                    totalParticipants: groupData.participants ? groupData.participants.length : 0,
                    isMember: isMember,
                    participants: null,
                };
            }),
            total: groupConversations.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(groupConversations.count / limit)
        };
    }

    static async getConversations(userId, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const conversations = await ConversationParticipant.findAndCountAll({
            where: { userId: userId },
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
                                }
                            ]
                        },
                        {
                            model: Message,
                            as: 'messages',
                            limit: 1,
                            order: [['createdAt', 'DESC']],
                            include: [
                                {
                                    model: User,
                                    as: 'sender',
                                }
                            ]
                        }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['joinedAt', 'DESC']]
        });

        const formattedConversations = await Promise.all(conversations.rows.map(async participant => {
            const conversation = participant.conversation;
            const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
            let privatePartnerUser = null;
            if (conversation.type == 'private') {
                privatePartnerUser = otherParticipants[0]?.user;
            }

            let baselineTime = participant.joinedAt;
            if (participant.lastReadMessageId) {
                const lastReadMsg = await Message.findByPk(participant.lastReadMessageId, { attributes: ['createdAt'] });
                if (lastReadMsg && lastReadMsg.createdAt) {
                    baselineTime = lastReadMsg.createdAt;
                }
            }

            const unreadCount = await Message.count({
                where: {
                    conversationId: conversation.id,
                    createdAt: { [Op.gt]: baselineTime },
                    senderId: { [Op.ne]: userId }
                }
            });

            return {
                ...conversation.toJSON(),
                groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
                privatePartnerUser: (privatePartnerUser) ? {
                    ...privatePartnerUser.toJSON(),
                    avatarUrl: buildAvatarUrl(privatePartnerUser.avatarUrl, baseUrl),
                } : null,
                participants: otherParticipants.map(p => ({
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                })),
                lastMessage: conversation.messages[0] || null,
                joinedAt: participant.joinedAt,
                unreadCount
            };
        }));

        // Sort conversations by last message time (fallback: joinedAt)
        formattedConversations.sort((a, b) => {
            const ta = a.lastMessage?.createdAt || a.joinedAt;
            const tb = b.lastMessage?.createdAt || b.joinedAt;
            return new Date(tb) - new Date(ta);
        });

        return {
            conversations: formattedConversations,
            total: conversations.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(conversations.count / limit)
        };
    }

    static async getPrivateConversationByParticipantsIds(userId, partnerId) {
        if (!partnerId) {
            throw new AppError({
                message: 'partnerid_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        const participantIds = [userId, partnerId];

        const result = await ConversationParticipant.findOne({
            attributes: ['conversationId'],
            where: {
                userId: {
                    [Op.in]: participantIds,
                },
            },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                    where: {
                        type: 'private',
                    }
                }

            ],
            group: [
                'ConversationParticipant.conversation_id',
                'conversation.id'
            ],
            having: where(
                fn('COUNT', col('ConversationParticipant.conversation_id')),
                '=',
                participantIds.length
            )
        });

        return { conversation: result ? result.conversation : null };

    }

    static async getConversationParticipants(userId, conversationId, isIncludeMe = true, baseUrl, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const userWhere = {};

        if (!conversationId) {
            throw new AppError({
                message: 'conversationid_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        if (!isIncludeMe) {
            userWhere.id = {
                [Op.ne]: userId
            };
        }

        const participants = await ConversationParticipant.findAndCountAll({
            where: { conversationId: conversationId },
            include: [
                {
                    model: User,
                    as: 'user',
                    where: userWhere,
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });


        return {
            participants: participants.rows.map(p => ({
                ...p.toJSON(),
                user: {
                    ...p.user.toJSON(),
                    avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
                },
            })),
            total: participants.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(participants.count / limit)
        }
    }

    static async getConversationParticipantIds(
        userId,
        conversationId,
        isIncludeMe = true
    ) {
        if (!conversationId) {
            throw new AppError({
                message: 'conversationid_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        const where = {
            conversationId,
        };

        if (!isIncludeMe) {
            where.userId = {
                [Op.ne]: userId,
            };
        }

        const participantRows = await ConversationParticipant.findAll({
            where,
            attributes: ['userId'],
        });

        return participantRows.map(participant => participant.userId);
    }

    /**
     * Create a new conversation
     */
    static async createConversation(userId, data, baseUrl) {
        const { type = 'private', participantId, name, participantIds, groupImage, createdByUserId } = data;

        // For private conversations
        if (type === 'private') {
            if (!participantId) {
                throw new AppError(
                    {
                        message: 'partnerid_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }

            // Check if participant exists
            const participant = await User.findByPk(participantId);
            if (!participant) {
                throw new AppError(
                    {
                        message: 'user_not_found',
                        code: 404,
                        statusCode: 'NOT_FOUND'
                    }
                );
            }

            // Block creating conversation if target account is private and it's not yourself
            if (participant.isPrivate && participant.id !== userId) {
                throw new AppError(
                    {
                        message: 'create_conversation_private_user_failed',
                        code: 403,
                        statusCode: 'FORBIDDEN'
                    }
                );
            }

            // Check if users are blocked
            const isBlocked = await BlockedUser.findOne({
                where: {
                    [Op.or]: [
                        { userId: userId, blockedUserId: participantId },
                        { userId: participantId, blockedUserId: userId }
                    ]
                }
            });

            if (isBlocked) {
                throw new AppError(
                    {
                        message: 'create_conversation_blocked_user_failed',
                        code: 403,
                        statusCode: 'FORBIDDEN'
                    }
                );
            }

            // Check if private conversation already exists
            const existingConversation = await ConversationParticipant.findAll({
                where: {
                    userId: { [Op.in]: [userId, participantId] }
                },
                include: [
                    {
                        model: Conversation,
                        as: 'conversation',
                        where: { type: 'private' }
                    }
                ]
            });

            // Group by conversationId and check if both users are in the same conversation
            const conversationGroups = {};
            existingConversation.forEach(cp => {
                if (!conversationGroups[cp.conversationId]) {
                    conversationGroups[cp.conversationId] = [];
                }
                conversationGroups[cp.conversationId].push(cp.userId);
            });

            for (const convId in conversationGroups) {
                if (conversationGroups[convId].length === 2) {
                    const conversation = existingConversation.find(cp => cp.conversationId === convId).conversation;
                    return {
                        message: 'Conversation already exists',
                        conversation: {
                            id: conversation.id,
                            type: conversation.type,
                            createdAt: conversation.createdAt
                        },
                        isExisting: true
                    };
                }
            }
        }
        if (type === 'group') {
            if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
                throw new AppError(
                    {
                        message: 'participantids_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }
            if (!createdByUserId) {
                throw new AppError(
                    {
                        message: 'createdbyuserid_required',
                        code: 400,
                        statusCode: 'BAD_REQUEST'
                    }
                );
            }
        }


        // Create conversation
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            groupImage: type === 'group' ? groupImage : null,
            createdByUserId: createdByUserId
        });

        let uniqueParticipantsToInsert = [];

        if (type === 'private') {
            uniqueParticipantsToInsert = [userId, participantId];
        } else if (type === 'group') {
            uniqueParticipantsToInsert = [...new Set([userId, ...participantIds])];
        }

        await Promise.all(
            uniqueParticipantsToInsert.map(uid =>
                ConversationParticipant.create({
                    conversationId: conversation.id,
                    userId: uid
                })
            )
        );

        const userData = await User.findByPk(userId);

        if (conversation.type == 'group') {
            const systemMessage = await Message.create({
                conversationId: conversation.id,
                senderId: userId,
                type: 'system',
                content: `${userData.name} created a group chat`,
                systemEventType: 'GROUP_CREATED',
                systemMetadata: {
                    actorId: userData.id,
                    actorName: userData.name,
                    conversationId: conversation.id,
                    groupName: conversation.name,
                }
            });
        }

        // Get participant details for real-time event
        const participantRows = await ConversationParticipant.findAll({
            where: { conversationId: conversation.id },
            include: [
                {
                    model: User,
                    as: 'user',
                }
            ]
        });

        const finalConversation = {
            ...conversation.toJSON(),
            groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
            participants: participantRows.map(p => ({
                ...p.user.toJSON(),
                avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
            })),
            createdAt: conversation.createdAt
        };

        return {
            message: 'create_conversation_success',
            conversation: finalConversation,
            isExisting: false,
        };
    }

    /**
     * Get conversation by ID
     */
    static async getConversationById(conversationId, userId, isShowParticipants = true, baseUrl) {
        // Check if user is participant
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                message: 'access_denied',
                code: 403,
                statusCode: 'FORBIDDEN',
            });
        }

        const conversation = await Conversation.findByPk(conversationId, {
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                },
                ...(isShowParticipants
                    ? [{
                        model: ConversationParticipant,
                        as: 'participants',
                        include: [
                            {
                                model: User,
                                as: 'user',
                            }
                        ]
                    }]
                    : [])
            ]
        });

        if (!conversation) {
            throw new AppError({
                message: 'conversation_not_found',
                code: 404,
                statusCode: 'NOT_FOUND',
            });
        }

        let result = conversation.toJSON();

        result.groupImage = conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null;
        if (result.createdByUser) {
            result.createdByUser = {
                ...conversation.createdByUser.toJSON(),
                avatarUrl: conversation.createdByUser.avatarUrl ?
                    buildAvatarUrl(conversation.createdByUser.avatarUrl, baseUrl)
                    : null,
            };
        }
        if (isShowParticipants && conversation.participants) {
            result.participants = conversation.participants.map(p => ({
                ...p.user.toJSON(),
                avatarUrl: buildAvatarUrl(p.user.avatarUrl, baseUrl),
            }));

            if (conversation.type == 'private') {
                result.participants = result.participants.filter(participant => participant.id !== userId);
            }
        }

        return result;
    }

    /**
     * Update conversation (group)
     */
    static async updateConversation(conversationId, userId, data, baseUrl, io) {
        const { name, groupImage, groupDescription } = data;

        const participation = await ConversationParticipant.findOne({
            where: { conversationId, userId }
        });

        if (!participation) {
            throw new AppError({
                message: 'access_denied',
                code: 403,
                statusCode: 'FORBIDDEN',
            });
        }

        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            throw new AppError({ message: 'conversation_not_found', code: 404, statusCode: 'NOT_FOUND' });
        }
        if (conversation.type !== 'group') {
            throw new AppError({ message: 'can_only_update_group_conversations', code: 400, statusCode: 'BAD_REQUEST' });
        }

        const userData = await User.findByPk(userId);

        const changes = {};
        const systemMessagesToCreate = [];

        if (name !== undefined && name !== conversation.name) {
            changes.name = name;
            systemMessagesToCreate.push({
                content: `${userData.name} changed the group name to "${name}"`,
                systemEventType: 'GROUP_NAME_CHANGED'
            });
        }

        if (groupDescription !== undefined && groupDescription !== conversation.groupDescription) {
            changes.groupDescription = groupDescription;
            systemMessagesToCreate.push({
                content: `${userData.name} changed the group description`,
                systemEventType: 'GROUP_DESCRIPTION_CHANGED'
            });
        }

        if (groupImage !== undefined && groupImage !== conversation.groupImage) {
            changes.groupImage = groupImage;
            systemMessagesToCreate.push({
                content: `${userData.name} changed the group photo`,
                systemEventType: 'GROUP_IMAGE_CHANGED'
            });
        }

        if (Object.keys(changes).length === 0) {
            return conversation;
        }

        // 4. Update Conversation
        await conversation.update(changes);

        // 5. Buat System Messages dan Emit via Socket
        const createdMessages = [];
        for (const sysMsg of systemMessagesToCreate) {
            const systemMessage = await Message.create({
                conversationId: conversation.id,
                senderId: userId,
                type: 'system',
                content: sysMsg.content,
                systemEventType: sysMsg.systemEventType,
                systemMetadata: {
                    actorId: userData.id,
                    actorName: userData.name,
                    conversationId: conversation.id,
                    groupName: conversation.name,
                    groupDescription: conversation.groupDescription,
                }
            });
            createdMessages.push(systemMessage);
        }

        const finalConversation = {
            ...conversation.toJSON(),
            groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
        };

        if (io && createdMessages.length > 0) {
            const participants = await ConversationParticipant.findAll({
                where: { conversationId: conversation.id },
                include: [{ model: User, as: 'user' }]
            });

            // Emit setiap pesan sistem yang baru terbentuk
            for (const newMsg of createdMessages) {
                io.to(`conversation_${conversationId}`).emit('new_message', { message: newMsg });

                for (const p of participants) {
                    const unreadCount = await MessageService.getUnreadCount(conversationId, p.userId);
                    const payload = {
                        conversationId,
                        unreadCount,
                        lastMessage: newMsg,
                        updatedConversation: finalConversation
                    };
                    io.to(`user_${p.userId}`).emit('conversation_updated', payload);
                }
            }
        }

        return finalConversation;
    }

    /**
     * Leave conversation
     */
    static async leaveConversation(conversationId, userId) {
        const participation = await ConversationParticipant.findOne({
            where: {
                conversationId: conversationId,
                userId: userId
            }
        });

        if (!participation) {
            throw new AppError({
                message: 'you_are_not_a_participant',
                code: 404,
                statusCode: 'NOT_FOUND',
            });
        }

        const conversationData = await Conversation.findByPk(conversationId);
        const userData = await User.findByPk(userId);

        let systemMessage = null;
        if (conversationData.type == 'group') {
            systemMessage = await Message.create({
                conversationId: conversationId,
                senderId: userId,
                type: 'system',
                content: `${userData.name} left the group`,
                systemEventType: 'USER_LEFT',
                systemMetadata: {
                    actorId: userData.id,
                    actorName: userData.name,
                    conversationId: conversationData.id,
                    groupName: conversationData.name,
                }
            });
        }


        await participation.destroy();

        // Check if conversation has no participants left
        const remainingParticipants = await ConversationParticipant.count({
            where: { conversationId: conversationId }
        });

        if (remainingParticipants === 0) {
            // Delete conversation if no participants left
            await Conversation.destroy({
                where: { id: conversationId }
            });
        }

        return {
            conversationId: conversationId,
            message: systemMessage
        };
    }

    /**
     * Add participants to an existing group conversation
     */
    static async addConversationParticipants(conversationId, participantIds, currentUserId, baseUrl) {
        // 1. Validasi input
        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            throw new AppError({
                message: 'participantids_required',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // 2. Cek apakah percakapan (grup) eksis
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            throw new AppError({
                message: 'conversation_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        if (conversation.type !== 'group') {
            throw new AppError({
                message: 'cannot_add_participant_to_private_chat',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // 3. Pastikan user yang mengundang adalah anggota grup tersebut
        const isMember = await ConversationParticipant.findOne({
            where: { conversationId, userId: currentUserId },
            include: [{ model: User, as: 'user' }] // Kita butuh nama user untuk system message
        });

        if (!isMember) {
            throw new AppError({
                message: 'you_are_not_a_participant',
                code: 403,
                statusCode: 'FORBIDDEN'
            });
        }

        // 4. Cari tahu siapa saja target yang SUDAH ada di dalam grup untuk mencegah duplikat
        const existingParticipants = await ConversationParticipant.findAll({
            where: {
                conversationId,
                userId: { [Op.in]: participantIds }
            }
        });
        const existingUserIds = existingParticipants.map(p => p.userId);

        // 5. Saring hanya ID yang BELUM bergabung
        const newIdsToAdd = participantIds.filter(id => !existingUserIds.includes(id));

        if (newIdsToAdd.length === 0) {
            throw new AppError({
                message: 'all_users_already_in_group',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // 6. Validasi apakah user target benar-benar ada di database (bukan UUID ngawur)
        const usersToAdd = await User.findAll({
            where: { id: { [Op.in]: newIdsToAdd } }
        });

        const validNewUserIds = usersToAdd.map(u => u.id);
        if (validNewUserIds.length === 0) {
            throw new AppError({
                message: 'users_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        // 7. Tambahkan peserta ke database (Bulk Create)
        const participantsData = validNewUserIds.map(userId => ({
            conversationId,
            userId,
        }));
        const createdParticipants = await ConversationParticipant.bulkCreate(participantsData, { returning: true });

        // 8. Buat System Message (mengikuti pola di createConversation kamu)
        const addedNames = usersToAdd.map(u => u.name).join(', ');
        const actorName = isMember.user.name;

        const systemMessage = await Message.create({
            conversationId: conversation.id,
            senderId: currentUserId,
            type: 'system',
            content: `${actorName} added ${addedNames}`,
            systemEventType: 'USERS_ADDED',
            systemMetadata: {
                actorId: currentUserId,
                actorName: actorName,
                addedUserIds: validNewUserIds, // Simpan ID siapa saja yang masuk
                addedUserNames: addedNames,
                conversationId: conversation.id,
                groupName: conversation.name,
            }
        });

        // 9. Format response data
        const finalConversation = {
            ...conversation.toJSON(),
            groupImage: conversation.groupImage ? buildAvatarUrl(conversation.groupImage, baseUrl) : null,
        };

        const addedParticipantsFormatted = createdParticipants.map(cp => {
            const targetUser = usersToAdd.find(u => u.id === cp.userId);

            return {
                id: cp.id,
                conversationId: cp.conversationId,
                userId: cp.userId,
                lastReadMessageId: cp.lastReadMessageId || null,
                joinedAt: cp.joinedAt,
                user: targetUser ? {
                    ...targetUser.toJSON(),
                    avatarUrl: buildAvatarUrl(targetUser.avatarUrl, baseUrl)
                } : null
            };
        });

        return {
            conversation: finalConversation,
            addedParticipants: addedParticipantsFormatted, // Sekarang bertipe List<ConversationParticipantModel>
            message: systemMessage
        };
    }

    static async joinGroupConversation(conversationId, userId, baseUrl) {
        const transaction = await sequelize.transaction();

        try {
            // 1. Cari percakapan & pastikan tipe-nya group
            const conversation = await Conversation.findByPk(conversationId, { transaction });
            if (!conversation) {
                throw new AppError({
                    code: 404,
                    statusCode: 'NOT_FOUND',
                    message: 'conversation_not_found'
                });
            }

            if (conversation.type !== 'group') {
                throw new AppError({
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    message: 'cannot_join_private_conversation'
                });
            }

            // 2. Cek apakah user sudah menjadi anggota grup
            const existingParticipant = await ConversationParticipant.findOne({
                where: {
                    conversationId: conversationId,
                    userId: userId
                },
                transaction
            });

            if (existingParticipant) {
                throw new AppError({
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    message: 'already_group_member'
                });
            }

            // 3. Tambahkan user ke ConversationParticipant
            const newParticipant = await ConversationParticipant.create({
                conversationId: conversationId,
                userId: userId,
                joinedAt: new Date()
            }, { transaction });

            // 4. Ambil data User untuk keperluan metadata System Message
            const user = await User.findByPk(userId, {
                transaction
            });

            // 5. Buat System Message ("User A bergabung ke dalam grup")
            const systemMessage = await Message.create({
                conversationId: conversationId,
                senderId: userId, // atau null jika sistem
                type: 'system',
                content: `${user.name || user.username} joined the group`,
                systemMetadata: {
                    action: 'USER_JOINED',
                    actorId: user.id,
                    actorName: user.name || user.username,
                }
            }, { transaction });

            await transaction.commit();

            // 6. Format response data percakapan terbaru
            const updatedConversation = await this.getConversationById(
                conversationId,
                userId,
                true,
                baseUrl
            );

            const joinedParticipantFormatted = {
                id: newParticipant.id,
                conversationId: newParticipant.conversationId,
                userId: newParticipant.userId,
                lastReadMessageId: newParticipant.lastReadMessageId || null,
                joinedAt: newParticipant.joinedAt,
                user: user ? {
                    ...user.toJSON(),
                    avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl),
                } : null
            };

            return {
                conversation: updatedConversation,
                joinedParticipant: joinedParticipantFormatted,
                message: systemMessage
            };

        } catch (error) {
            throw new AppError({
                code: 400,
                statusCode: 'BAD_REQUEST',
                message: 'already_group_member'
            });
            await transaction.rollback();
            throw error;
        }
    }

    /**
    * Gets the ID of a private conversation between two users.
    * Suitable for use in the block/unblock feature.
    */
    static async getPrivateConversationId(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId) return null;

        const existingConversations = await ConversationParticipant.findAll({
            where: {
                userId: { [Op.in]: [currentUserId, targetUserId] }
            },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                    where: { type: 'private' },
                    attributes: ['id'] // Kita cuma butuh ID-nya
                }
            ]
        });

        // Group by conversationId
        const conversationGroups = {};
        existingConversations.forEach(cp => {
            if (!conversationGroups[cp.conversationId]) {
                conversationGroups[cp.conversationId] = [];
            }
            // Prevent duplication of the same data
            if (!conversationGroups[cp.conversationId].includes(cp.userId)) {
                conversationGroups[cp.conversationId].push(cp.userId);
            }
        });

        // Find conversations that contain exactly those 2 users
        for (const convId in conversationGroups) {
            if (conversationGroups[convId].length === 2) {
                return convId;
            }
        }

        return null; // If you have never chatted
    }
}

module.exports = ConversationService;
