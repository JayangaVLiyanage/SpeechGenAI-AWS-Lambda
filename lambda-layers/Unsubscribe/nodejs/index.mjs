import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { paymentApiInstance, formatAxiosError, isLemonSqueezyError } from "./paymentAPI.mjs";
import { saveToDynamo } from '/opt/nodejs/dynamo/index.js';
import { getAuthInfo } from '/opt/nodejs/auth/index.js';
import crypto from 'crypto';

const TABLE_NAME = "speech-gen-ai";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte base64 string
const IV_LENGTH = 16;

const PACKAGE_TYPES = {
    SUBSCRIPTION: "subscription",
    ONE_TIME: "one_time",
    UNKNOWN: "unknown"
};

const PACKAGE_STATUS = {
    ACTIVE: "ACTIVE",// payment success
    EXPIRED: "EXPIRED", // time period expired
    CANCELED: "CANCELED", // user unsubscribed 
    PENDING: "PENDING", // payment pending (waiting for payment success event)
    FAILED: "FAILED", // payment failed
    ERROR: "ERROR", // issue
    UNKNOWN: "UNKNOWN" // Not defined
};

const PACKAGE_VALIDITI_PERIOD = {
    hours_4: "4hours",
    hours_24: "24hours",
    month_1: "1month"
}

const PRODUCTS = [
    { key: "1month", packageId: 977984, type: PACKAGE_TYPES.SUBSCRIPTION, validityPeriod: PACKAGE_VALIDITI_PERIOD.month_1 },
    { key: "4hours", packageId: 870513, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_4 },
    { key: "24hours", packageId: 977951, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_24 },
];

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
    // Send request to save the error
    await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#UNSUBSCRIBE#" + jobId), errorMessage);
}

/**
 * 
 * @param {*} event 
 * @returns 
 */
export const handler = async (event) => {

    let jobId = "NO_JOB_ID";

    logInfo(event);

    try {


        const headers = event?.headers || '';

        if (!headers) {
            logError("[Lambda/handler] Invalid Request - Headers are missing", event);
            await saveError(jobId, { message: "Invalid Request - Headers are missing", event: event })
            return responseData(400, "Invalid Request");
        }

        const authInfo = await getAuthInfo(headers);

        if (!authInfo || !authInfo.success) {
            logError("[Lambda/handler] Unsuccessfull getting Auth info : ", { event: event, authInfo: authInfo });
            await saveError(jobId, { message: "Unsuccessfull getting Auth info", event: event, authInfo: authInfo });
            return responseData(401, "Unauthorized Call");
        }

        const userData = authInfo?.data || '';

        if (!userData || !userData.sub || !userData.email || !userData.name || !userData.authProvider) {
            logError("[Lambda/handler] Failed to get Auth user details: ", { event: event, authInfo: authInfo });
            await saveError(jobID, { message: "Failed to Auth User", event: event, authInfo: authInfo });
            return responseData(401, "Unauthorized Call");
        }

        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        if (!requestBody || !requestBody.type) return responseData(400, "Missing request body or Request type");

        if (requestBody.type !== 'unsubscribe') return responseData(400, "Invalid call");

        const userIdToHash = "USER#" + userData.authProvider + "#" + userData.sub;
        const hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);
        if (!hashData || !hashData.success) {
            return responseData(401, "Unauthorized Call or Invalid user data");
        }

        const PK = hashData.data; // Set the hash key as permenet key
        const SK = "PROFILE";

        const result = await readFromDynamo(TABLE_NAME, PK, SK);
        // console.log("My Dynamo Result ", result);
        // logError("readFromDynamo", result);
        if (!result || !result.success || !result.data || !result.data.Data) {

            await saveError(jobID, { message: "Failed to retrive user data", requestBody: requestBody, authInfo: authInfo, dynamoResult: result });
            return responseData(401, "Invalid user. Please contact");
        }

        const profileData = result.data.Data;


        const pkg = PRODUCTS.find(p => p.packageId === profileData?.package);

        if (!pkg) {
            await saveError(jobID, { message: "Package not exist", pkg: pkg, profileData: profileData, requestBody: requestBody });
            return responseData(401, "Unable to Unsubscribe Invalid package");
        }

        if (pkg.type !== PACKAGE_TYPES.SUBSCRIPTION && !profileData?.package_unique_id) {
            await saveError(jobID, { message: "Invalid package / Not a subscription", pkg: pkg, profileData: profileData, requestBody: requestBody });
            return responseData(401, "Unable to Unsubscribe Invalid package");
        }



        const paymentApiResponse = await paymentApiInstance.delete(`/subscriptions/${profileData.package_unique_id}`);
        return responseData(200, "Send unsubscribe request successfully");

    } catch (error) {
        
        let errorData = '';

        if (isLemonSqueezyError(error)) {
            errorData = await formatAxiosError(error);
        }
        else {
            errorData = formatException(error);
        }

        jobId = jobId || "NO_JOB_ID";

        logError("[Lambda/handler] Error Handler/Try-Catch:", { error: errorData });

        await saveError(jobId, { message: "Handler/Try-Catch", error: errorData });

        return responseData(500, `Failed the payment loading ${errorData}`);

    }

};

const responseData = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});