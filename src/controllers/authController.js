const { User } = require('../models');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { validationResult } = require('express-validator');

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

            const { username, name, password } = req.body;

            // Check if username already exists
            const existingUser = await User.findOne({
                where: { username }
            });

            if (existingUser) {
                return res.status(400).json({
                    error: 'Username already exists'
                });
            }

            // Hash password
            const hashedPassword = await hashPassword(password);

            // Create user
            const newUser = await User.create({
                username,
                name,
                password: hashedPassword
            });

            // Generate token
            const token = generateToken({ userId: newUser.id });

            res.status(201).json({
                message: 'User registered successfully',
                user: newUser.toJSON(),
                token
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({
                error: 'Internal server error'
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

            const { username, password } = req.body;

            // Find user
            const user = await User.findOne({
                where: { username }
            });

            if (!user) {
                return res.status(401).json({
                    error: 'Invalid credentials'
                });
            }

            // Check password
            const isValidPassword = await comparePassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Invalid credentials'
                });
            }

            // Generate token
            const token = generateToken({ userId: user.id });

            res.json({
                message: 'Login successful',
                user: user.toJSON(),
                token
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const user = await User.findByPk(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            res.json({
                user: user.toJSON()
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                error: 'Internal server error'
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

            const { name, bio, language, isPrivate } = req.body;
            
            const user = await User.findByPk(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }

            // Update user
            await user.update({
                name: name || user.name,
                bio: bio !== undefined ? bio : user.bio,
                language: language || user.language,
                isPrivate: isPrivate !== undefined ? isPrivate : user.isPrivate
            });

            res.json({
                message: 'Profile updated successfully',
                user: user.toJSON()
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }
}

module.exports = AuthController;