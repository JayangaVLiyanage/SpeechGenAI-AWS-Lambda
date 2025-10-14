import { OpenAI } from "openai";
import crypto from 'crypto';
import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { saveToDynamo, readFromDynamo, updateInDynamo } from '/opt/nodejs/dynamo/index.js';
import { getAuthInfo, getHashedUserId } from '/opt/nodejs/auth/index.js';
import { getPromptBuilder, getMandetoryFields, isValidSpeechType } from './speech-templates/index.js';
import {
  PACKAGE_STATUS, Throttle_Level, PACKAGE_VALIDITI_PERIOD, PACKAGE_TYPES, PRODUCT_TYPE, PRODUCTS,
  getProductThrottleLevel, getPackageById, getPackageByKey, getPackageValidityPeriod, FREE_SPEECH_COUNT
} from './product-config/index.js';
import { getNewUserProfileObj, getUpdateUserProfileObj } from './user-profile-config/index.js';
import { STATUS_CODES } from './status-codes/index.js';


const TABLE_NAME = "speech-gen-ai";

// Open AI obj
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
  // Send request to save the error
  await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#GENERATE-SPEECH#" + jobId), errorMessage);
}

/**
 * Generate the speech 
 * @param {*} jobid 
 * @param {*} data 
 * @returns 
 */
const generateSpeech = async (jobid, userId, data, packageStatus, packageType, throttleLevel) => {

  try {

    //  console.log("generateSpeech***************", { jobid, data, packageStatus });

    if (!jobid || !data) return { success: false, data: "Missing Job ID or Fields to generate speech" };

    const speechType = data.speechType || SPEECH_TYPES.WEDDING_TOAST;  // Default fallback is wedding toast
    const builder = getPromptBuilder(speechType);
    const promptMessages = builder(data);

    const gptParamsGpt35Turbo = {
      model: "gpt-3.5-turbo",
      messages: promptMessages,
      temperature: 0.8,          // Needs slightly more creativity to sound natural
      top_p: 0.9,                // Common good default
      presence_penalty: 0.7,     // Helps avoid repetitive phrasing
      frequency_penalty: 0.5,    // Keeps structure varied
      max_tokens: 5000,          // 3.5 performs best below 5k tokens
      user: userId
    };

    const gptParamsGpt4oMini = {
      model: "gpt-4o-mini",
      messages: promptMessages,
      temperature: 0.7,          // Balanced creativity
      top_p: 0.9,                // Natural sampling
      presence_penalty: 0.6,     // Encourages new ideas
      frequency_penalty: 0.5,    // Avoids repetition
      max_tokens: 7000,          // Safe upper limit for longer speeches
      user: userId
    };

    const gptParamsGpt4_1 = {
      model: "gpt-4.1-mini",
      messages: promptMessages,
      temperature: 0.7, // Creativity control
      top_p: 0.9, // Nucleus sampling
      presence_penalty: 0.6, // Encourage new topics
      frequency_penalty: 0.5, // Reduce repetition
      max_tokens: 7000, // Limit output size
      user: userId
    };
    const gptParamsGpt5 = {
      model: "gpt-5-mini",
      messages: promptMessages,
      max_completion_tokens: 7000, // Limit output size
      user: userId
    };

    // Free users
    let gptParams = gptParamsGpt4_1;

    // If paid users
    if (packageStatus && packageStatus === PACKAGE_STATUS.ACTIVE 
      && packageType && packageType !== PRODUCT_TYPE.Free) {

      switch (throttleLevel.key) {
        case Throttle_Level.Premium.key:
          gptParams = gptParamsGpt5;
          break;

        case Throttle_Level.Standered.key:
          gptParams = gptParamsGpt4_1;
          break;

        case Throttle_Level.Economy.key:
          gptParams = gptParamsGpt4oMini;
          break;

        default:
          gptParams = gptParamsGpt35Turbo;
          break;
      }

    }

    logInfo("[Lambda/generateSpeech] Params to generate speech :", { gptParams: JSON.stringify(gptParams), packageStatus: packageStatus });

    const response = await openai.chat.completions.create(gptParams);

    return { success: true, data: response.choices[0].message.content };

  } catch (err) {
    logError(`Error in generateSpeech - JobId: ${jobid} UserId: ${userId}, Error: ${err.message}`);
    return { success: false, data: formatException(err) };
  }
};

/**
 * Check if the mandetory fields are present in the data
 * @param {data object to check fields} obj 
 * @param {mandetory fields} fields 
 * @returns 
 */
const hasAllValues = (obj, fields) =>
  fields.every(key => obj[key] !== undefined && obj[key] !== null && obj[key] !== "");

/**
 * Check if the package is expired
 * @param {*} expiryIsoString 
 * @returns 
 */
const isPackageExpired = (expiryIsoString) => {

  if (!expiryIsoString) return true;

  const now = new Date();
  const expiry = new Date(expiryIsoString);

  return expiry.getTime() <= now.getTime(); // Compare timestamps directly
}

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
 * Client request handler method
 * Generate the Speech and save to the DB
 * @param {*} event 
 * @returns 
 */
export const handler = async (event) => {

  logInfo("Received event:", { record: JSON.stringify(event) });

  for (const record of event.Records) {

    let jobId = "NO_JOB_ID";

    try {

      logInfo("Received record:", { record: JSON.stringify(record) });

      const body = JSON.parse(record.body);
      const messageData = body?.payload;// Speech generaiton related data 
      const headers = body.auth;// AUthentication related data

      // By default consider the package is expired
      let packageStatus = PACKAGE_STATUS.UNKNOWN;
      let throttleLevel = Throttle_Level.Standered; // if set to true, speech generation will switch to a lower AI model 

      // If no jobID received set jobID to empty and this will be saved as an error to DB
      jobId = messageData?.jobId || '';

      // If headers, message data or job id is missing return
      if (!headers || !messageData || !jobId) {
        logError("[Lambda/handler]Error in handler - Invalid Request: ", record);
        return responseData(400, "Invalid Request");
      }

      // Check user authentication with OAuth providers -----------------------------------------------
      // const authResult = await getAuthenticationInfo(headers);// Read Auth data from header
      const authResult = await getAuthInfo(headers);

      let profile = null;// User profile data read from the DB
      let isPackageActive = false;
      let PK = 'not_loged_user';// This id is sent to the Open Ai so we can track the api usage per each user to detect anomalies


      if (!authResult || !authResult.success) { // Always authentication layer send success data if it fails need to investigate

        logError("[Lambda/handler] getAuthenticationInfo method call result: ", authResult);
        // Authentication exception; Log in to DB
        await saveError(jobId, { message: "getAuthenticationInfo failed: ", headers: headers, authResult: authResult });

        packageStatus = PACKAGE_STATUS.UNKNOWN;// Free user
      }
      else {

        // Check User Package details --------------------------------------------------------------------
        const authInfo = authResult.data;

        let hashData;
        if (authInfo && authInfo.authProvider && authInfo.sub) {

          const userIdToHash = "USER#" + authInfo.authProvider + "#" + authInfo.sub;
          hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);
        }

        if (!authInfo || !authInfo.authProvider || !authInfo.sub || !hashData || !hashData.success || !hashData.data) {
          logError("[Lambda/saveNewPackageToDatabase] Error when authenitcating user ", { authInfo: authInfo, hashData: hashData });
          // Authentication exception; Log in to DB
          const errMsg = { message: "[Lambda/saveNewPackageToDatabase] Error when authenitcating user ", authInfo: authInfo, hashData: hashData }
          await saveError(jobId, errMsg);
          return responseData(401, { details: " Unauthorized user" });
        }


        PK = hashData?.data || ''; // If user email is empty the dynamo will return nothing as no entry found
        const SK = "PROFILE";

        logInfo("hashData?.data:", { record: JSON.stringify(hashData?.data) });

        let profileData;


        if (PK) {

          profileData = await readFromDynamo(TABLE_NAME, PK, SK);

          logInfo("profileData", { record: JSON.stringify(profileData) });
          if (!profileData || !profileData.success) {

            logError("[Lambda/handler] readFromDynamo method call result: ", profileData);
            // Reading dynamoDB exception; Log in to DB
            const errMsg = { message: "Issue when reading profile from the DB:", TABLE_NAME: TABLE_NAME, PK: PK, SK: SK, profileData: profileData };
            await saveError(jobId, errMsg);
            return responseData(401, { details: "Issue reading the user details" });

          }

          if (!profileData.data) {

            const freePkg = getPackageByKey(PRODUCT_TYPE.Free);
            const packageValidityTime = getPackageValidityPeriod(freePkg.packageId);
            if (!packageValidityTime || !packageValidityTime.success || !packageValidityTime.data
              || !packageValidityTime.data.packageStart || !packageValidityTime.data.packageExpiry
            ) {
              await saveError(jobId, { type: requestBody.type, message: 'Issue when getting package validity period', DBParams: { TABLE_NAME: TABLE_NAME, PK: PK, SK: SK, freePkg: freePkg, packageValidityTime: packageValidityTime }, error: resultProfile?.data });
              return responseData(401, { details: " Issue when getting package validity period" });
            }

            const dataSavedTime = new Date().toISOString(); // This acts as the part of the sort key for each entry

            const newUserProfileProps = {
              PK: PK,
              userId: authInfo.sub,
              authProvider: authInfo.authProvider,
              name: authInfo.name,
              speechCount: freePkg.speechCount, // If speech generated recude the free speech count
              packageType: freePkg.key,
              packageId: String(freePkg.packageId),
              packageStatus: PACKAGE_STATUS.ACTIVE,
              packageStarted: packageValidityTime.data.packageStart,
              packageExpire: packageValidityTime.data.packageExpiry,
              pkgSortKeyItem: PRODUCT_TYPE.Free,
              dataSavedTime: dataSavedTime
            }

            let newUserProfData = getNewUserProfileObj(newUserProfileProps);
            if (!newUserProfData || !newUserProfData.success) {
              await saveError(jobId, { message: 'Issue when saving new user profile object to DB', DBParams: { TABLE_NAME: TABLE_NAME, newUserProfileProps: newUserProfileProps, newUserProfData: newUserProfData } });
              return responseData(401, { details: "Issue when saving new user profile object to DB" });
            }

            newUserProfData = newUserProfData.data;

            logInfo("newUserProfData", { record: JSON.stringify(newUserProfData) });
            profileData = { data: newUserProfData } // Assign to the same database saved structure 

            const dynamoResult = await saveToDynamo(TABLE_NAME, newUserProfData);
            logInfo("newUserdynamoResult", { record: JSON.stringify(dynamoResult) });
            if (!dynamoResult || !dynamoResult.success) {
              const errMsg = { message: "Error Saving new user to the DB", TABLE_NAME: TABLE_NAME, PK: PK, SK: SK, profileData: profileData, dynamoResult: dynamoResult };
              await saveError(jobId, errMsg);
              return responseData(401, { details: " Error registering user" });
            }
          }

          logInfo("profileData", { record: JSON.stringify(profileData) });
          profile = profileData?.data?.Data || '';

          // Set the initial package state
          if (profile) {

            packageStatus = profile.packageStatus;
            const pkg = getPackageById(profile.package);
            const isSubscription = pkg?.type === PACKAGE_TYPES.SUBSCRIPTION;

            if (authInfo.sub === profile.userID && isSubscription) { // Make the subscriptions active as they paid for every month. Throttle heavy users in speech generation logic

              packageStatus = PACKAGE_STATUS.ACTIVE;
              isPackageActive = true;

              if (profile.speechCount)
                throttleLevel = getProductThrottleLevel(pkg, profile.speechCount);  // if true speech will generate uing a lower AI model

            }
            else if (authInfo.sub === profile.userID && !isPackageExpired(profile.packageExpire) && profile?.speechCount > 0) {
              logInfo("Active", { record: JSON.stringify(profile) });
              packageStatus = PACKAGE_STATUS.ACTIVE;
              isPackageActive = true;
            }
            else {// Not a subscription and the Package expired
              logInfo("EXPIRED", { record: JSON.stringify(profile) });
              packageStatus = PACKAGE_STATUS.EXPIRED;
              isPackageActive = false;
            }
          }
          else {// If profile is empty the user not exist in the DB; So treat as a free user
            packageStatus = PACKAGE_STATUS.UNKNOWN;// Free user
            isPackageActive = false;
          }

          // If user unsubscribed package update the status
          if (profile?.packageStatus === PACKAGE_STATUS.CANCELED) {
            packageStatus = PACKAGE_STATUS.CANCELED;
          }

          if (profile) { // If profile available update the package status

            const update = {
              "Data.packageStatus": packageStatus
              // "Data.speechCount": speechCount
            };
            const dynamoResult = await updateInDynamo(TABLE_NAME, { PK: PK, SK: SK }, update);

            // logError('dynamoResult', dynamoResult)

            if (!dynamoResult || !dynamoResult.success) {
              await saveError(jobId, { message: "Failed to update the user status ", event: event, authInfo: authInfo, dynamoResult: dynamoResult });
            }
          }

        }
      }

      logInfo("messageData.speechType", { record: JSON.stringify(messageData.speechType) });
      // Check if the messageData valid and speechType is avialable -------------------------------------------
      if (!messageData.speechType || !isValidSpeechType(messageData.speechType)) {
        logError("[Lambda/handler]Error in handler - Missing or Invalid Speech Type: ", messageData.speechType);
        return responseData(400, "Missing or Invalid Speech Type"); // The missing field info is saved to the DB. Front end will retrive data from polling the DB.
      }

      const requiredFields = getMandetoryFields(messageData.speechType);
      logInfo("requiredFields", { record: JSON.stringify(requiredFields) });
      // Return if required fields are missing
      if (!hasAllValues(messageData, requiredFields)) {
        logError("[Lambda/handler]Error in handler - Missing required fields: ", messageData);
        return responseData(400, "Missing required fields"); // The missing field info is saved to the DB. Front end will retrive data from polling the DB.
      }

      let textToSave = "";
      let speechGenStatus = 'Success';

      logInfo("generateSpeech", { record: JSON.stringify({ jobId, messageData, packageStatus: packageStatus }) });

      if (profile.speechCount > 0) {

        const speechTextResult = await generateSpeech(jobId, PK, messageData, packageStatus, profile?.packageType, throttleLevel);

        logInfo("speechTextResult", { record: JSON.stringify(speechTextResult) });
        if (!speechTextResult || !speechTextResult.success) { // If exception occured during speech generation log the exception seperately in DynamoBD

          logError("[Lambda/handler] generateSpeech method call result: ", speechTextResult);
          textToSave = "Issue in Generating the Speech. Please Try Again";
          await saveError(jobId, { message: "Issue in Generating the Speech. Please Try Again: ", error: speechTextResult });
        }
        else { // Successfully generated the speech
          textToSave = speechTextResult.data;
        }
      }
      else{
        speechGenStatus = "MaxSpeechLimit";
      }

      logInfo("[Lambda/handler] Successfully generated speech: ", { textToSave: textToSave });

      const ttl = Math.floor(Date.now() / 1000) + 30 * 60;// Calculate TTL (30 minutes from now)
      //const ttl = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;// Calculate TTL (2 days from now)


      const pk = "JOB#" + jobId;
      const sk = "META#SPEECHDATA";
      const type = "speech";

      /********* [TEST] Testing Only remove in production *********/
      // Convert messageData to formatted JSON string
      const testjsonString = JSON.stringify(messageData, null, 2); // 'null, 2' adds pretty formatting
      /*******************************/


      const dataToSave = {
        speech: textToSave,
        metaData: testjsonString, // Remove this [TEST]
        status: speechGenStatus,
        user: {
          id: profile?.userID || '',
          name: profile?.name || '',
          package: profile?.package || '',
          isPackageActive: isPackageActive || false,
          packageStatus: packageStatus || PACKAGE_STATUS.UNKNOWN,
          packageType: profile?.packageType || PRODUCT_TYPE.Free,
          pkgStart: profile?.packageStarted || '',
          pkgExpire: profile?.packageExpire || '',
          authProvider: profile?.authProvider || '',
          speechCount: profile?.speechCount || 0
        }
      };

      const speechSaved = await saveToDB(pk, sk, type, dataToSave, ttl); // Save completed JOB to dynamo DB. If JOB fialed save as Try again 
      logInfo("dataToSave", { record: JSON.stringify(dataToSave) });
      logInfo("speechSaved", { record: JSON.stringify(speechSaved) });
      if (!speechSaved || !speechSaved.success) {
        logError("[Lambda/handler] Issue when saving the Generated speech to DB: ", { speechSaved: speechSaved });
        await saveError(jobId, { message: "Issue when saving the Generated speech to DB: ", error: speechSaved });
      }

      return responseData(200, { status: "Success" });// Result saved to the DB with jobID and the front end will retrive data from polling the DB.

    } catch (error) {

      const errorData = formatException(error);
      jobId = jobId || "NO_JOB_ID";
      logError("[Lambda/handler] Exception in handler - Error:", { error: errorData });
      await saveError(jobId, { message: "Exception in handler - Error: ", error: errorData });

      return responseData(400, error.message);
    }
  }
};

/**
 * Generic response method to send the response to the client
 * @param {*} statusCode 
 * @param {*} body 
 * @returns 
 */
const responseData = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
