module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join_room', (conversationId) => {
            socket.join(conversationId);
            console.log(`User ${socket.id} joined room ${conversationId}`);
        });

        socket.on('send_message', (data) => {
            socket.to(data.conversationId).emit('receive_message', data);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};