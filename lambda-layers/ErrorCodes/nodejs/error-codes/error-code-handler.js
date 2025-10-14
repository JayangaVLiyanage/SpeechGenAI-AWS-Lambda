export const ERROR_CODES = {
    // ─────────────────────────────
    // USER AUTHENTICATION
    // ─────────────────────────────
    UNAUTHORIZED: {
        code: "UNAUTHORIZED",
        message: "You must be logged in to perform this action.",
        statusCode: 401,
    },
    INVALID_SESSION: {
        code: "INVALID_SESSION",
        message: "Your session is invalid or expired. Please log in again.",
        statusCode: 401,
    },
    USER_NOT_FOUND: {
        code: "USER_NOT_FOUND",
        message: "User account not found.",
        statusCode: 404,
    },

    // ─────────────────────────────
    // PAYMENT & SUBSCRIPTIONS
    // ─────────────────────────────
    PAYMENT_REQUIRED: {
        code: "PAYMENT_REQUIRED",
        message: "This feature requires a paid subscription.",
        statusCode: 402,
    },
    PAYMENT_FAILED: {
        code: "PAYMENT_FAILED",
        message: "Payment processing failed. Please try again.",
        statusCode: 500,
    },
    PLAN_EXPIRED: {
        code: "PLAN_EXPIRED",
        message: "Your subscription has expired.",
        statusCode: 403,
    },
        
    // ─────────────────────────────
    //  SPEECH GENERATION
    // ─────────────────────────────
    GENERATION_FAILED: {
        code: "GENERATION_FAILED",
        message: "Speech generation failed. Please try again later.",
        statusCode: 500,
    },
    INVALID_SPEECH_INPUT: {
        code: "INVALID_SPEECH_INPUT",
        message: "The provided input for speech is invalid.",
        statusCode: 400,
    },
    TOO_MANY_REQUESTS: {
        code: "TOO_MANY_REQUESTS",
        message: "You are sending requests too quickly. Please wait.",
        statusCode: 429,
    },

    // ─────────────────────────────
    // SPEECH RETRIEVAL
    // ─────────────────────────────
    SPEECH_NOT_FOUND: {
        code: "SPEECH_NOT_FOUND",
        message: "The requested speech could not be found.",
        statusCode: 404,
    },
    SPEECH_SAVE_FAILED: {
        code: "SPEECH_SAVE_FAILED",
        message: "Failed to save the speech. Please try again.",
        statusCode: 500,
    },
    INVALID_SPEECH_ID: {
        code: "INVALID_SPEECH_ID",
        message: "The speech ID provided is invalid.",
        statusCode: 400,
    },

    // ─────────────────────────────
    // GENERAL / SERVER
    // ─────────────────────────────
    VALIDATION_ERROR: {
        code: "VALIDATION_ERROR",
        message: "Some input fields are missing or invalid.",
        statusCode: 400,
    },
    SERVER_ERROR: {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        statusCode: 500,
    },
    NOT_FOUND: {
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
        statusCode: 404,
    },
    METHOD_NOT_ALLOWED: {
        code: "METHOD_NOT_ALLOWED",
        message: "This method is not allowed for the requested resource.",
        statusCode: 405,
    },
};

export const getErrorResponse = (errorObj, details = null) => {
    return {
        statusCode: errorObj.statusCode,
        body: JSON.stringify({
            success: false,
            error: {
                code: errorObj.code,
                message: errorObj.message,
                ...(details ? { details } : {}),
            },
        }),
    };
}
