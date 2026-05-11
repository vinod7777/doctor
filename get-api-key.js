// It's crucial to store this as an environment variable in your Netlify dashboard
const API_KEY = process.env.VIDEOSDK_API_KEY || "7ba911d6-7ce8-4d06-9577-5ba474f22b6e";

exports.handler = async function(event, context) {
    return {
        statusCode: 200,
        body: JSON.stringify({ apiKey: API_KEY }),
    };
};