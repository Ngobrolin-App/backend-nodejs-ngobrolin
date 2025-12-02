const express = require('express');
const { body } = require('express-validator');
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'messages');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user?.userId || 'unknown'}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// Validation rules
const getMessagesValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    body('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

const sendMessageValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message content must be between 1 and 5000 characters')
        .trim(),
    body('type')
        .optional()
        .isIn(['text', 'image', 'file', 'audio', 'video'])
        .withMessage('Message type must be one of: text, image, file, audio, video')
];

const updateMessageValidation = [
    body('messageId')
        .notEmpty()
        .withMessage('Message ID is required')
        .isUUID()
        .withMessage('Message ID must be a valid UUID'),
    body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message content must be between 1 and 5000 characters')
        .trim()
];

const deleteMessageValidation = [
    body('messageId')
        .notEmpty()
        .withMessage('Message ID is required')
        .isUUID()
        .withMessage('Message ID must be a valid UUID')
];

const markAsReadValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('messageId')
        .notEmpty()
        .withMessage('Message ID is required')
        .isUUID()
        .withMessage('Message ID must be a valid UUID')
];

// Routes - All POST methods
router.post('/upload', authenticateToken, upload.single('file'), MessageController.uploadAttachment);
router.post('/get', authenticateToken, getMessagesValidation, MessageController.getMessages);
router.post('/send', authenticateToken, sendMessageValidation, MessageController.sendMessage);
router.post('/update', authenticateToken, updateMessageValidation, MessageController.updateMessage);
router.post('/delete', authenticateToken, deleteMessageValidation, MessageController.deleteMessage);
router.post('/mark-read', authenticateToken, markAsReadValidation, MessageController.markAsRead);

module.exports = router;