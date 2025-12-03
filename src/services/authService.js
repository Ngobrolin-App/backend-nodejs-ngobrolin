const { User } = require('../models');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('../utils/auth');
const { buildAvatarUrl } = require('../utils/urlHelper');

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
}

module.exports = AuthService;
