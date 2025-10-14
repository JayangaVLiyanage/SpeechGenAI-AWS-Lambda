import { updateInDynamo } from '/opt/nodejs/dynamo/index.js';// Load the dynamodb layer functions

/**
 * Serialize Exceptions
 * 
 * In AWS Lambda:
 * Errors can come from many sources: custom errors, third-party libraries, AWS SDKs, or system exceptions.
 * Not all errors are properly structured — some might not even be real Error objects.
 * Logging and debugging in Lambda is harder because logs are streamed to CloudWatch, and unstructured errors can result in cryptic logs or no logs at all.
 * 
 */
export const formatException = (err) => ({
    name: err?.name || "UnknownError",
    message: err?.message || "No error message",
    stack: err?.stack || "No stack trace",
    code: err?.code || null,
    statusCode: err?.statusCode || 'empty',
});

/**
 * Log error messages
 * 
 * @param {*} eventName 
 * @param  {...any} errorDetails 
 */
export const logError = (eventName, ...errorDetails) => {
    console.error({
        Log: "--ERROR--",
        event: eventName,
        Details: JSON.stringify(errorDetails, null, 2)
    });
};

/**
 * Log info messages
 * 
 * @param {*} eventName 
 * @param  {...any} details 
 */
export const logInfo = (eventName, ...details) => {
    console.log({
        Log: "--INFO--",
        event: eventName,
        Details: JSON.stringify(details, null, 2)
    });
};

export const saveErrorToDB = async (TABLE_NAME, permenentKey, sortKey, errorMessage) => {

    if (!TABLE_NAME, !permenentKey, !sortKey, !errorMessage) {
        logError("[logger/saveErrorToDB] Incomplete values received: ",
            { TABLE_NAME: TABLE_NAME, permenentKey: permenentKey, sortKey: sortKey, errorMessage: errorMessage }
        );

        return;
    }

    /**
     * `listAppendFields` Notify what fields are appendable as lists
     * Ex: 
     * If error and log values need to be append instead of repalce the previous value listAppendFields = ['error', 'log']
     * and
     * the data belongs to error and log should be passed as an array
     * { errors: ["New error message"], logs: ["New log entry"], status: "active" }
     * Here the new passing errors and logs will append to the existing error and log entry (without deleting the existing values)
     * but 
     * 'status' is not passed as `listAppendFields` so the existing status value will be replaced in the database 
     * 
     */
    const listAppendFields = ["Data"]; 
    const errorData = { ["error-time-" + new Date().toISOString()]: JSON.stringify(errorMessage) };
    const updates = {"Type": 'error', "Data": [errorData] }; // Append error data as a list. This make sure the not to replace the old errors 


    const result = await updateInDynamo(TABLE_NAME, { PK: permenentKey, SK: sortKey }, updates, listAppendFields);

    if (!result.success) {
        logError("[logger/saveErrorToDB] Faild to Save ERROR to the DB: ",
            { TABLE_NAME: TABLE_NAME, permenentKey: permenentKey, sortKey: sortKey, updates: updates, result: result }
        );
    }
}