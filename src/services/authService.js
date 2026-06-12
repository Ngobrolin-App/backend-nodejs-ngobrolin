const { User, sequelize } = require('../models');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('../utils/auth');
const { buildAvatarUrl } = require('../utils/urlHelper');
const { sendEmail } = require('../utils/email');
const AppError = require('../utils/appError');
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
                throw new AppError(
                    {
                        message: 'user_not_found',
                        code: 404,
                        statusCode: 'BAD_REQUEST'
                    }
                )
            }

            return {
                userId: user.id,
                username: user.username
            };
        } catch (error) {
            throw new AppError(
                {
                    message: 'authentication_failed',
                    code: 401,
                    statusCode: 'UNAUTHORIZED'
                }
            )
        }
    }

    /**
     * Register new user
     */
    static async register(userData, baseUrl) {
        const { username, email, name, password } = userData;

        // Check if email already exists
        const existingEmail = await User.findOne({
            where: { email }
        });

        if (existingEmail) {
            throw new AppError({
                message: 'email_already_exists',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // Check if username already exists
        const existingUsername = await User.findOne({
            where: { username }
        });

        if (existingUsername) {
            throw new AppError({
                message: 'username_already_exists',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const newUser = await User.create({
            username,
            email,
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
     * Login user with username or email and password
     */
    static async login(credentials, baseUrl) {
        const { usernameOrEmail, password } = credentials;

        // Find user
        const user = await User.unscoped().findOne({
            where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] }
        });

        if (!user) {
            throw new AppError({
                message: 'user_with_username_or_email_not_found',
                code: 401,
                statusCode: 'UNAUTHORIZED'
            });
        }

        // Check password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            throw new AppError({
                message: 'password_incorrect',
                code: 401,
                statusCode: 'UNAUTHORIZED'
            });
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
            throw new AppError({
                message: 'user_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        const result = { ...user.toJSON(), avatarUrl: buildAvatarUrl(user.avatarUrl, baseUrl) };

        return result;
    }

    /**
     * Update user profile
     */
    static async updateProfile(userId, updateData, file, baseUrl) {
        const { name, email, bio, language, isPrivate, currentPassword, newPassword, avatarUrl } = updateData;

        const user = await User.unscoped().findByPk(userId);

        if (!user) {
            throw new AppError({
                message: 'user_not_found',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
        }

        // Check if email already exists and belongs to another user
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ where: { email } });
            if (existingEmail) {
                throw new AppError({
                    message: 'email_already_exists',
                    code: 400,
                    statusCode: 'BAD_REQUEST'
                });
            }
            user.email = email;
        }

        // Handle password change if provided
        if (currentPassword && newPassword) {
            const isValidPassword = await comparePassword(currentPassword, user.password);
            if (!isValidPassword) {
                throw new AppError({
                    message: 'current_password_incorrect',
                    code: 401,
                    statusCode: 'UNAUTHORIZED'
                });
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
        const user = await User.unscoped().findOne({ where: { email } });

        if (!user) {
            throw new AppError({
                message: 'email_not_registered',
                code: 404,
                statusCode: 'NOT_FOUND'
            });
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

        // Send email asynchronously so we don't block the frontend response
        try {
            await sendEmail({
                to: user.email,
                subject: 'Password Reset - Ngobrolin App',
                html: message
            })

            return { message: 'reset_password_email_sent_success' };
        } catch (error) {
            console.error('AuthService - forgotPassword() :', error);

            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save().catch(e => console.error('Failed to revert token:', e));

            throw new AppError({
                message: 'reset_password_email_sent_failed',
                code: 500,
                statusCode: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Reset Password
     */
    static async resetPassword(token, newPassword) {
        // Hash the incoming token to compare with database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with token and check expiry
        const user = await User.unscoped().findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            throw new AppError({
                message: 'token_invalid_or_expired',
                code: 400,
                statusCode: 'BAD_REQUEST'
            });
        }

        // Hash new password
        const newHashedPassword = await hashPassword(newPassword);

        // Update user
        user.password = newHashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return { message: 'password_reset_success_desc' };
    }
}

module.exports = AuthService;
