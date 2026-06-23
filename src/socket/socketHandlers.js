const AuthService = require('../services/authService');
const ConversationService = require('../services/conversationService');

const socketHandlers = (socket, io) => {
    // Authentication middleware for socket
    socket.on('authenticate', async (data) => {
        try {
            const { token } = data;

            const user = await AuthService.validateSocketToken(token);

            socket.userId = user.userId;
            socket.username = user.username;

            socket.join(`user_${socket.userId}`);
            socket.emit('authenticated', {
                message: 'Authentication successful',
                userId: socket.userId
            });

            // console.log(`User ${socket.username || socket.userId} authenticated via socket`);
        } catch (error) {
            console.error('Socket authentication error:', error);
            socket.emit('auth_error', { message: 'Authentication failed' });
            socket.disconnect();
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
            const isParticipant = await ConversationService.isParticipant(conversationId, socket.userId);

            if (!isParticipant) {
                socket.emit('error', { message: 'Access denied to conversation' });
                return;
            }

            socket.join(`conversation_${conversationId}`);
            socket.emit('joined_conversation', { conversationId });

            // console.log(`User ${socket.username} joined conversation ${conversationId}`);
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

            // console.log(`User ${socket.username} left conversation ${conversationId}`);
        } catch (error) {
            console.error('Leave conversation error:', error);
            socket.emit('error', { message: 'Failed to leave conversation' });
        }
    });

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
                // console.log(`User ${socket.username} disconnected`);

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