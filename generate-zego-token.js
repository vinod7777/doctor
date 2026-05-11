const { ZegoUIKitPrebuilt } = require('@zegocloud/zego-uikit-prebuilt');

// Store these in Netlify environment variables for production
const appID = parseInt(process.env.ZEGO_APP_ID || '625892926');
const serverSecret = process.env.ZEGO_SERVER_SECRET || '87601dc79d96b08459cad55b49f0f3b0';

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { roomID, userID, userName } = JSON.parse(event.body);

        if (!roomID || !userID || !userName) {
            return { statusCode: 400, body: 'Missing required parameters: roomID, userID, userName' };
        }

        // Generate the Kit Token on the server
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, roomID, userID, userName);

        return {
            statusCode: 200,
            body: JSON.stringify({ token: kitToken }),
        };
    } catch (error) {
        console.error('Error generating Zego token:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate token' }) };
    }
};