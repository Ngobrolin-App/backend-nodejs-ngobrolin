const ResponseStatus = require('../constants/responseStatus');

class ApiResponse {
    static success(
        res,
        {
            code = 200,
            statusCode = null,
            message = null,
            data = null
        } = {}
    ) {

        const statusConfig = ResponseStatus[code] || ResponseStatus[200];
        return res.status(code).json({
            code,
            statusCode: statusCode || statusConfig.statusCode,
            message: message || statusConfig.message,
            data
        });
    }

    static error(
        res,
        {
            code = 500,
            statusCode = null,
            message = null,
            errors = []
        } = {}
    ) {

        const statusConfig = ResponseStatus[code] || ResponseStatus[500];
        return res.status(code).json({
            code,
            statusCode: statusCode || statusConfig.statusCode,
            message: message || statusConfig.message,
            data: errors
        });
    }
}

module.exports = ApiResponse;