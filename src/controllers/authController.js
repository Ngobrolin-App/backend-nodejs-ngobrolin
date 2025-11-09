const { User } = require('../models');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { validationResult } = require('express-validator');

function buildAvatarUrl(path, req) {
    if (!path) return null;
    const base = `${req.protocol}://${req.get('host')}`;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
}

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
                user: { ...newUser.toJSON(), avatarUrl: buildAvatarUrl(newUser.avatarUrl, req) },
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
                user: { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, req) },
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
                user: { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, req) }
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

            const { name, bio, language, isPrivate, currentPassword, newPassword, avatarUrl } = req.body;
            const user = await User.findByPk(req.user.userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Handle password change if provided
            if (currentPassword && newPassword) {
                const isValidPassword = await comparePassword(currentPassword, user.password);
                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }
                const hashedPassword = await hashPassword(newPassword);
                user.password = hashedPassword;
            }

            // Handle avatar file upload atau path yang dikirim
            let finalAvatarUrl = user.avatarUrl;
            if (req.file) {
                // Simpan path relatif saja
                finalAvatarUrl = `/uploads/avatars/${req.file.filename}`;
            } else if (avatarUrl) {
                // Terima path relatif dari body
                finalAvatarUrl = avatarUrl;
            }

            // Update other fields
            user.name = name || user.name;
            user.bio = bio !== undefined ? bio : user.bio;
            user.language = language || user.language;
            user.isPrivate = isPrivate !== undefined ? isPrivate : user.isPrivate;
            user.avatarUrl = finalAvatarUrl;

            await user.save();

            res.json({
                message: 'Profile updated successfully',
                user: { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, req) }
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