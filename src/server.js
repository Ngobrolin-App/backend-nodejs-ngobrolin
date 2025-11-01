const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Database and models
const { sequelize } = require('./config/database');
require('./models'); // This will load all models and associations

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

// Import socket handlers
const socketHandlers = require('./socket/socketHandlers');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
    cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make io available in routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socketHandlers(socket, io);
});

// Database connection and server start
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');

        // Sync database (create tables if they don't exist)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ Database synchronized successfully.');
        } else {
            await sequelize.sync();
            console.log('✅ Database synchronized successfully.');
        }

        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('❌ Unable to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };