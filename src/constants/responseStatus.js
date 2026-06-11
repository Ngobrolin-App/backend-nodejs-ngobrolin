const ResponseStatus = Object.freeze({
    // --- 2xx Success ---
    200: { statusCode: 'OK', message: 'success' },
    201: { statusCode: 'CREATED', message: 'resource_created_successfully' },
    202: { statusCode: 'ACCEPTED', message: 'request_accepted_and_processing' },
    204: { statusCode: 'NO_CONTENT', message: 'request_successful_with_no_content' },

    // --- 3xx Redirection ---
    301: { statusCode: 'MOVED_PERMANENTLY', message: 'resource_moved_permanently' },
    302: { statusCode: 'FOUND', message: 'resource_found_elsewhere' },
    304: { statusCode: 'NOT_MODIFIED', message: 'resource_not_modified' },

    // --- 4xx Client Errors ---
    400: { statusCode: 'BAD_REQUEST', message: 'bad_request_or_invalid_syntax' },
    401: { statusCode: 'UNAUTHORIZED', message: 'unauthorized_access_authentication_required' },
    403: { statusCode: 'FORBIDDEN', message: 'forbidden_access_permission_denied' },
    404: { statusCode: 'NOT_FOUND', message: 'resource_not_found' },
    405: { statusCode: 'METHOD_NOT_ALLOWED', message: 'http_method_not_allowed' },
    409: { statusCode: 'CONFLICT', message: 'resource_conflict_state' },
    422: { statusCode: 'UNPROCESSABLE_ENTITY', message: 'validation_error' },
    429: { statusCode: 'TOO_MANY_REQUESTS', message: 'rate_limit_exceeded' },

    // --- 5xx Server Errors ---
    500: { statusCode: 'INTERNAL_SERVER_ERROR', message: 'internal_server_error' },
    501: { statusCode: 'NOT_IMPLEMENTED', message: 'server_does_not_support_functionality' },
    502: { statusCode: 'BAD_GATEWAY', message: 'invalid_response_from_upstream_server' },
    503: { statusCode: 'SERVICE_UNAVAILABLE', message: 'server_temporarily_overloaded_or_down' },
    504: { statusCode: 'GATEWAY_TIMEOUT', message: 'upstream_server_timeout' }
});

module.exports = ResponseStatus;