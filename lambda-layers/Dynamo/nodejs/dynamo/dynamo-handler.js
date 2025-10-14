import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        convertClassInstanceToMap: true,
        removeUndefinedValues: true,
        convertEmptyValues: true
    }
});

/***************************************************************************************************
 * Table Schema
 * 
|   Partition Key (PK)      |   Sort Key (SK)       |   Type        |   Data
|---------------------------|-----------------------|---------------|------------------------------
|   USER#john@example.com   |   PROFILE             |    user       |   User account info
|   USER#john@example.com	|   LOGIN#2025-08-03    |    login      |	Track login timestamps
|   USER#john@example.com	|   PKG#12345           |    package    |	Package activation info
|   JOB#12345	            |   META#SPEECHDATA     |    job        |	Speech job data
****************************************************************************************************/

/**
 * Log any data for the event
 * @param {string} eventName 
 * @param  {...any} details 
 */
const logInfo = (eventName, ...details) => {
    console.log({
        Log: "--INFO--",
        event: eventName,
        Details: JSON.stringify(details, null, 2)
    });
};

/**
 * Log erro messages
 * @param {any} message 
 */
const logError = (message) => { console.error(`Error:- ${message}`); };

/**
 * Formate the errro response
 * @param {*} msg 
 * @param {*} err 
 * @returns 
 */
const formatError = (msg, err) => ({
    success: false,
    message: msg,
    error: {
        name: err.name,
        message: err.message,
        stack: err.stack
    }
});

/**
 * Save an item to DynamoDB
 * @param {string} tableName - DynamoDB table name
 * @param {object} item - Item to save
 */
export const saveToDynamo = async (tableName, item) => {

    try {

        if (!item || !item.PK || !item.SK || !item.Type || !item.Data) {
            throw new Error("[dynamodb/save] Missing required fields: PK, SK, Type or Data");
        }

        // Time the data was created
        const now = new Date().toISOString();
        item.CreatedAt = item.CreatedAt || now;

        // Time the data was updated
        item.UpdatedAt = now;

        const result = await ddb.send(new PutCommand({
            TableName: tableName,
            Item: item,
        }));

        logInfo("[dynamodb/save]", { TableName: tableName }, { ItemToSave: item }, { DynamoDBResult: result });
        return { success: true, data: result };

    } catch (error) {

        logError(`[dynamodb/save] Unable to save to DB - Error: ${error.message}`);
        return formatError("[dynamodb/save] Unable to save to DB", error);
    }
};

/**
 * Read from DynamoDB - supports single item (PK+SK) or multiple by prefix.
 * 
 * Ex: 
 *       const params = {
 *          TableName: "YourDynamoTable",
 *          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
 *          ExpressionAttributeValues: {
 *              ":pk": "USER#john@example.com",
 *              ":skPrefix": "LOGIN#",
 *          },
 *      };
 * 
 *      Above query will match to the this :
 *          
 *          PK = "USER#john@example.com" AND SK begins with "LOGIN#"
 *
 * 
 * @param {string} tableName 
 * @param {string} pk - Partition Key
 * @param {string} sk - Sort Key (optional). If omitted, retrieves all entries under PK.
 * @param {object} [options] - optional filters (like prefix match)
 * @returns {Promise<object>} - Single item or list of items
 */
export const readFromDynamo = async (tableName, pk, sk, options = {}) => {

    if (!pk) throw new Error("[dynamodb/read] Missing required key: PK");

    try {
        // Case 1: Get specific item if PK + SK provided
        if (sk) {
            const getResult = await ddb.send(
                new GetCommand({
                    TableName: tableName,
                    Key: { PK: pk, SK: sk },
                })
            );

            let result = getResult.Item || null;

            logInfo("[dynamodb/read]", { TableName: tableName }, { PK: pk, SK: sk }, { DynamoDBResult: result });
            return { success: true, data: result };
        }

        // Case 2: Query multiple items under PK (with optional prefix filter)
        const KeyConditionExpression = "PK = :pk" + (options.beginsWith ? " AND begins_with(SK, :skPrefix)" : "");

        const ExpressionAttributeValues = {
            ":pk": pk,
        };
        if (options.beginsWith) {
            ExpressionAttributeValues[":skPrefix"] = options.beginsWith;
        }

        const queryResult = await ddb.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression,
                ExpressionAttributeValues,
            })
        );

        const result = queryResult.Items || [];

        // Returns an array of objects
        return { success: true, data: result };

    } catch (error) {
        logError(`[dynamodb/read] Error reading from DynamoDB - Error: ${error.message}`);
        return formatError("[dynamodb/read] Error reading from DynamoDB", error);
    }
};

/**
 * Update entry
 * 
 * Ex:
 *      await updateInDynamo("YourDynamoTable", 
 *               { PK: "USER#john@example.com", SK: "PROFILE" }, 
 *               { currentPackageId: "12345", isPaidUser: true }
 *       );
 * 
 * 
 * @param {*} tableName 
 * @param {*} key 
 * @param {*} updates 
 * @returns 
 */
export const updateInDynamo = async (tableName, key, updates, listAppendFields = []) => {
    try {
        if (!key || !key.PK || !key.SK || !updates || typeof updates !== "object") {
            throw new Error("Missing required fields: PK, SK, or updates object");
        }

        const now = new Date().toISOString();
        updates.UpdatedAt = now;
        updates.CreatedAt = now; // Only update if the value already not existed

        const expressionParts = [];
        const expressionAttrValues = {};
        const expressionAttrNames = {};

        let i = 0;

        for (const [attr, value] of Object.entries(updates)) {
            i++;
            const valuePlaceholder = `:val${i}`;

            // 🟡 🔄 CHANGE START: support for nested attribute names
            // Split nested attributes like 'Data.packageStatus' into ['Data', 'packageStatus']
            const pathParts = attr.split(".");
            const attrPath = [];

            pathParts.forEach((part, idx) => {
                const attrPlaceholder = `#attr${i}_${idx}`;
                expressionAttrNames[attrPlaceholder] = part;
                attrPath.push(attrPlaceholder);
            });

            const fullPath = attrPath.join("."); // e.g. #attr1_0.#attr1_1
            // 🟡 🔄 CHANGE END

            if (listAppendFields.includes(attr) && Array.isArray(value)) {
                // Append list: existing_list = list_append(existing_list, :newList)
                expressionParts.push(
                    `${fullPath} = list_append(if_not_exists(${fullPath}, :empty_list), ${valuePlaceholder})`
                );
                expressionAttrValues[valuePlaceholder] = value;
                expressionAttrValues[":empty_list"] = []; // in case attribute doesn't exist yet
            }
            else if (attr === "CreatedAt") {
                // Use if_not_exists only for CreatedAt
                expressionParts.push(`${fullPath} = if_not_exists(${fullPath}, ${valuePlaceholder})`);
                expressionAttrValues[valuePlaceholder] = value;
            }
            else {
                // Regular set
                expressionParts.push(`${fullPath} = ${valuePlaceholder}`);
                expressionAttrValues[valuePlaceholder] = value;
            }
        }

        const updateExpression = `SET ${expressionParts.join(", ")}`;

        const result = await ddb.send(
            new UpdateCommand({
                TableName: tableName,
                Key: {
                    PK: key.PK,
                    SK: key.SK,
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionAttrNames,
                ExpressionAttributeValues: expressionAttrValues,
                ReturnValues: "ALL_NEW",
            })
        );

        logInfo("[dynamodb/update]", { TableName: tableName, Key: key, Updates: updates }, { Result: result });
        return { success: true, data: result.Attributes };
    } catch (error) {
        logError(`[dynamodb/update] Failed to update - Error: ${error.message}`);
        return { success: false, data: error };
    }
};


export const deleteFromDynamo = async (tableName, pk, sk) => {
    try {
        if (!pk || !sk) {
            throw new Error("[dynamodb/delete] Missing required fields: PK or SK");
        }

        const result = await ddb.send(new DeleteCommand({
            TableName: tableName,
            Key: {
                PK: pk,
                SK: sk,
            },
            ReturnValues: "ALL_OLD" // returns the deleted item (optional)
        }));

        logInfo("[dynamodb/delete]", { TableName: tableName, PK: pk, SK: sk }, { Result: result });
        return { success: true, data: result.Attributes || null };

    } catch (error) {
        logError(`[dynamodb/delete] Failed to delete - Error: ${error.message}`);
        return formatError("[dynamodb/delete] Failed to delete", error);
    }
};

