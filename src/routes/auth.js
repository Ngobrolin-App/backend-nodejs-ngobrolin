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

// Routes
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);

module.exports = router;