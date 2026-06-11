const { validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

class AuthController {
    // Register new user
    static async register(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await AuthService.register(req.body, baseUrl);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'register_success',
                data: {
                    user: result.user,
                    token: result.token
                }
            });
        } catch (error) {
            console.error('AuthController - Register error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Login user
    static async login(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await AuthService.login(req.body, baseUrl);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'login_success',
                data: {
                    user: result.user,
                    token: result.token
                }
            });
        } catch (error) {
            console.error('AuthController - Login error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            console.log('AuthController - Get profile for userId:', req.user.userId);

            const result = await AuthService.getProfile(req.user.userId, baseUrl);

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'data_retrieved',
                data: result
            });

        } catch (error) {
            console.error('AuthController - Get profile error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await AuthService.updateProfile(
                req.user.userId,
                req.body,
                req.file,
                baseUrl
            );

            ApiResponse.success(res, {
                code: 200,
                status: 'OK',
                message: 'profile_updated',
                data: result

            });

        } catch (error) {
            console.error('AuthController - Update profile error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Forgot Password
    static async forgotPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const result = await AuthService.forgotPassword(req.body.email);

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: result.message,
            });
        } catch (error) {
            console.error('AuthContoller - forgotPassword() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }

    // Reset Password
    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError({
                    message: 'validation_failed',
                    code: 400,
                    statusCode: 'BAD_REQUEST',
                    errors: errors.array()
                });
            }

            const result = await AuthService.resetPassword(req.body.token, req.body.newPassword);

            ApiResponse.success(res, {
                code: 200,
                statusCode: 'OK',
                message: result.message,
            });
        } catch (error) {
            console.error('AuthContoller - resetPassword() error:', error);
            ApiResponse.error(res, {
                code: error.code,
                statusCode: error.statusCode,
                message: error.message,
                errors: error.errors || []
            });
        }
    }
}

module.exports = AuthController;
