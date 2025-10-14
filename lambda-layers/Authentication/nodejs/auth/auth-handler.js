import crypto from "crypto";

/**
 * Formate the error response
 * @param {*} msg 
 * @param {*} err 
 * @returns 
 */
const formatError = (msg, err) => ({
    success: false,
    message: msg,
    error: {
        name: err?.name || '',
        message: err?.message || '',
        stack: err?.stack || ''
    }
});

/**
 * Get user authentication info from the headers
 * @param {*} headers 
 * @returns 
 */
export const getAuthInfo = async (headers) => {

    try {

        const authHeader = headers?.Authorization || headers?.authorization;// Get the event header to verify the user
        const authProvider = headers?.['x-auth-provider'] || headers?.['X-Auth-Provider'];
        //logInfo("[Auth] authHeader receied :", authHeader);
        //logInfo("[Auth] authProvider receied :", authProvider);

        // Set defualt value
        const authInfo = {
            sub: '',
            email: '',
            name: '',
            authProvider: ''
        };

        if (authHeader && authHeader.startsWith("Bearer ") && authProvider) {

            const token = authHeader.split(" ")[1];

            switch (authProvider) {
                case "google": {

                    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const userInfo = await userResponse.json();
                    //logInfo("[Auth] userInfo receied :", userInfo);

                    authInfo.sub = userInfo?.sub || '';
                    authInfo.email = userInfo?.email_verified ? (userInfo?.email || '') : ''; // Only if email verified set the email
                    authInfo.name = userInfo?.name || '';
                    authInfo.authProvider = authProvider;

                    break;

                }
                case "facebook": {

                    const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`);

                    const userInfo = await userResponse.json();
                    // logInfo("[Auth] userInfo received:", userInfo);

                    authInfo.sub = userInfo?.id || '';
                    authInfo.email = userInfo?.email || ''; // Facebook may return empty if email permission not granted
                    authInfo.name = userInfo?.name || '';
                    authInfo.authProvider = authProvider;

                    break;

                }

                default: {
                    // Already set the default values for the authInfo 
                }
            }
        }

        return { success: true, data: authInfo };

    } catch (err) {

        return formatError("[Auth/getAuthInfo] Issue in Auth info ", err);
    }
}



export function getHashedUserId(sub, SECRET) {

    try {

        if (sub == null || sub == undefined) return { success: false, message: '[Auth/getAuthInfo] User sub not valid' };
        if (SECRET == null || SECRET == undefined) return { success: false, message: '[Auth/getAuthInfo] Secret key not defined' };

        return { success: true, data: crypto.createHmac("sha256", SECRET).update(sub).digest("hex") };

    } catch (err) {
        
        return formatError("[Auth/getHashedUserId] Issue igenerating hash", err);
    }
}