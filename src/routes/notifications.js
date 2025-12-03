const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const NotificationController = require('../controllers/notificationController');

const router = express.Router();

const registerValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token is required')
        .isString()
        .withMessage('Token must be a string'),
];

router.post('/token/register', authenticateToken, registerValidation, NotificationController.registerToken);

router.post('/token/delete', authenticateToken, registerValidation, NotificationController.deleteToken);

module.exports = router;