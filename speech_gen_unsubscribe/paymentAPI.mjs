import axios from "axios";

export const paymentApiInstance = axios.create({
    baseURL: process.env.LEMON_SQUEEZY_ENDPOINT,
    headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
    },
    params: {
        _ts: Date.now() // Cache-busting timestamp
    }
});

export const formatAxiosError = async (error, context = "Unknown context") => {
    if (!error?.isAxiosError || !error?.response) {
        return {
            context,
            message: error?.message || "Non-Axios error occurred",
            status: "N/A",
            errors: error?.stack || "No further error info"
        };
    }

    const data = error.response.data;

    return {
        context,
        message: error.message,
        status: error.response.status,
        errors: data?.errors || data?.error || data?.message || "No error details returned"
    };
}

export const isLemonSqueezyError = (error) => {
    const isAxios = error?.isAxiosError;
    const fromLemonSqueezy = error?.config?.baseURL?.includes('lemonsqueezy.com');
    const hasErrorsArray = Array.isArray(error?.response?.data?.errors);
  
    return isAxios && fromLemonSqueezy && hasErrorsArray;
  };