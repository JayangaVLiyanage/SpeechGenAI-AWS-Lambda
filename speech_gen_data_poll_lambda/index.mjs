import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { readFromDynamo, updateInDynamo, saveToDynamo } from '/opt/nodejs/dynamo/index.js';
import { getAuthInfo, getHashedUserId } from '/opt/nodejs/auth/index.js';
import { getErrorResponse, ERROR_CODES } from '/opt/nodejs/error-codes/index.js';
import {
  PACKAGE_STATUS, Throttle_Level, PACKAGE_VALIDITI_PERIOD, PACKAGE_TYPES, PRODUCT_TYPE, PRODUCTS,
  getProductThrottleLevel, getPackageById, getPackageByKey, getPackageValidityPeriod, FREE_SPEECH_COUNT
} from './product-config/index.js';
import { getNewUserProfileObj, getUpdateUserProfileObj } from './user-profile-config/index.js';

const TABLE_NAME = "speech-gen-ai";

// const PACKAGE_STATUS = {
//   ACTIVE: "ACTIVE",// payment success
//   EXPIRED: "EXPIRED", // time period expired
//   CANCELED: "CANCELED", // user unsubscribed 
//   PENDING: "PENDING", // payment pending (waiting for payment success event)
//   FAILED: "FAILED", // payment failed
//   ERROR: "ERROR", // issue
//   UNKNOWN: "UNKNOWN" // Not defined
// };

// const PACKAGE_VALIDITI_PERIOD = {
//   hours_2: "2hours",
//   hours_24: "24hours",
//   month_1: "1month"
// }

// const PACKAGE_TYPES = {
//   SUBSCRIPTION: "subscription",
//   ONE_TIME: "one_time",
//   UNKNOWN: "unknown"
// };

// const PRODUCTS = [
//   { key: "1month", packageId: 1006086, type: PACKAGE_TYPES.SUBSCRIPTION, validityPeriod: PACKAGE_VALIDITI_PERIOD.month_1, speechCount: 400 },
//   { key: "2hours", packageId: 870513, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_2, speechCount: 4 },
//   { key: "24hours", packageId: 977951, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_24, speechCount: 50 },
// ];

// const getPackage = (productId) => {

//   const pkg = PRODUCTS.find(p => p.packageId === productId);

//   if (!pkg) {
//     return null;
//   }

//   return pkg;
// };

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
  // Send request to save the error
  await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#DATA-POLL#" + jobId), errorMessage);
}

const getValidatedAuthentication = async (headers) => {

  //logError("headers", headers);
  if (!headers) {

    logError("[Lambda/getValidatedAuthentication] Invalid Request - Headers are missing", headers);
    return { success: false, status: 400, message: "[Lambda/getValidatedAuthentication] Invalid Request - Headers are missing", headers: headers }

    // await saveError(jobID, { message: "Invalid Request - Headers are missing", headers: headers })
    // return responseData(400, "Invalid Request");
  }

  const authInfo = await getAuthInfo(headers);

  if (!authInfo || !authInfo.success) {
    logError("[Lambda/getValidatedAuthentication] Failed to Auth User: ", { headers: headers, authInfo: authInfo });
    return { success: false, status: 401, message: "[Lambda/getValidatedAuthentication] Unauthorized Call - Failed to Auth User", headers: headers }
    // await saveError(jobID, { message: "Failed to Auth User", headers: headers, authInfo: authInfo });
    // return responseData(401, "Unauthorized Call");
  }

  const userData = authInfo.data;
  // logError("userData", userData);
  if (!userData || !userData.sub || !userData.email || !userData.name || !userData.authProvider) {
    logError("[Lambda/getValidatedAuthentication] Failed to get Auth user details: ", { headers: headers, authInfo: authInfo });
    return { success: false, status: 401, message: "[Lambda/getValidatedAuthentication] Unauthorized Call - Failed to get Auth user details", headers: headers }
    // await saveError(jobID, { message: "Failed to Auth User", headers: headers, authInfo: authInfo });
    // return responseData(401, "Unauthorized Call");
  }

  return { success: true, data: userData };
}


export const handler = async (event) => {

  logInfo('event', event);

  let jobID = "NO_JOB_ID";

  try {

    const requestBody = JSON.parse(event.body);
    logInfo('requestBody', requestBody);

    if (!requestBody) return responseData(getErrorResponse(ERROR_CODES.VALIDATION_ERROR, { details: 'missing body' }));

    if (!requestBody.type) return responseData(getErrorResponse(ERROR_CODES.VALIDATION_ERROR, { details: 'missing request type' }));


    let PK = ''; // permenet key
    let SK = '';// sort key

    const validatedAuth = await getValidatedAuthentication(event?.headers);
    if (validatedAuth.success) {

      const userData = validatedAuth.data;

      const userIdToHash = "USER#" + userData.authProvider + "#" + userData.sub;
      const hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);

      if (!hashData || !hashData.success || !hashData.data) {
        await saveError(jobID, { message: '[Lambda/Handler] Error generating hash of the user', userData: userData, hashData: hashData })
        return responseData(getErrorResponse(ERROR_CODES.USER_NOT_FOUND, { details: 'Error user hash' }));
      }

      PK = hashData.data; // Set the hash key as permenet key
      SK = "PROFILE";
    }
    else{
      await saveError(jobID, { message: '[Lambda/Handler] Unauthorized User', event: event, validatedAuth: validatedAuth })
      return responseData(getErrorResponse(ERROR_CODES.USER_NOT_FOUND, { details: 'User validation failed' }));
    }


    switch (requestBody.type) {

      case "subscription-status": {

        //User not validated if the PK or SK not defined cannot retrive user details
        if (!PK || !SK) return responseData(getErrorResponse(ERROR_CODES.UNAUTHORIZED, { details: 'No valid PK/SK' }));

        const result = await readFromDynamo(TABLE_NAME, PK, SK);
        if (result && result.success) {

          const dynamoData = result.data;

          if (!dynamoData || !dynamoData.Data) {
            // No user found 
            // Reply success with the empty object if the user not found so front end does not make request again
            return responseData(200, dynamoData);
          }


          let packageStatus = dynamoData.Data?.packageStatus || PACKAGE_STATUS.UNKNOWN;

          let isPackageActive = false;
          if (dynamoData.Data?.packageExpire) {
            const targetTime = new Date(dynamoData.Data.packageExpire);
            const now = new Date();

            const pkg = getPackageById(dynamoData.Data.package);
            const isSubscription = pkg?.type === PACKAGE_TYPES.SUBSCRIPTION;


            // If user unsubscribed package update the status
            if (isSubscription && dynamoData.Data?.packageStatus === PACKAGE_STATUS.CANCELED) {
              packageStatus = PACKAGE_STATUS.CANCELED;
              isPackageActive = false;
            }
            // if not a subscription package and speech count or package time expore (Subscriptions always stay active until they are canceled or unsubscribed)
            else if (!isSubscription && (targetTime < now || dynamoData.Data?.speechCount <= 0)) {

              packageStatus = PACKAGE_STATUS.EXPIRED;
              isPackageActive = false;
            }
            else {
              packageStatus = PACKAGE_STATUS.ACTIVE;
              isPackageActive = true;
            }

            const updateData = { "Data.packageStatus": packageStatus };
            const dynamoResult = await updateInDynamo(TABLE_NAME, { PK: PK, SK: SK }, updateData);

            if (!dynamoResult || !dynamoResult.success) {
              await saveError(jobID, { message: "Failed to update the user status ", event: event, authInfo: authInfo, dynamoResult: dynamoResult });
            }
          }

          const userData = {
            authProvider: dynamoData.Data?.authProvider || '',
            isPackageActive: isPackageActive || false,
            packageStatus: packageStatus || PACKAGE_STATUS.UNKNOWN,
            packageType: dynamoData.Data?.packageType || PRODUCT_TYPE.Free,
            userName: dynamoData.Data?.name || '',
            package: dynamoData.Data?.package || 0,
            userID: dynamoData.Data?.userID || '',
            pkgStart: dynamoData.Data?.packageStarted || '',
            pkgExpire: dynamoData.Data?.packageExpire || '',
            speechCount: dynamoData.Data?.speechCount || 0
          }

          return responseData(200, userData);

        }
        else {
          await saveError(jobID, { type: requestBody.type, DBParams: { TABLE_NAME: TABLE_NAME, PK: PK, SK: SK }, error: result });
          return responseData(getErrorResponse(ERROR_CODES.USER_NOT_FOUND, { details: 'Issue reading DB' })); // Front end will Poll the data few times 
        }

        break;
      }

      case "generated-speech": {

        if (!requestBody.jobId) return responseData(getErrorResponse(ERROR_CODES.INVALID_SPEECH_ID));

        jobID = requestBody.jobId; // Set the JOB id if avialable

        const speechPK = "JOB#" + jobID;
        const speechSK = "META#SPEECHDATA";
        const resultSpeech = await readFromDynamo(TABLE_NAME, speechPK, speechSK);
        //console.log(`generated-speech: ${JSON.stringify(result)}`);
        if (resultSpeech && resultSpeech.success) {

          const speechData = resultSpeech.data?.Data || null;
          console.log(`**** speechData: ${JSON.stringify(speechData)}`);

          if (speechData === null || speechData?.speech?.trim() === "") {
            return responseData(getErrorResponse(ERROR_CODES.SPEECH_NOT_FOUND, { details: "Response pending : still processing" }));
          }

          let speechCount = 0;

          if (PK && SK) { // Update the user profile only if PK and SK present

            const resultProfile = await readFromDynamo(TABLE_NAME, PK, SK);
            logInfo(`resultProfile: ${JSON.stringify(resultProfile)}`);
            if (resultProfile && resultProfile.success) {

              const profileData = resultProfile?.data?.Data;

              if (profileData) {
                speechCount = Number(profileData.speechCount) || 0;

                // Speech atleast should longer than 50 characters to reduce the speech count.
                // Sometimes the we save error message in db to show user (Below 50 chracters). These are not counted as speeches so no reduce speech count 
                if (speechCount > 0 && speechData?.speech?.trim().length > 50) {

                  speechCount--;

                  const updateData = {
                    "Data.speechCount": speechCount
                  };
                  const dynamoResult = await updateInDynamo(TABLE_NAME, { PK: PK, SK: SK }, updateData);

                  if (!dynamoResult || !dynamoResult.success) {
                    logError("[Lamda/Handler]Failed to update the user status ", { PK: PK, SK: SK, updateData: updateData, dynamoResult: dynamoResult });
                    await saveError(jobID, { message: "[Lamda/Handler]Failed to update the user status ", PK: PK, SK: SK, updateData: updateData, dynamoResult: dynamoResult });
                  }
                }
              }
            }
            else { // Add new user to the DB

              const freePkg = getPackageByKey(PRODUCT_TYPE.Free);
              const packageValidityTime = getPackageValidityPeriod(freePkg.packageId);
              if (!packageValidityTime || !packageValidityTime.success || !packageValidityTime.data
                || !packageValidityTime.data.packageStart || !packageValidityTime.data.packageExpiry
              ) {
                await saveError(jobID, { type: requestBody.type, message:'Issue when getting package validity period',  DBParams: { TABLE_NAME: TABLE_NAME, PK: PK, SK: SK, freePkg:freePkg, packageValidityTime:packageValidityTime  }, error: resultProfile?.data });
                return responseData(getErrorResponse(401, { details: " Issue when getting package validity period" }));
              }

              const dataSavedTime = new Date().toISOString(); // This acts as the part of the sort key for each entry

              const newUserProfileProps = {
                PK: PK,
                userId: userData.sub,
                authProvider: userData.authProvider,
                name: userData.name,
                speechCount: ( speechData?.speech?.trim().length > 50) ? freePkg.speechCount - 1 : freePkg.speechCount, // If speech generated recude the free speech count
                packageType: freePkg.key,
                packageId: String(freePkg.packageId),
                packageStatus: PACKAGE_STATUS.ACTIVE,
                packageStarted: packageValidityTime.data.packageStart,
                packageExpire: packageValidityTime.data.packageExpiry,
                pkgSortKeyItem: PRODUCT_TYPE.Free,
                dataSavedTime: dataSavedTime
              }

              dynamoResult = await saveToDynamo(TABLE_NAME, getNewUserProfileObj(newUserProfileProps));
              if (!dynamoResult || !dynamoResult.success) {
                await saveError(jobID, { message: 'Issue when saving new user profile object to DB', DBParams: { TABLE_NAME: TABLE_NAME, newUserProfileProps: newUserProfileProps, dynamoResult: dynamoResult } });
                return responseData(401, { details: "Issue when saving new user profile object to DB" });
              }
            }
          }


          const updatedSpeechData = {
            ...speechData,
            user: {
              ...speechData.user,
              speechCount: speechCount  // change nested field
            }
          };
          logInfo("****updatedSpeechData", updatedSpeechData);
          return responseData(200, updatedSpeechData);
        }
        else {

          await saveError(jobID, { type: requestBody.type, DBParams: { TABLE_NAME: TABLE_NAME, speechPK: speechPK, speechSK: speechSK }, error: resultSpeech });
          return responseData(getErrorResponse(ERROR_CODES.SPEECH_NOT_FOUND, { details: "No Result; Retry" })); // Front end will Poll the data few times 
        }

        break;
      }

      default: {
        //await saveError(jobID, { message: "Invalid polling type", requestBody: requestBody });
        return responseData(getErrorResponse(ERROR_CODES.METHOD_NOT_ALLOWED, { details: "Invalid polling type" }));
      }

    }
  }
  catch (err) {

    const errorData = formatException(err);
    logError("[Lambda/handler] Error Handler/Try-Catch:", { error: errorData });

    jobID = jobID || "NO_JOB_ID"; // If jobID empty set it to this string value so it is easy to identify in the DB error log
    await saveError(jobID, { message: "Handler/Try-Catch", error: errorData });

    return responseData(getErrorResponse(ERROR_CODES.SERVER_ERROR, { details: "Internal Server Error" }));
  }
};


const responseData = (statusOrResponse = 500, body = {}) => {

  if (typeof statusOrResponse === 'object' && statusOrResponse !== null) {

    return {
      statusCode: statusOrResponse.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusOrResponse.body || {}),
    };
  }

  // Otherwise treat as (statusCode, body)
  return {
    statusCode: statusOrResponse,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
};


