const { User, sequelize } = require('../models');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('../utils/auth');
const { buildAvatarUrl } = require('../utils/urlHelper');
const { sendEmail } = require('../utils/email');
const crypto = require('crypto');
const { Op } = require('sequelize');

class AuthService {
    /**
     * Validate socket token
     */
    static async validateSocketToken(token) {
        try {
            const decoded = verifyToken(token);
            const user = await User.findByPk(decoded.userId);

            if (!user) {
                throw new Error('User not found');
            }

            return {
                userId: user.id,
                username: user.username
            };
        } catch (error) {
            throw new Error('Authentication failed');
        }
    }

    /**
     * Register new user
     */
    static async register(userData, baseUrl) {
        const { username, name, password } = userData;

        // Check if username already exists
        const existingUser = await User.findOne({
            where: { username }
        });

        if (existingUser) {
            const error = new Error('Username already exists');
            error.statusCode = 400;
            throw error;
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

        return {
            user: { ...newUser.toJSON(), avatarUrl: buildAvatarUrl(newUser.avatarUrl, baseUrl) },
            token
        };
    }

    /**
     * Login user
     */
    static async login(credentials, baseUrl) {
        const { username, password } = credentials;

        // Find user
        const user = await User.findOne({
            where: { username }
        });

        if (!user) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Check password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Generate token
        const token = generateToken({ userId: user.id });

        return {
            user: { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) },
            token
        };
    }

    /**
     * Get user profile
     */
    static async getProfile(userId, baseUrl) {
        const user = await User.findByPk(userId);

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        return { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) };
    }

    /**
     * Update user profile
     */
    static async updateProfile(userId, updateData, file, baseUrl) {
        const { name, bio, language, isPrivate, currentPassword, newPassword, avatarUrl } = updateData;

        const user = await User.findByPk(userId);

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Handle password change if provided
        if (currentPassword && newPassword) {
            const isValidPassword = await comparePassword(currentPassword, user.password);
            if (!isValidPassword) {
                const error = new Error('Current password is incorrect');
                error.statusCode = 401;
                throw error;
            }
            const hashedPassword = await hashPassword(newPassword);
            user.password = hashedPassword;
        }

        // Handle avatar file upload or path sent
        let finalAvatarUrl = user.avatarUrl;
        if (file) {
            // Save relative path
            finalAvatarUrl = `/uploads/avatars/${file.filename}`;
        } else if (avatarUrl) {
            // Accept relative path from body
            finalAvatarUrl = avatarUrl;
        }

        // Update other fields
        user.name = name || user.name;
        user.bio = bio !== undefined ? bio : user.bio;
        user.language = language || user.language;
        user.isPrivate = isPrivate !== undefined ? isPrivate : user.isPrivate;
        user.avatarUrl = finalAvatarUrl;

        await user.save();

        return { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) };
    }
    /**
     * Forgot Password
     */
    static async forgotPassword(email) {
        // Find user by email
        const user = await User.findOne({ where: { email } });

        if (!user) {
            // Return success anyway to prevent email enumeration
            return { message: 'If the email exists, reset link has been sent' };
        }

        // Generate secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash token for database storage
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set expiry to 1 hour from now
        const expiry = new Date(Date.now() + 60 * 60 * 1000);

        // Save token to DB
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = expiry;
        await user.save();

        // Create reset URL
        // In a real app, this might be a deep link like ngobrolin://reset-password?token=...
        // For now, we'll use an environment variable or generic fallback
        const frontendUrl = process.env.FRONTEND_RESET_URL || 'ngobrolin://reset-password';
        const resetUrl = `${frontendUrl}?token=${resetToken}`;

        // Send email
        const message = `
            <h1>Password Reset Request</h1>
            <p>You requested to reset your password. Please click the link below to reset it:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>If you did not request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
        `;

        sendEmail({
            to: user.email,
            subject: 'Password Reset - Ngobrolin App',
            html: message
        }).catch(async (error) => {
            console.error('Email send background error:', error);
            // Revert token if email failed
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();
        });

        return { message: 'If the email exists, reset link has been sent' };
    }

    /**
     * Reset Password
     */
    static async resetPassword(token, newPassword) {
        // Hash the incoming token to compare with database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with token and check expiry
        const user = await User.findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            const error = new Error('Token is invalid or has expired');
            error.statusCode = 400;
            throw error;
        }

        // Hash new password
        const newHashedPassword = await hashPassword(newPassword);

        // Update user
        user.password = newHashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return { message: 'Password has been reset successfully' };
    }
}

module.exports = AuthService;
