const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Must be a valid email address'),
    body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('Name is required and must be less than 100 characters')
        .trim(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
    body('username')
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const forgotPasswordValidation = [
    body('email')
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Must be a valid email address')
];

const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];

// Routes
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.post('/forgot-password', forgotPasswordValidation, AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, AuthController.resetPassword);

module.exports = router;