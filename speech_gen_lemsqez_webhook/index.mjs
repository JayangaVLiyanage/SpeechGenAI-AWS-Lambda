import crypto from 'crypto';
import { logInfo, logError, formatException, saveErrorToDB } from '/opt/nodejs/logger/index.js';
import { saveToDynamo, readFromDynamo, updateInDynamo, deleteFromDynamo } from '/opt/nodejs/dynamo/index.js';
import { getHashedUserId } from '/opt/nodejs/auth/index.js';
import {
  PACKAGE_STATUS, Throttle_Level, PACKAGE_VALIDITI_PERIOD, PACKAGE_TYPES, PRODUCT_TYPE, PRODUCTS,
  getProductThrottleLevel, getPackageById, getPackageByKey, getPackageValidityPeriod, FREE_SPEECH_COUNT
} from './product-config/index.js';
import { getNewUserProfileObj, getUpdateUserProfileObj } from './user-profile-config/index.js';

const TABLE_NAME = "speech-gen-ai";

const DATABASE_RECHECK = {
  recheck_intervals: [10000, 20000], // Recheck the database
  recheck_count: 0, // Recheck the database
  recheck_max_count: 2, // Recheck the database 
  recheck_current: 0 // When in use set the current check count
}


// Function to simulate waiting
const wait = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const getPackageType = (productId) => {

  const pkg = PRODUCTS.find(p => p.packageId === productId);

  if (!pkg) {
    // return { success: false, data: { message: '[Lambda/getPackageType] Invalid package ID', packageId: productId } };

    return PACKAGE_TYPES.UNKNOWN;
  }

  return pkg.type;
}

/**
 * Save the error message to DB. Nothing to return after
 * @param {*} jobId 
 * @param {*} errorMessage 
 */
const saveError = async (jobId, errorMessage) => {
  // Send request to save the error
  await saveErrorToDB(TABLE_NAME, "ERROR-SPEECH-GEN", ("ERROR#LEMON-WEBHOOK#" + jobId), errorMessage);
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

const getDataFromDB = async (pk, sk) => {
  const dynamoResult = await readFromDynamo(TABLE_NAME, pk, sk);// Use dynamo Get(when SK is provided) not Query

  if (!dynamoResult || !dynamoResult.success || !dynamoResult.data) {
    return { success: false, data: { message: "[Lambda/getDataFromDB] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: pk, SK: sk, dynamoResult: dynamoResult } };
  }

  return { success: true, data: dynamoResult.data };
}


const processReceivedEvents = async (requestBody) => {
  try {

    logInfo('[Lambda/processReceivedEvents] saveToDB requestBody', { requestBody: requestBody });

    if (!requestBody || !requestBody.meta || !requestBody.meta.custom_data || !requestBody.meta.event_name || !requestBody.data || !requestBody.data.attributes)
      return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing requestBody or custom_data or event name or attributes", requestBody: requestBody } };

    const attributes = requestBody.data.attributes;// Attributes received from Lemonsqueezy
    const customData = requestBody.meta.custom_data;

    if (!customData || !customData.productId || !customData.key)
      return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing Product ID or Job ID", customData: customData } };

    /**
     * Read the temp user details from the DB (temp details has 15min ttl)
     * When sending the payment to payment gateway user related data stored temporarily in the DB
     */
    /*
        const resultPaymentTemp = await readFromDynamo(TABLE_NAME, customData.key, "META#PAYMENTDATA#TEMP");// Use dynamo Get(when SK is provided) not Query
    
        if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data // These line of checks for dynamodb layer related
          || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
        ) {
          return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: customData.jobId, SK: "META#PAYMENTDATA#TEMP", resultPaymentTemp: resultPaymentTemp } };
        }
    
        const userData = resultPaymentTemp.data.Data.userData;
        const productId = Number(customData.productId);
        const packageType = getPackageType(productId);
    
        if (!packageType || packageType === PACKAGE_TYPES.UNKNOWN) {
          return { success: false, data: { message: "[Lambda/processReceivedEvents] Invalid package type", packageType: packageType, requestBody: requestBody } };
        }
    
        logInfo('[Lambda/processReceivedEvents] getPackageType', { packageType: packageType });
    
        if (!userData?.authProvider || !userData?.sub) {
          return { success: false, data: { message: "[Lambda/processReceivedEvents] Auth provider or sub missing", userData: userData, requestBody: requestBody } };
        }
    */
    /**
     * All the required data from externaly received are validated. Now save the acknowledgement package and user data to DB
     */
    /*
        const userIdToHash = "USER#" + userData.authProvider + "#" + userData.sub;
    
        const hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);
    
        if (!hashData || !hashData.success || !hashData.data) {
          return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Error when creating user hash key ", hashData: hashData, sub: userData.sub } };
        }*/



    /**
     * This is the permenet key for consent package  profile and payment data
     * 
     * If you pass your internal user identifier as custom data (for example, user_id) when the customer first subscribes, 
     * this custom data will be permanently attached to the subscription in Lemon Squeezy.
     * For every future webhook event, including recurring monthly payment successes (such as subscription_payment_success), 
     * the custom data you passed will be included in the webhook payload.
     * 
     * You can then use this value to reliably identify and match the customer in your system for every recurring event,
     * regardless of the email they entered at checkout
     */

    const productId = Number(customData.productId);
    const permenentKey = customData.key; // Set the hash key as permenet key

    const packageType = getPackageType(productId);

    if (!packageType || packageType === PACKAGE_TYPES.UNKNOWN) {
      return { success: false, data: { message: "[Lambda/processReceivedEvents] Invalid package type", packageType: packageType, requestBody: requestBody } };
    }


    switch (packageType) {

      case PACKAGE_TYPES.SUBSCRIPTION: {

        const eventName = requestBody.meta.event_name;

        if (eventName === 'order_created') {
          /**
           * Do nothing
           * For subscription packages 'subscription_created' event will create the package
           */
          return { success: true, data: { message: "[Lambda/processReceivedEvents] Igonre order_created Expecting subscription_created for the subscription package", requestBody: requestBody } };
        }
        else if (eventName === 'subscription_created') {

          const skTempPaymentData = "META#PAYMENTDATA#TEMP";

          // Read the saved temp data of the new package
          let resultPaymentTemp;
          do {
  
            resultPaymentTemp = await getDataFromDB(permenentKey, skTempPaymentData);
  
            if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
              || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
            ) {
              await wait(DATABASE_RECHECK.recheck_intervals[DATABASE_RECHECK.recheck_current]);
              DATABASE_RECHECK.recheck_current++;
            }
            else {
              break;
            }
  
            if (DATABASE_RECHECK.recheck_current >= DATABASE_RECHECK.recheck_max_count) {
              return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Subscription Payment Data", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
            }
  
          }
          while (DATABASE_RECHECK.recheck_current < DATABASE_RECHECK.recheck_max_count
            && DATABASE_RECHECK.recheck_current < DATABASE_RECHECK.recheck_intervals.length);
  
          // Recheck the result before preceeding so payment would not be a issue
          if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
            || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
          ) {
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Subscription Payment Data after time intervals", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
          }


          // const resultPaymentTemp = await getDataFromDB(permenentKey, skTempPaymentData);
          // if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
          //   || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
          // ) {
          //   return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
          // }

          const userData = resultPaymentTemp.data.Data.userData;

          if (!attributes?.first_subscription_item?.subscription_id)
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in subscription_created", requestBody: requestBody } };

          const subscription_id = attributes.first_subscription_item.subscription_id;

          // Delete temp data after reading successfully
          const resultDeletePaymentTemp = await deleteFromDynamo(TABLE_NAME, permenentKey, skTempPaymentData);
          if (!resultDeletePaymentTemp.success) {
            logError("[Lambda/processReceivedEvents] Error deleting temporary PAYMENT data after successfully read ", { TABLE_NAME, permenentKey, skTempPaymentData, resultDeletePaymentTemp });

            const errorTime = new Date().toISOString();
            await saveError(permenentKey + errorTime, { message: '[Lambda/processReceivedEvents] Error deleting temporary PAYMENT data after successfully read', permenentKey, skTempPaymentData, resultDeletePaymentTemp });
          }

          let packageStatus = PACKAGE_STATUS.PENDING;

          const tempProfileSK = "META#PROFILEUPDATE#TEMP";

          /**
           * Check if the user temp data already exists
           * Some times this success call receives before subscription_created
           * Then there will be no profile created so we save it as temp profile update
           * Will update profile with this data 
           */
          const resultSubscriptionData = await readFromDynamo(TABLE_NAME, permenentKey, tempProfileSK);

          if (resultSubscriptionData && resultSubscriptionData.success && resultSubscriptionData.data) {
            const resultData = resultSubscriptionData.data.Data;

            const now = Date.now();
            const tenMinutesAgo = now - 10 * 60 * 1000; // 10 minutes in milliseconds
            const target = new Date(resultData.timestamp).getTime();

            const isWithinLast10Minutes = target > tenMinutesAgo && target <= now;

            // if the data latest and belongs to the same package update the status
            if (isWithinLast10Minutes && resultData.package === userData.productId) {
              packageStatus = resultData.packageStatus;
            }

            // Delete temp data after reading successfully
            const resultDeleteProfileTemp = await deleteFromDynamo(TABLE_NAME, permenentKey, tempProfileSK);
            if (!resultDeleteProfileTemp.success) {
              logError("[Lambda/processReceivedEvents] Error deleting temporary PROFILE data after successfully read in subscription_payment_success", { TABLE_NAME, permenentKey, tempProfileSK, resultDeleteProfileTemp });

              const errorTime = new Date().toISOString();
              await saveError(permenentKey + errorTime, { message: '[Lambda/processReceivedEvents] Error deleting temporary PROFILE data after successfully read in subscription_payment_success', permenentKey, tempProfileSK, resultDeleteProfileTemp });
            }
          }

          return saveNewPackageToDatabase(permenentKey, userData, requestBody, subscription_id, packageStatus); // Created subscription


        }
        else if (eventName === 'subscription_payment_success') {

          if (!attributes?.subscription_id)
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in subscription_payment_success", requestBody: requestBody } };

          const subscription_id = attributes.subscription_id;
          return updatePackage(permenentKey, eventName, productId, requestBody, subscription_id, PACKAGE_STATUS.ACTIVE); // Payment success for the package


        }
        else if (eventName === 'subscription_payment_failed') {

          if (!attributes?.subscription_id)
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in subscription_payment_failed", requestBody: requestBody } };

          const subscription_id = attributes.subscription_id;
          return updatePackage(permenentKey, eventName, productId, requestBody, subscription_id, PACKAGE_STATUS.FAILED);


        }
        else if (eventName === 'subscription_expired') {

          if (!attributes?.first_subscription_item?.subscription_id)
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in subscription_expired", requestBody: requestBody } };

          const subscription_id = attributes.first_subscription_item.subscription_id;
          return updatePackage(permenentKey, eventName, productId, requestBody, subscription_id, PACKAGE_STATUS.EXPIRED);


        }
        else if (eventName === 'subscription_cancelled') {

          if (!attributes?.first_subscription_item?.subscription_id)
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in subscription_cancelled", requestBody: requestBody } };

          const subscription_id = attributes.first_subscription_item.subscription_id;
          return updatePackage(permenentKey, eventName, productId, requestBody, subscription_id, PACKAGE_STATUS.CANCELED);


        }
        else {
          // This will update the package data with unknown event and can be analyzed later
          const time = new Date().toISOString();
          const id = 'ERROR#PACKAGE_CREATION#' + time;

          return { success: false, data: { message: "[Lambda/processReceivedEvents] Unknown package status", permenentKey: permenentKey, id: id, requestBody: requestBody } };
        }

        break;
      }

      case PACKAGE_TYPES.ONE_TIME: {

        // Read the saved temp data of the new package
        const skTempPaymentData = "META#PAYMENTDATA#TEMP";


        let resultPaymentTemp;
        do {

          resultPaymentTemp = await getDataFromDB(permenentKey, skTempPaymentData);

          if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
            || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
          ) {
            await wait(DATABASE_RECHECK.recheck_intervals[DATABASE_RECHECK.recheck_current]);
            DATABASE_RECHECK.recheck_current++;
          }
          else {
            break;
          }

          if (DATABASE_RECHECK.recheck_current >= DATABASE_RECHECK.recheck_max_count) {
            return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
          }

        }
        while (DATABASE_RECHECK.recheck_current < DATABASE_RECHECK.recheck_max_count
          && DATABASE_RECHECK.recheck_current < DATABASE_RECHECK.recheck_intervals.length);

        // Recheck the result before preceeding so payment would not be a issue
        if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
          || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
        ) {
          return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Payment Data after time intervals", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
        }


        // const resultPaymentTemp = await getDataFromDB(permenentKey, skTempPaymentData);
        // if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data
        //   || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
        // ) {
        //   return { success: false, data: { message: "[Lambda/processReceivedEvents] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: skTempPaymentData, resultPaymentTemp: resultPaymentTemp } };
        // }

        const userData = resultPaymentTemp.data.Data.userData;

        if (!attributes?.first_order_item?.id)
          return { success: false, data: { message: "[Lambda/processReceivedEvents] Missing subscription id in one_time", requestBody: requestBody } };


        // Delete temp data after reading successfully
        const resultDeletePaymentTemp = await deleteFromDynamo(TABLE_NAME, permenentKey, skTempPaymentData);
        if (!resultDeletePaymentTemp.success) {
          logError("[Lambda/processReceivedEvents] Error deleting temporary PAYMENT data after successfully read in one_time", { TABLE_NAME, permenentKey, skTempPaymentData, resultDeletePaymentTemp });

          const errorTime = new Date().toISOString();
          await saveError(permenentKey + errorTime, { message: '[Lambda/processReceivedEvents] Error deleting temporary PAYMENT data after successfully read in one_time', permenentKey, skTempPaymentData, resultDeletePaymentTemp });
        }


        const package_unique_id = attributes.first_order_item.id;
        return saveNewPackageToDatabase(permenentKey, userData, requestBody, package_unique_id, PACKAGE_STATUS.ACTIVE);

        break;
      }


      default:
        return { success: false, data: { message: "[Lambda/processReceivedEvents] Package type not defined", packageType: packageType, requestBody: requestBody } };
    }

  }
  catch (error) {
    //console.error(`[Lambda/procesRequest] Error when processing request: ${error}`);
    return { success: false, data: { message: "[Lambda/processReceivedEvents] TryCatch Error when processing request", error: formatException(error) } };
  }
}

const updatePackage = async (permenentKey, eventName, productId, requestBody, package_unique_id, packageStatus) => {


  const dataSavedTime = new Date().toISOString(); // This acts as the part of the sort key for each entry


  /**
   * Save new payment info
   */
  const paymentSortKeyItem = "PAYMENT#" + eventName + "#" + productId + "#" + package_unique_id + "#" + dataSavedTime;

  const itemPayment = {
    PK: String(permenentKey),
    SK: String(paymentSortKeyItem),
    Type: "payment",
    Data: {
      timestamp: dataSavedTime,
      package: String(productId),
      paymentInfo: requestBody,
      packageStatus: packageStatus,
      package_unique_id: package_unique_id
    }
  };

  const resultPayment = await saveToDynamo(TABLE_NAME, itemPayment);// Save payment
  if (!resultPayment.success) {
    return { success: false, data: { message: "[Lambda/updatePackage] Error when saving Package to DB", TABLE_NAME: TABLE_NAME, itemPayment: itemPayment, resultPayment: resultPayment } };
  }




  /**
   * Update user profile package status
   */
  const userSortKeyItem = "PROFILE";

  // Check if the user profile already exists
  const resultUser = await readFromDynamo(TABLE_NAME, permenentKey, userSortKeyItem);

  if (!resultUser || !resultUser.success || resultUser.data == null) {

    const ttl = Math.floor(Date.now() / 1000) + 15 * 60;// Calculate TTL (15 minutes from now)

    // If no profile avaialble save the data temprerily and update later
    // subscription create and payment success will sent by the lemonsqueezy will sometimes late so oncce the profile create in that logic will update this data
    const tempProfUpdate = {
      PK: String(permenentKey),
      SK: String("META#PROFILEUPDATE#TEMP"),
      Type: "payment_temp",
      TTL: ttl,
      Data: {
        timestamp: dataSavedTime,
        package: String(productId),
        paymentInfo: requestBody,
        packageStatus: packageStatus
      }
    };

    const resultTempPayment = await saveToDynamo(TABLE_NAME, tempProfUpdate);// Save temp data

    if (resultTempPayment && resultTempPayment.success) {
      return { success: true, data: { message: "[Lambda/updatePackage] Temp pyament data saved", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: "META#PROFILEUPDATE#TEMP", resultTempPayment: resultTempPayment } };
    }

    return { success: false, data: { message: "[Lambda/updatePackage] Issue Reading the user profile", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: userSortKeyItem, resultUser: resultUser } }; // Issue when reading the user proile
  }


  ////////////////////////////////////

  // If user avialable update the details

  /**
   * Get the package validity period
   */
  const pkg = getPackageById(Number(productId));

  const packageValidityTime = getPackageValidityPeriod(productId);

  //console.log(`[Lambda/saveNewPackageToDatabase] packageValidityTime: ${JSON.stringify(packageValidityTime)}`);
  if (!packageValidityTime || !packageValidityTime.success || !packageValidityTime.data
    || !packageValidityTime.data.packageStart || !packageValidityTime.data.packageExpiry
  ) {

    return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Issue when getting package validity period", productId: productId, packageValidityTime: packageValidityTime } };
  }

  const packageExpireTime = packageValidityTime.data.packageExpiry;

  const update = {
    "Data.packageStatus": packageStatus,
    "Data.packageExpire": packageExpireTime, // Only update the package expirey time as the package start time is the subscription start time
    "Data.speechCount": pkg?.speechCount || 0, // Reset the speech count
  }

  const dynamoResult = await updateInDynamo(TABLE_NAME, { PK: permenentKey, SK: userSortKeyItem }, update);
  logError('***dynamoResult', dynamoResult)
  if (!dynamoResult || !dynamoResult.success) {
    return { success: false, data: { message: "[Lambda/updatePackage] Issue updating user profile with pacakge data", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: userSortKeyItem, dynamoResult: dynamoResult } }; // Issue when reading the user proile
  }

  return { success: true, data: { message: "[Lambda/updatePackage] Package updated successfully", packageStatus: packageStatus } }
}


const saveNewPackageToDatabase = async (permenentKey, userData, requestBody, package_unique_id, packageStatus) => {


  /**
   * These variables will set to true if related data are saved to DB. 
   * If exception happend during the execution of this method
   * in the catch block, the data will be rolled back by deleting the data from DB
   */
  let isConsentSaved = false;
  let isPackageSaved = false;
  let isProfileSaved = false;

  //let permenentKey;
  let consentSortKeyItem;
  let pkgSortKeyItem;
  let userSortKeyItem;

  try {


    logInfo('[Lambda/saveNewPackageToDatabase] Call from processPackage', { userData: userData, requestBody: requestBody });

    /*
            console.log(`[Lambda/saveNewPackageToDatabase] saveToDB requestBody: ${requestBody}`);
            if (!requestBody || !requestBody.meta || !requestBody.meta.custom_data)
              return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Missing requestBody or meta or custom_data", requestBody: requestBody } };
        
            const customData = requestBody.meta.custom_data;
        
            //console.log(`[Lambda/SaveToDB] saveToDB customData: ${customData}`);
        
            if (!customData || !customData.productId || !customData.jobId)
              return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Missing Product ID or Job ID", customData: customData } };
        */
    /**
     * Read the temp user details from the DB (temp details has 15min ttl)
     * When sending the payment to payment gateway user related data stored temporarily in the DB
     */
    /*  
          const resultPaymentTemp = await readFromDynamo(TABLE_NAME, customData.jobId, "META#PAYMENTDATA#TEMP");// Use dynamo Get(when SK is provided) not Query
      
          if (!resultPaymentTemp || !resultPaymentTemp.success || !resultPaymentTemp.data // These line of checks for dynamodb layer related
            || !resultPaymentTemp.data.Data || !resultPaymentTemp.data.Data.userData // This line of checks for dynamo saved data structure validation
          ) {
            return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Issue reading user TEMP Payment Data", TABLE_NAME: TABLE_NAME, PK: customData.jobId, SK: "META#PAYMENTDATA#TEMP", resultPaymentTemp: resultPaymentTemp } };
          }
      
          const userData = resultPaymentTemp.data.Data.userData;
      */






    /**
     * All the required data from externaly received are validated. Now save the acknowledgement package and user data to DB
     */
    /*
        const userIdToHash = "USER#" + userData.authProvider + "#" + userData.sub;
    
        const hashData = getHashedUserId(userIdToHash, process.env.SUB_ENCRYPTION_KEY);
    
        if (!hashData || !hashData.success || !hashData.data) {
          return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Error when creating user hash key ", hashData: hashData, sub: userData.sub } };
        }
    
    
    
    
        /**
         * This is the permenet key for consent package and profile data
         /
    
        permenentKey = hashData.data; // Set the hash key as permenet key
    */



    const dataSavedTime = new Date().toISOString(); // This acts as the part of the sort key for each entry





    /**
     * Get the package validity period
     */

    const productId = Number(userData.productId);
    const packageValidityTime = getPackageValidityPeriod(productId);

    //console.log(`[Lambda/saveNewPackageToDatabase] packageValidityTime: ${JSON.stringify(packageValidityTime)}`);
    if (!packageValidityTime || !packageValidityTime.success || !packageValidityTime.data
      || !packageValidityTime.data.packageStart || !packageValidityTime.data.packageExpiry
    ) {

      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Issue when getting package validity period", productId: productId, packageValidityTime: packageValidityTime } };
    }

    const packageStartedTime = packageValidityTime.data.packageStart;
    const packageExpireTime = packageValidityTime.data.packageExpiry;






    /**
     * Save Consent data to DB
     * 
     */


    consentSortKeyItem = "CONSENT#" + dataSavedTime;

    // Customer consent
    const itemConsent = {
      PK: String(permenentKey),
      SK: consentSortKeyItem,
      Type: "consent",
      Data: {
        agreedToTerms: userData.agreedToTerms,
        termsConditionVersion: userData.termsConditionVersion,
        privacyPolicyVersion: userData.privacyPolicyVersion,
        timestamp: dataSavedTime
      }
    };

    const resultConsent = await saveToDynamo(TABLE_NAME, itemConsent);// Save successful subscription

    if (!resultConsent.success) {
      // This will be logged in handler logError("[Lambda/saveNewPackageToDatabase] Error when saving User Consent to DB: ", resultConsent);
      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Error when saving Package to DB", TABLE_NAME: TABLE_NAME, itemPkg: itemPkg, resultConsent: resultConsent } };
    }

    isConsentSaved = true; // consent saved









    /**
     * Save Package data to DB
     * 
     */

    //pkgSortKeyItem = "PKG#" + userData.productId + "#" + dataSavedTime; // set the current date to make the SK unique. Usr can purchase the same package gain in future
    pkgSortKeyItem = "PKG#" + productId + "#" + package_unique_id + "#" + dataSavedTime;
    const itemPkg = {
      PK: String(permenentKey),
      SK: String(pkgSortKeyItem),
      Type: "package",
      Data: {
        timestamp: dataSavedTime,
        package: String(productId),
        paymentInfo: requestBody,
        package_unique_id: package_unique_id,
        packageStartedTime: packageStartedTime,
        packageExpireTime: packageExpireTime
      }
    };

    const resultPkg = await saveToDynamo(TABLE_NAME, itemPkg);// Save successful subscription

    if (!resultPkg.success) {

      // Delete consent if unable to create the pacakge
      const consentDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, consentSortKeyItem);
      if (!consentDeleteResult.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting User Consent When package save failed: ", { TABLE_NAME, permenentKey, consentSortKeyItem, consentDeleteResult })
      }

      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Error when saving Package to DB", TABLE_NAME: TABLE_NAME, itemPkg: itemPkg, resultPkg: resultPkg } };
    }

    isPackageSaved = true; // package saved







    /**
     * Read user existance in the DB
     */

    userSortKeyItem = "PROFILE";

    // Check if the user profile already exists
    const resultUser = await readFromDynamo(TABLE_NAME, permenentKey, userSortKeyItem);

    if (!resultUser || !resultUser.success) {

      // Delete consent if issue when retreiving profile data
      const consentDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, consentSortKeyItem);
      if (!consentDeleteResult.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting User Consent When read user profile failed: ", { TABLE_NAME, permenentKey, consentSortKeyItem, consentDeleteResult })
      }
      // Delete package if issue when retreiving profile data
      const pkgDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, pkgSortKeyItem);
      if (!pkgDeleteResult.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting package When read user profile failed: ", { TABLE_NAME, permenentKey, pkgSortKeyItem, pkgDeleteResult })
      }

      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Issue Reading the user profile", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: userSortKeyItem, resultUser: resultUser } }; // Issue when reading the user proile
    }

    const pkg = getPackageById(Number(productId));
    if (!pkg) {
      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Package not found", PK: permenentKey, SK: userSortKeyItem, productId: productId } };
    }

    let dynamoResult = null;
    let updateObjResult = null

    // User does not exist
    if (resultUser.data == null) {

      updateObjResult = 'No Update Created as a New User';// This is to clarify the error message so it is easy to debug

      // const itemProfile = {
      //   PK: permenentKey,
      //   SK: userSortKeyItem,
      //   Type: "user",
      //   Data: {
      //     userID: userData.sub,
      //     authProvider: userData.authProvider,
      //     name: userData.name,
      //     speechCount: pkg.speechCount,
      //     packageType: pkg.key,
      //     package: String(pkg.packageId),
      //     package_unique_id: package_unique_id,
      //     packageStatus: packageStatus,
      //     packageStarted: packageStartedTime,
      //     packageExpire: packageExpireTime,
      //     activePackageRef: { PK: permenentKey, SK: pkgSortKeyItem, timestamp: dataSavedTime }
      //   }
      // };

      const newUserProfileProps = {
        PK: permenentKey,
        userId: userData.sub,
        authProvider: userData.authProvider,
        name: userData.name,
        speechCount: pkg.speechCount,
        packageType: pkg.key,
        packageId: String(pkg.packageId),
        packageUniqueId: package_unique_id,
        packageStatus: packageStatus,
        packageStarted: packageStartedTime,
        packageExpire: packageExpireTime,
        pkgSortKeyItem: pkgSortKeyItem,
        dataSavedTime: dataSavedTime
      }

      dynamoResult = await saveToDynamo(TABLE_NAME, getNewUserProfileObj(newUserProfileProps));

    }
    else { // User already exist

      // const updates = {
      //   "Data.package": String(productId),
      //   "Data.package_unique_id": package_unique_id,
      //   "Data.packageStatus": packageStatus,
      //   "Data.packageStarted": packageStartedTime,
      //   "Data.packageExpire": packageExpireTime,
      //   "Data.activePackageRef": { PK: permenentKey, SK: pkgSortKeyItem, timestamp: dataSavedTime },
      //   "Data.speechCount": pkg.speechCount,
      // };
      // dynamoResult = await updateInDynamo(TABLE_NAME, { PK: permenentKey, SK: userSortKeyItem }, updates);

      const updateUserProfileProps = {
        PK: permenentKey,
        speechCount: pkg.speechCount,
        packageType: pkg.key,
        packageId: String(productId),
        packageUniqueId: package_unique_id,
        packageStatus: packageStatus,
        packageStarted: packageStartedTime,
        packageExpire: packageExpireTime,
        pkgSortKeyItem: pkgSortKeyItem,
        dataSavedTime: dataSavedTime
      }

      updateObjResult = getUpdateUserProfileObj(updateUserProfileProps);

      if (updateObjResult && updateObjResult.success && updateObjResult.data) {
        updateObjResult = updateObjResult.data;
        dynamoResult = await updateInDynamo(TABLE_NAME, updateObjResult.key, updateObjResult.updates);
      }
      else {
        logError("[Lambda/saveNewPackageToDatabase] Error when updating User Profile", { TABLE_NAME, permenentKey, userSortKeyItem, updateUserProfileProps, updateObjResult });
      }

    }

    if (!dynamoResult || !dynamoResult.success) {

      // Delete consent if issue when retreiving profile data
      const consentDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, consentSortKeyItem);
      if (!consentDeleteResult.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting User Consent When saving the user profil failed: ", { TABLE_NAME, permenentKey, consentSortKeyItem, consentDeleteResult })
      }
      // Delete package if issue when retreiving profile data
      const pkgDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, pkgSortKeyItem);
      if (!pkgDeleteResult.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting package When saving the user profil failed: ", { TABLE_NAME, permenentKey, pkgSortKeyItem, pkgDeleteResult })
      }

      return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Issue when saving the user profile", TABLE_NAME: TABLE_NAME, PK: permenentKey, SK: userSortKeyItem, updateObjResult: updateObjResult, dynamoResult: dynamoResult } }
    }

    isProfileSaved = true; // profile saved

    return { success: true, data: dynamoResult };// Will return {success: true, data: Attributes} or Null
  }
  catch (err) {

    if (isConsentSaved && permenentKey && consentSortKeyItem) {
      // Delete consent if already saved
      const consentDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, consentSortKeyItem);
      if (!consentDeleteResult?.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting User Consent wile exception failed: ", { TABLE_NAME, permenentKey, consentSortKeyItem, consentDeleteResult, err: formatException(err) })
      }
    }

    if (isPackageSaved && permenentKey && pkgSortKeyItem) {
      // Delete package if already saved
      const pkgDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, pkgSortKeyItem);
      if (!pkgDeleteResult?.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting package wile exception failed: ", { TABLE_NAME, permenentKey, pkgSortKeyItem, pkgDeleteResult, err: formatException(err) })
      }
    }

    if (isProfileSaved && permenentKey && userSortKeyItem) {
      // Delete profile if already saved
      const profileDeleteResult = await deleteFromDynamo(TABLE_NAME, permenentKey, userSortKeyItem);
      if (!profileDeleteResult?.success) {
        logError("[Lambda/saveNewPackageToDatabase] Error when deleting profile wile exception failed: ", { TABLE_NAME, permenentKey, userSortKeyItem, profileDeleteResult, err: formatException(err) })
      }
    }


    return { success: false, data: { message: "[Lambda/saveNewPackageToDatabase] Try/Catch Error", err: formatException(err) } }
  }
}

export const handler = async (event) => {

  logInfo(`LemonSqueezy Webhook data Before processing: ${JSON.stringify(event)}`);
  let jobId = "NO_JOB_ID";
  try {

    // Webhook secret
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SIGNATURE;

    if (!secret) {
      logError('[Lambda/handler] Webhook secret not configured');
      await saveError(jobId, { message: "[Lambda/handler] Webhook secret not configured", secret: secret });
      return responseData(500, "Webhook secret not configured");
    }

    // Read the raw body of the request
    const rawBody = event.body;

    // Decode raw body if base64 encoded (Sometimes API gateway may treat this like binary)
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(event.body, 'base64').toString('utf8');
    }

    // Get the signature header from lemonSqueezy
    const signatureHeader = event.headers["x-signature"];

    if (!signatureHeader) {
      logError('[Lambda/handler] Missing signature header', { event: event });
      await saveError(jobId, { message: "[Lambda/handler] No signature header ~ x-signature ~", event: event });
      return responseData(400, "Missing signature header");
    }

    // Compute HMAC SHA256 digest
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody);
    const digest = hmac.digest();

    // Parse signature header (may be prefixed with 'sha256=')
    const signature = signatureHeader.startsWith('sha256=')
      ? Buffer.from(signatureHeader.slice(7), 'hex')
      : Buffer.from(signatureHeader, 'hex');

    // Timing-safe compare
    if (signature.length !== digest.length || !crypto.timingSafeEqual(digest, signature)) {

      logError('[Lambda/handler] Invalid crypto signature', { digest: digest, signature: signature, signatureHeader: signatureHeader });
      await saveError(jobId, { message: "[Lambda/handler] Invalid crypto signature", digest: digest, signature: signature, signatureHeader: signatureHeader });
      return responseData(401, "Invalid crypto signature");
    }

    // Signature valid - parse JSON safely
    let payload;

    payload = JSON.parse(rawBody);

    jobId = payload?.meta?.custom_data?.jobId || "NO_JOB_ID";

    const result = await processReceivedEvents(payload);

    if (!result.success) {
      logError('[Lambda/handler] Issue saving package to DB', { payload: payload, result: result });
      await saveError(jobId, { message: "[Lambda/handler] Issue saving package to DB", payload: payload, result: result });
      return responseData(500, `Error saving to database - ${result.data}`);
    }
    else {
      return responseData(200, "Success: Saved to DB");
    }

  } catch (err) {

    const errorData = formatException(err);
    logError("[Lambda/handler] Error Handler/Try-Catch:", { err: errorData });
    await saveError(jobId, { message: "Handler/Try-Catch", error: errorData });
    return responseData(500, `Error processing webhook data: ${errorData}`);
  }
};

const responseData = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
