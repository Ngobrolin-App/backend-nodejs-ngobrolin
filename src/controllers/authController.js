const { validationResult } = require('express-validator');
const AuthService = require('../services/authService');

class AuthController {
    // Register new user
    static async register(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await AuthService.register(req.body, baseUrl);

            res.status(201).json({
                message: 'User registered successfully',
                user: result.user,
                token: result.token
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Login user
    static async login(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await AuthService.login(req.body, baseUrl);

            res.json({
                message: 'Login successful',
                user: result.user,
                token: result.token
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const user = await AuthService.getProfile(req.user.userId, baseUrl);

            res.json({ user });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const user = await AuthService.updateProfile(
                req.user.userId,
                req.body,
                req.file,
                baseUrl
            );

            res.json({
                message: 'Profile updated successfully',
                user
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = AuthController;
