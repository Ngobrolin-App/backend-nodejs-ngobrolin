const express = require('express');
const { body } = require('express-validator');
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const { uploadMessage } = require('../middleware/upload');

const router = express.Router();

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
        .optional()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message content must be between 1 and 5000 characters')
        .trim(),
    body('type')
        .optional()
        .isIn(['text', 'image', 'file', 'audio', 'video'])
        .withMessage('Message type must be one of: text, image, file, audio, video'),
    body('repliedMessageId')
        .optional()
        .isUUID()
        .withMessage('Replied Message ID must be a valid UUID'),
    body('mediaUrl')
        .optional()
        .isString()
        .withMessage('Media URL must be a string'),
    body('mediaFileType')
        .optional()
        .isString()
        .withMessage('Media file type must be a string'),
    body('mediaSize')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Media size must be a positive integer'),
    body('mediaFileName')
        .optional()
        .isString()
        .withMessage('Media file name must be a string')
        .trim(),
    body('forwardedFromMessageId')
        .optional()
        .isUUID()
        .withMessage('Forwarded From Message ID must be a valid UUID'),
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
router.post('/upload', authenticateToken, uploadMessage.single('file'), MessageController.uploadAttachment);
router.post('/get', authenticateToken, getMessagesValidation, MessageController.getMessages);
router.post('/send', authenticateToken, sendMessageValidation, MessageController.sendMessage);
router.post('/update', authenticateToken, updateMessageValidation, MessageController.updateMessage);
router.post('/delete', authenticateToken, deleteMessageValidation, MessageController.deleteMessage);
router.post('/mark-read', authenticateToken, markAsReadValidation, MessageController.markAsRead);

module.exports = router;