import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { paymentApiInstance, formatAxiosError, isLemonSqueezyError } from "./paymentAPI.mjs";
import { saveToDynamo } from '/opt/nodejs/dynamo/index.js';
import { getAuthInfo, getHashedUserId } from '/opt/nodejs/auth/index.js';
import crypto from 'crypto';

const TABLE_NAME = "speech-gen-ai";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte base64 string
const IV_LENGTH = 16;

/**
 * Save the generated data to the DB
 * @param {*} pk 
 * @param {*} sk 
 * @param {*} type 
 * @param {*} data 
 * @returns 
 */
const saveToDB = async (pk, sk, type, data, ttl) => {

    try {
        const item = {
          PK: pk,
          SK: sk,
          Type: type,
          TTL: ttl,
          Data: data
        };
  
        const result = await saveToDynamo(TABLE_NAME, item);// Save to DB
  
        if (!result.success) {
          logError("[Lambda/SaveToDB] Error when saving Package to DB: ", { result: JSON.stringify(result) });
          return { success: false, data: result.data };
        }
        else {
          return { success: true, data: result.data };
        }
    }
    catch (err) {
      logError(`Error in saveToDB - : ${item}, Error: ${err.message}`);
      return { success: false, data: formatException(err) };
    }
  }

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
    // Send request to save the error
    await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#PAYMENT-PROCESS#" + jobId), errorMessage);
}

/**
 * Generate user primary key
 * This key will be unique through out the app
 * @param {*} authProvider 
 * @param {*} sub 
 * @returns 
 */
const getUserPrimaryKey = (authProvider, sub) => {

    const userIdToHash = "USER#" + authProvider + "#" + sub;
    const hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);

    if (!hashData || !hashData.success) {
      return { success: false, data: { message: "[Lambda/getUserPrimaryKey] Error when creating user hash key ", authProvider: authProvider, sub: sub, userIdToHash: userIdToHash } };
    }

    return { success: true, data: hashData.data }
}

/**
 * 
 * @param {*} event 
 * @returns 
 */
export const handler = async (event) => {

    let jobId = "NO_JOB_ID";

    //logInfo(event);
    try {
        const headers = event?.headers || '';

        if (!headers) {
            logError("[Lambda/handler] Invalid Request - Headers are missing", event);
            await saveError(jobId, { message: "Invalid Request - Headers are missing", event: event })
            return responseData(400, "Invalid Request");
        }

        let authInfo = await getAuthInfo(headers);

        if(!authInfo || !authInfo.success){
            logError("[Lambda/handler] Unsuccessfull getting Auth info : ", { event: event, authInfo: authInfo });
            await saveError(jobId, { message: "Unsuccessfull getting Auth info", event: event, authInfo: authInfo });
            return responseData(401, "Unauthorized Call");
        }

        authInfo = authInfo?.data || '';

        //logInfo("authInfo", authInfo);
        if (!authInfo.sub || !authInfo.email || !authInfo.name || !authInfo.authProvider) {
            logError("[Lambda/handler] Failed to get Auth user details: ", { event: event, authInfo: authInfo });
            await saveError(jobId, { message: "Failed to Auth User", event: event, authInfo: authInfo });
            return responseData(401, "Unauthorized Call");
        }

        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        if (!requestBody ||
            !requestBody.jobId ||
            !requestBody.productId ||
            !requestBody.acknowledged ||
            !requestBody.termsConditionVersion ||
            !requestBody.privacyPolicyVersion
        ) {
            const id = requestBody?.jobId || "NO_JOB_ID";
            logError("[Lambda/handler] Missing Payment related data: ", { event: event, requestBody: requestBody });
            await saveError(id, { message: "Failed to Auth User", event: event, requestBody: requestBody });
            return responseData(400, { message: "Missing Payment related data", data: requestBody });
        }

        jobId = requestBody.jobId;
        const productId = requestBody.productId;


        const userData = {
            ...authInfo,
            productId: productId,
            agreedToTerms: requestBody.acknowledged,
            termsConditionVersion: requestBody.termsConditionVersion,
            privacyPolicyVersion: requestBody.privacyPolicyVersion
        }

        const pkResult = getUserPrimaryKey(authInfo.authProvider, authInfo.sub);
        if(!pkResult || !pkResult.success) {
            logError("[Lambda/handler] Failed to get User Primary Key: ", { authInfo: authInfo, pkResult: pkResult });
            await saveError(jobId, { message: "Failed to get User Primary Key", authInfo: authInfo, pkResult: pkResult });
            return responseData(500, "Failed to get User Primary Key");
        }

        const pk = pkResult.data;
        const sk = "META#PAYMENTDATA#TEMP";
        const type = "payment";
        const dataToSave = { userData: userData};
        const ttl = Math.floor(Date.now() / 1000) + 15 * 60;// Calculate TTL (15 minutes from now)

        const tempPaymentSaved = await saveToDB(pk, sk, type, dataToSave, ttl);
        
        if(!tempPaymentSaved || !tempPaymentSaved.success){
            logError("[Lambda/handler] Failed to save Payment Temp Data: ", { pk, sk, type, dataToSave, ttl , tempPaymentSaved});
            await saveError(jobId, { message: "Failed to save Payment Temp Data", pk, sk, type, dataToSave, ttl , tempPaymentSaved });
            return responseData(500, "Failed to save Payment Temp Data");
        }



     /**
     * ``pk`` is the permenet key for consent package  profile and payment data
     * 
     * If you pass your internal user identifier as custom data (for example, user_id) when the customer first subscribes, 
     * this custom data will be permanently attached to the subscription in Lemon Squeezy.
     * For every future webhook event, including recurring monthly payment successes (such as subscription_payment_success), 
     * the custom data you passed will be included in the webhook payload.
     * 
     * You can then use this value to reliably identify and match the customer in your system for every recurring event,
     * regardless of the email they entered at checkout
     */

        const requestToLemonSqueezy = {
            data: {
                type: "checkouts",
                attributes: {
                    checkout_data: {
                        custom: {
                            key: pk,
                            productId: productId.toString()
                        },
                    },
                    product_options: {
                        redirect_url: "https://speechcraft.techralabs.com"
                    }
                },
                relationships: {
                    store: {
                        data: {
                            type: "stores",
                            id: process.env.LEMON_SQUEEZY_STORE_ID.toString(),
                        },
                    },
                    variant: {
                        data: {
                            type: "variants",
                            id: productId.toString(),
                        },
                    },
                },
            },
        }

        const paymentApiResponse = await paymentApiInstance.post("/checkouts",requestToLemonSqueezy);
        
        logInfo('paymentApiResponse: ', requestToLemonSqueezy);
        const checkoutUrl = paymentApiResponse.data?.data?.attributes?.url;
        logInfo('checkoutUrl: ', checkoutUrl);
        if(!checkoutUrl) {
            return responseData(400, "Invalid URL" + checkoutUrl);
        }

        return responseData(200, checkoutUrl);

    }
    catch (error) {

        let errorData = '';

        if(isLemonSqueezyError(error)) {
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

// const logAxiosError = (error, context = "Unknown context") => {
//     // Base error details
//     const errorLog = {
//       context,
//       message: error.message || "Unknown error",
//       isAxiosError: error.isAxiosError || false,
//     };
  
//     if (error.config) {
//       errorLog.request = {
//         url: error.config.url,
//         method: error.config.method,
//         headers: error.config.headers,
//         data: error.config.data,
//         params: error.config.params,
//         baseURL: error.config.baseURL,
//       };
//     }
  
//     if (error.response) {
//       errorLog.response = {
//         status: error.response.status,
//         statusText: error.response.statusText,
//         headers: error.response.headers,
//         data: error.response.data,
//       };
//     }
  
//     if (error.request && !error.response) {
//       // Request was made but no response received
//       errorLog.requestMadeNoResponse = true;
//     }
  
//     // Optional stack trace
//     if (error.stack) {
//       errorLog.stack = error.stack;
//     }
  
//     // Log to console (or send to your logging system)
//     console.error(JSON.stringify(errorLog, null, 2));
    
//     // Return error log object in case you want to do something else
//     return errorLog;
//   }