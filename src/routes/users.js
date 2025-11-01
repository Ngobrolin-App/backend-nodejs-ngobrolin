const express = require('express');
const { body } = require('express-validator');
const UserController = require('../controllers/userController');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be between 1 and 100 characters')
        .trim(),
    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters')
        .trim(),
    body('avatarUrl')
        .optional()
        .isURL()
        .withMessage('Avatar URL must be a valid URL'),
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean')
];

const searchValidation = [
    body('q')
        .notEmpty()
        .withMessage('Search query is required')
        .isLength({ min: 1, max: 50 })
        .withMessage('Search query must be between 1 and 50 characters')
];

const getUserValidation = [
    body('userId')
        .notEmpty()
        .withMessage('User ID is required')
        .isUUID()
        .withMessage('User ID must be a valid UUID')
];

const blockUserValidation = [
    body('userId')
        .notEmpty()
        .withMessage('User ID is required')
        .isUUID()
        .withMessage('User ID must be a valid UUID')
];

// Routes - All POST methods
router.post('/profile/get', authenticateToken, AuthController.getProfile);
router.post('/profile/update', authenticateToken, updateProfileValidation, AuthController.updateProfile);
router.post('/search', authenticateToken, searchValidation, UserController.searchUsers);
router.post('/get-user', authenticateToken, getUserValidation, UserController.getUserById);
router.post('/block', authenticateToken, blockUserValidation, UserController.blockUser);
router.post('/unblock', authenticateToken, blockUserValidation, UserController.unblockUser);
router.post('/blocked/list', authenticateToken, UserController.getBlockedUsers);

module.exports = router;