const express = require('express');
const { body } = require('express-validator');
const UserController = require('../controllers/userController');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be between 1 and 100 characters')
        .trim(),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Must be a valid email address'),
    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters')
        .trim(),
    body('avatarUrl')
        .optional()
        .isString()
        .withMessage('Avatar URL must be a string')
        .trim(),
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),
    body('currentPassword')
        .optional()
        .isLength({ min: 6 })
        .withMessage('Current password must be at least 6 characters'),
    body('newPassword')
        .optional()
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters'),
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
router.post('/profile/update', authenticateToken, uploadAvatar.single('avatar'), updateProfileValidation, AuthController.updateProfile);
router.post('/search', authenticateToken, searchValidation, UserController.searchUsers);
router.post('/get-user', authenticateToken, getUserValidation, UserController.getUserById);
router.post('/block', authenticateToken, blockUserValidation, UserController.blockUser);
router.post('/unblock', authenticateToken, blockUserValidation, UserController.unblockUser);
router.post('/blocked/list', authenticateToken, UserController.getBlockedUsers);

module.exports = router;