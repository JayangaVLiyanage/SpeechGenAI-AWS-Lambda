const PROFILE_CONST_DATA = Object.freeze({
    PROFILE: 'PROFILE',
    TYPE: 'user'
});

const GENERIC_DATABASE_KEYS = Object.freeze({
    // Generic
    PK: 'PK', // Identify the entry
    SK: 'SK', // Identify the entry
    Type: 'Type', //  The entry type
    timestamp: 'timestamp', // Entry created time
    Data: 'Data', // Contains the data specific to each record

});

const PROFILE_KEYS = Object.freeze({
    // User profile related
    userId: 'userID',
    authProvider: 'authProvider',
    name: 'name',
    freeSpeechCount: 'freeSpeechCount',
    speechCount: 'speechCount',
    packageType: 'packageType',
    packageId: 'package',
    package_unique_id: 'package_unique_id',
    packageStatus: 'packageStatus',
    packageStarted: 'packageStarted',
    packageExpire: 'packageExpire',
    activePackageRef: 'activePackageRef',

});

export const getNewUserProfileObj = (props) => {

    try {
        const {
            PK,
            userId,
            authProvider,
            name,
            freeSpeechCount,
            speechCount,
            packageType,
            packageId,
            packageUniqueId,
            packageStatus,
            packageStarted,
            packageExpire,
            pkgSortKeyItem,
            dataSavedTime,
        } = props;

        const newUserProfile = {
            // Entry IdentifiableData
            [GENERIC_DATABASE_KEYS.PK]: String(PK),
            [GENERIC_DATABASE_KEYS.SK]: PROFILE_CONST_DATA.PROFILE,
            [GENERIC_DATABASE_KEYS.Type]: PROFILE_CONST_DATA.TYPE,

            // Enrty specific data
            [GENERIC_DATABASE_KEYS.Data]: {
                [PROFILE_KEYS.userId]: userId,
                [PROFILE_KEYS.authProvider]: authProvider,
                [PROFILE_KEYS.name]: name,
                [PROFILE_KEYS.freeSpeechCount]: freeSpeechCount,
                [PROFILE_KEYS.speechCount]: speechCount,
                [PROFILE_KEYS.packageType]: packageType,
                [PROFILE_KEYS.packageId]: packageId,
                [PROFILE_KEYS.package_unique_id]: packageUniqueId,
                [PROFILE_KEYS.packageStatus]: packageStatus,
                [PROFILE_KEYS.packageStarted]: packageStarted,
                [PROFILE_KEYS.packageExpire]: packageExpire,
                [PROFILE_KEYS.activePackageRef]: {
                    // Current package reference data
                    [GENERIC_DATABASE_KEYS.PK]: PK,
                    [GENERIC_DATABASE_KEYS.SK]: pkgSortKeyItem,
                    [GENERIC_DATABASE_KEYS.timestamp]: dataSavedTime
                },
            }
        };

        return { success: true, data: newUserProfile }

    } catch (e) {

        return { success: false, data: { message: 'Issue creating the new user profile data', error: e } }
    }
};

export const getUpdateUserProfileObj = (props) => {

    try {
        const {
            PK,
            userId,
            authProvider,
            name,
            freeSpeechCount,
            speechCount,
            packageType,
            packageId,
            packageUniqueId,
            packageStatus,
            packageStarted,
            packageExpire,
            pkgSortKeyItem,
            dataSavedTime,
        } = props;

        if (!PK) return  { success: false, data: { message: '[Lambda/user-profile-config] PK is not defined', error: props } }; // Cannot update if the PK is empty

        const key = {
            [GENERIC_DATABASE_KEYS.PK]: String(PK),
            [GENERIC_DATABASE_KEYS.SK]: PROFILE_CONST_DATA.PROFILE,
        }

        const updates = {}
        if (userId !== null && userId !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.userId}`] = userId; }

        if (authProvider !== null && authProvider !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.authProvider}`] = authProvider; }

        if (name !== null && name !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.name}`] = name; }

        if (freeSpeechCount !== null && freeSpeechCount !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.freeSpeechCount}`] = freeSpeechCount; }

        if (speechCount !== null && speechCount !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.speechCount}`] = speechCount; }

        if (packageType !== null && packageType !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.packageType}`] = packageType; }

        if (packageId !== null && packageId !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.packageId}`] = packageId; }

        if (packageUniqueId !== null && packageUniqueId !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.package_unique_id}`] = packageUniqueId; }

        if (packageStatus !== null && packageStatus !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.packageStatus}`] = packageStatus; }

        if (packageStarted !== null && packageStarted !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.packageStarted}`] = packageStarted; }

        if (packageExpire !== null && packageExpire !== undefined) { updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.packageExpire}`] = packageExpire; }

        if (pkgSortKeyItem !== null && pkgSortKeyItem !== undefined && dataSavedTime !== null && dataSavedTime !== undefined) {
            updates[`${GENERIC_DATABASE_KEYS.Data}.${PROFILE_KEYS.activePackageRef}`] = {
                [GENERIC_DATABASE_KEYS.PK]: PK,
                [GENERIC_DATABASE_KEYS.SK]: pkgSortKeyItem,
                [GENERIC_DATABASE_KEYS.timestamp]: dataSavedTime
            };
        }


        // Return successfull obj
        return {
            success: true, data: { key: key, updates: updates }
        }
    }
    catch (e) {
        return { success: false, data: { message: '[Lambda/user-profile-config]Issue creating the update user profile data', error: e } }
    }
};
