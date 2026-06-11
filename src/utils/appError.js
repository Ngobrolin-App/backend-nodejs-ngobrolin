class AppError extends Error {
    constructor({ message, code, statusCode, errors = [] }) {
        super(message);

        this.message = message;
        this.code = code;
        this.statusCode = statusCode;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;