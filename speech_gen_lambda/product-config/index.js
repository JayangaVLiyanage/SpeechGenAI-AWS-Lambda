
export const FREE_SPEECH_COUNT = 2;

export const PACKAGE_STATUS = Object.freeze({
    ACTIVE: "ACTIVE",// payment success
    EXPIRED: "EXPIRED", // time period expired
    CANCELED: "CANCELED", // user unsubscribed 
    PENDING: "PENDING", // payment pending (waiting for payment success event)
    FAILED: "FAILED", // payment failed
    ERROR: "ERROR", // issue
    UNKNOWN: "UNKNOWN" // Not defined
});

export const Throttle_Level = Object.freeze({
    Premium: { key: 'PREMIUM', precentage: 0.125 },
    Standered: { key: 'STANDERED', precentage: 0.1875 },
    Economy: { key: 'ECONOMY', precentage: 0.25 },
    Basic: { key: 'BASIC', precentage: 0.35 },
});

export const PACKAGE_VALIDITI_PERIOD = Object.freeze({
    hours_2: "2hours",
    hours_24: "24hours",
    month_1: "1month",
    unlimited: "unlimited",
});

export const PACKAGE_TYPES = Object.freeze({
    SUBSCRIPTION: "subscription",
    ONE_TIME: "one_time",
    UNKNOWN: "unknown"
});

export const PRODUCT_TYPE = Object.freeze({
    Free: 'free',
    Two_Hours: '2hours',
    One_Day: '24hours',
    Timeless_20: 'timeless20',
    One_Month: '1month',
});


export const PRODUCTS = [
    { key: PRODUCT_TYPE.Free, packageId: -1, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.unlimited, speechCount: 2 },
    { key: PRODUCT_TYPE.One_Month, packageId: 1030016, type: PACKAGE_TYPES.SUBSCRIPTION, validityPeriod: PACKAGE_VALIDITI_PERIOD.month_1, speechCount: 400 },
    { key: PRODUCT_TYPE.Timeless_20, packageId: 1030020, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.unlimited, speechCount: 20 },
    { key: PRODUCT_TYPE.Two_Hours, packageId: 977951, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_2, speechCount: 3 },
    { key: PRODUCT_TYPE.One_Day, packageId: 870513, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.hours_24, speechCount: 10 },
];



// Only apply for subscriptions
export const getProductThrottleLevel = (pkg, speechCount) => {

    if (!pkg) return Throttle_Level.Basic;

    if(pkg.type !== PACKAGE_TYPES.SUBSCRIPTION) return Throttle_Level.Premium;

    const availableSpeechCount = pkg.speechCount - speechCount;

    if (availableSpeechCount <= pkg.speechCount * Throttle_Level.Premium.precentage) {// Premium
        return Throttle_Level.Premium;
    }
    else if (availableSpeechCount <= pkg.speechCount * Throttle_Level.Standered.precentage) { // Standered
        return Throttle_Level.Standered;
    }
    else if (availableSpeechCount <= pkg.speechCount * Throttle_Level.Economy.precentage) { // Economy
        return Throttle_Level.Economy;
    }
    else {// Basic
        return Throttle_Level.Basic;
    }
}

export const getPackageById = (packageId) => {

    const pkg = PRODUCTS.find(p => p.packageId === packageId);

    if (!pkg) {
        // Return the free package as fallback
        const freePkg = PRODUCTS.find(p => p.key === PRODUCT_TYPE.Free) ??
            { key: PRODUCT_TYPE.Free, packageId: -1, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.unlimited, speechCount: 0, };

        return freePkg;
    }

    return pkg;
};

export const getPackageByKey = (key) => {

    const pkg = PRODUCTS.find(p => p.key === key);

    if (!pkg) {
        // Return the free package as fallback
        const freePkg = PRODUCTS.find(p => p.key === PRODUCT_TYPE.Free) ??
            { key: PRODUCT_TYPE.Free, packageId: -1, type: PACKAGE_TYPES.ONE_TIME, validityPeriod: PACKAGE_VALIDITI_PERIOD.unlimited, speechCount: 0, };

        return freePkg;
    }

    return pkg;
};

export const getPackageValidityPeriod = (productId) => {

    try {
        const pkg = getPackageById(productId);

        if (!pkg) {
            return { success: false, data: { message: '[Lambda/product-config/getPackageValidityPeriod] Invalid package ID', productId: productId } };
        }

        // Current UTC time
        const now = new Date();
        let expirAt;

        switch (pkg.validityPeriod) {

            case PACKAGE_VALIDITI_PERIOD.hours_2:
                expirAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
                break;

            case PACKAGE_VALIDITI_PERIOD.hours_24:
                expirAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours
                break;

            case PACKAGE_VALIDITI_PERIOD.month_1:
                const result = new Date(now);
                result.setMonth(result.getMonth() + 1); // +1 calendar month
                expirAt = result;
                break;

            case PACKAGE_VALIDITI_PERIOD.unlimited:
                expirAt = new Date('9999-12-31T23:59:59.999Z'); // Far future date
                break;


            default:
                return { success: false, data: { message: '[Lambda/product-config/getPackageValidityPeriod] Invalid package validity period', productId: productId, validityPeriod: pkg.validityPeriod } };
        }


        if (!expirAt) return { success: false, data: { message: '[Lambda/product-config/getPackageValidityPeriod] Issue generating package validity period', packageId: packageId, expirAt: expirAt } };


        // Convert to ISO 8601 string for storing in DynamoDB
        const packageStart = now.toISOString();       // e.g., "2025-08-08T10:00:00Z"
        const packageExpiry = expirAt.toISOString();   // e.g., "2025-08-08T12:00:00Z"


        //console.log(`[Lambda/getPackageValidityPeriod] PackageId: ${packageId}, PackageStart At: ${packageStart}, PackageEnd At: ${packageExpiry}`);
        return { success: true, data: { packageStart, packageExpiry } };

    }
    catch (error) {
        //console.error(`[Lambda/getPackageValidityPeriod] Error when getting package validity period: ${error}`);
        return { success: false, data: formatException(error) };
    }
}