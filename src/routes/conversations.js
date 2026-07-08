const express = require('express');
const { body, query } = require('express-validator');
const ConversationController = require('../controllers/conversationController');
const { authenticateToken } = require('../middleware/auth');
const { uploadGroupImage } = require('../middleware/upload');

const router = express.Router();

// Validation rules
const createConversationValidation = [
    body('type')
        .optional()
        .isIn(['private', 'group'])
        .withMessage('Type must be either private or group'),
    body('participantId')
        .if(body('type').equals('private'))
        .notEmpty()
        .withMessage('Participant ID is required for private conversations')
        .isUUID()
        .withMessage('Participant ID must be a valid UUID'),
    body('name')
        .if(body('type').equals('group'))
        .notEmpty()
        .withMessage('Name is required for group conversations')
        .isLength({ min: 1, max: 100 })
        .withMessage('Group name must be between 1 and 100 characters')
        .trim(),
    body('participantIds')
        .if(body('type').equals('group'))
        .isArray({ min: 1 })
        .withMessage('Participant IDs must be a non-empty array'),
    body('participantIds.*')
        .if(body('type').equals('group'))
        .isUUID()
        .withMessage('Each participant ID must be a valid UUID'),
    body('groupImage')
        .optional()
        .isString()
        .withMessage('Group image must be a string')
];

const updateConversationValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be between 1 and 100 characters')
        .trim(),
    body('groupImage')
        .optional()
        .isString()
        .withMessage('Group image must be a string')
];

const getConversationValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('isShowParticipants')
        .optional()
        .isBoolean()
        .withMessage('IsShowParticipants must be a boolean')
        .toBoolean()
        .default(true),
    body('isParticipantsIncludeMe')
        .optional()
        .isBoolean()
        .withMessage('IsParticipantsIncludeMe must be a boolean')
        .toBoolean()
        .default(true)
];

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

const leaveConversationValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID')
];

const privateConversationValidation = [
    body('partnerId')
        .notEmpty()
        .withMessage('Partner ID is required')
        .isUUID()
        .withMessage('Partner ID must be a valid UUID')
];

const getConversationParticipantsValidation = [
    body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .isUUID()
        .withMessage('Conversation ID must be a valid UUID'),
    body('isIncludeMe')
        .optional()
        .isBoolean()
        .withMessage('IsIncludeMe must be a boolean')
        .toBoolean()
        .default(true)
];

// Routes - All POST methods
router.post('/list', authenticateToken, paginationValidation, ConversationController.getConversations);
router.post('/private-conversation', authenticateToken, privateConversationValidation, ConversationController.getPrivateConversationByParticipantsIds);
router.post('/participants', authenticateToken, getConversationParticipantsValidation, ConversationController.getConversationParticipants);
router.post('/create', authenticateToken, createConversationValidation, ConversationController.createConversation);
router.post('/get', authenticateToken, getConversationValidation, ConversationController.getConversationById);
router.post('/update', authenticateToken, updateConversationValidation, ConversationController.updateConversation);
router.post('/leave', authenticateToken, leaveConversationValidation, ConversationController.leaveConversation);
router.post('/upload-group-image', authenticateToken, uploadGroupImage.single('groupImage'), ConversationController.uploadGroupImage);

module.exports = router;