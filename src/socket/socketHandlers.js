const jwt = require('jsonwebtoken');
const { User, Conversation, ConversationParticipant, Message } = require('../models');

const socketHandlers = (socket, io) => {
    // Authentication middleware for socket
    socket.on('authenticate', async (data) => {
        try {
            const { token } = data;
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findByPk(decoded.userId);
            if (!user) {
                socket.emit('auth_error', { message: 'User not found' });
                return;
            }

            socket.userId = decoded.userId;
            socket.username = decoded.username;

            socket.join(`user_${socket.userId}`);
            socket.emit('authenticated', {
                message: 'Authentication successful',
                userId: socket.userId
            });

            console.log(`User ${socket.username || socket.userId} authenticated via socket`);
        } catch (error) {
            console.error('Socket authentication error:', error);
            socket.emit('auth_error', { message: 'Authentication failed' });
        }
    });

    // Join conversation room
    socket.on('join_conversation', async (data) => {
        try {
            if (!socket.userId) {
                socket.emit('error', { message: 'Not authenticated' });
                return;
            }

            const { conversationId } = data;

            // Check if user is participant in this conversation
            const participation = await ConversationParticipant.findOne({
                where: {
                    conversation_id: conversationId,
                    user_id: socket.userId
                }
            });

            if (!participation) {
                socket.emit('error', { message: 'Access denied to conversation' });
                return;
            }

            socket.join(`conversation_${conversationId}`);
            socket.emit('joined_conversation', { conversationId });

            console.log(`User ${socket.username} joined conversation ${conversationId}`);
        } catch (error) {
            console.error('Join conversation error:', error);
            socket.emit('error', { message: 'Failed to join conversation' });
        }
    });

    // Leave conversation room
    socket.on('leave_conversation', (data) => {
        try {
            const { conversationId } = data;
            socket.leave(`conversation_${conversationId}`);
            socket.emit('left_conversation', { conversationId });

            console.log(`User ${socket.username} left conversation ${conversationId}`);
        } catch (error) {
            console.error('Leave conversation error:', error);
            socket.emit('error', { message: 'Failed to leave conversation' });
        }
    });

    // Kirim echo realtime ke room conversation_{id} dengan event new_message
    // DEPRECATED: Use HTTP POST /api/messages/send instead to ensure DB persistence and single source of truth.
    // socket.on('send_message', async (data) => {
    //     try {
    //         const { conversationId, content, type } = data;
    //         io.to(`conversation_${conversationId}`).emit('new_message', {
    //             message: {
    //                 id: `${Date.now()}`, // id sementara; id final datang dari HTTP API
    //                 conversation_id: conversationId,
    //                 sender_id: socket.userId,
    //                 content,
    //                 type: type || 'text',
    //                 created_at: new Date().toISOString(),
    //             },
    //         });
    //     } catch (error) {
    //         console.error('Socket send_message error:', error);
    //     }
    // });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
        try {
            if (!socket.userId) return;

            const { conversationId } = data;
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId: socket.userId,
                username: socket.username,
                conversationId
            });
        } catch (error) {
            console.error('Typing start error:', error);
        }
    });

    socket.on('typing_stop', (data) => {
        try {
            if (!socket.userId) return;

            const { conversationId } = data;
            socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
                userId: socket.userId,
                username: socket.username,
                conversationId
            });
        } catch (error) {
            console.error('Typing stop error:', error);
        }
    });

    // Handle user status updates
    socket.on('update_status', (data) => {
        try {
            if (!socket.userId) return;

            const { status } = data; // online, away, busy, offline

            // Broadcast status to all user's conversations
            socket.broadcast.emit('user_status_changed', {
                userId: socket.userId,
                username: socket.username,
                status
            });
        } catch (error) {
            console.error('Update status error:', error);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        try {
            if (socket.userId) {
                console.log(`User ${socket.username} disconnected`);

                // Broadcast offline status
                socket.broadcast.emit('user_status_changed', {
                    userId: socket.userId,
                    username: socket.username,
                    status: 'offline'
                });
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
};

module.exports = socketHandlers;
// module.exports = (io) => {
//     io.on('connection', (socket) => {
//         console.log('User connected:', socket.id);
//         socketHandlers(socket, io);
//     });
// };