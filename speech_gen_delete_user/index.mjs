import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { saveToDynamo, readFromDynamo, updateInDynamo, deleteFromDynamo } from '/opt/nodejs/dynamo/index.js';
import { getAuthInfo, getHashedUserId } from '/opt/nodejs/auth/index.js';

const TABLE_NAME = "speech-gen-ai";

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
  // Send request to save the error
  await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#DELETE_USER_DATA#" + jobId), errorMessage);
}

export const handler = async (event) => {

  let jobId = '';

  try {

    logInfo("Received record:", { record: JSON.stringify(event) });

    const body = JSON.parse(event.body);
    const messageData = body?.payload;// Speech generaiton related data 
    const headers = body.auth;// AUthentication related data

    // If no jobID received set jobID to empty and this will be saved as an error to DB
    jobId = messageData?.jobId || '';

    // If headers, message data or job id is missing return
    if (!headers || !messageData || !jobId) {
      logError("[Lambda/handler]Error in handler - Invalid Request: ", event);
      return responseData(400, "Invalid Request");
    }

    // Check user authentication with OAuth providers -----------------------------------------------
    const authResult = await getAuthInfo(headers);// Read Auth data from header

    if (!authResult || !authResult.success) {

      logError("[Lambda/handler] getAuthenticationInfo method call result: ", authResult);
      // Authentication exception; Log in to DB
      const errMsg = { message: "getAuthenticationInfo failed: ", headers: headers, authResult: authResult }
      await saveError(jobId, errMsg);
      return responseData(401, "Unauthorized Delete Request");

    }


    // Check User Package details --------------------------------------------------------------------
    const authInfo = authResult.data;

    let hashData;
    if (authInfo && authInfo.authProvider && authInfo.sub) {

      const userIdToHash = "USER#" + authInfo.authProvider + "#" + authInfo.sub;
      hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);

      if (!hashData || !hashData.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when creating user hash key ", { authProvider: authInfo.authProvider, sub: authInfo.sub });
        // Authentication exception; Log in to DB
        const errMsg = { message: "[Lambda/saveNewPackageToDatabase] Error when creating user hash key ", authProvider: authInfo.authProvider, sub: authInfo.sub }
        await saveError(jobId, errMsg);
        return responseData(400, "Issue in the delete request");
      }

      const PK = hashData?.data ;
      const SK = "PROFILE";
      const deleteTime = new Date().toISOString();
      const skDeleteReteReq = "PROFILE#DELETE_REQ#" + deleteTime ;

      if(!PK)
        return responseData(400, "Issue in the request");


      //Log delete data before success fully deleted user data So there will be no untracked deletions
      const item = {
        PK: PK,
        SK: skDeleteReteReq,
        Type: 'delete_req',
        Data: {
          requestedTime:  new Date().toISOString(),
          reason: 'User requested account deletion'
        }
      };

      const result = await saveToDynamo(TABLE_NAME, item);// Save to DB

      if (!result.success) {
        logError("[Lambda/handler] Issue when saving the user delete request to DB: ",{ request: item, error: result} );
        await saveError(jobId, { message: "[Lambda/handler] Issue when saving the user delete request to DB: ", request: item, error: result });
      }


      const deleteProfileData = await deleteFromDynamo(TABLE_NAME, PK, SK);
      if (!deleteProfileData || !deleteProfileData.success) {

        logError("[Lambda/handler] deleteFromDynamo method call result: ", deleteProfileData);
        // Reading dynamoDB exception; Log in to DB
        const errMsg = { message: "Delete request user does not exist. Issue when reading profile from the DB:"
          , TABLE_NAME: TABLE_NAME, PK: PK, SK: SK, body: body, error: deleteProfileData };
        await saveError(jobId, errMsg);
        return responseData(400, "User not exist");
      }


      return responseData(200, {message: "Delete Data Success", data: deleteProfileData});
      
    }

    return responseData(401, "Unauthorized Delete Request");

  }
  catch (error) {

    const errorData = formatException(error);
    jobId = jobId || "NO_JOB_ID";
    logError("[Lambda/handler] Exception in handler - Error:", { error: errorData });
    await saveError(jobId, { message: "Exception in handler - Error: ", error: errorData });

    return responseData(400, error.message);
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