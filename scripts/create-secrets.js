const fs = require('fs');
const path = require('path');

// Destructure all potential secrets from environment variables
const { GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST, FCM_KEY_JSON } = process.env;

// --- Create google-services.json for Android ---
if (GOOGLE_SERVICES_JSON) {
    try {
        const decoded = Buffer.from(GOOGLE_SERVICES_JSON, 'base64').toString('utf8');

        // Validate that the decoded content is valid JSON to catch encoding errors early
        try {
            JSON.parse(decoded);
        } catch (e) {
            console.error('Error parsing GOOGLE_SERVICES_JSON. Ensure the secret is a Base64 encoded string of the JSON file.');
            process.exit(1);
        }

        fs.writeFileSync(path.join(process.cwd(), 'google-services.json'), decoded);
        console.log('✅ Created google-services.json');
    } catch (error) {
        console.error('❌ Error creating google-services.json:', error);
        process.exit(1);
    }
}

// --- Create GoogleService-Info.plist for iOS ---
if (GOOGLE_SERVICE_INFO_PLIST) {
    try {
        const decoded = Buffer.from(GOOGLE_SERVICE_INFO_PLIST, 'base64').toString('utf8');
        fs.writeFileSync(path.join(process.cwd(), 'GoogleService-Info.plist'), decoded);
        console.log('✅ Created GoogleService-Info.plist');
    } catch (error) {
        console.error('❌ Error creating GoogleService-Info.plist:', error);
        process.exit(1);
    }
}

// --- Create fcm-key.json (if needed for build configuration) ---
if (FCM_KEY_JSON) {
    try {
        const decoded = Buffer.from(FCM_KEY_JSON, 'base64').toString('utf8');
        fs.writeFileSync(path.join(process.cwd(), 'fcm-key.json'), decoded);
        console.log('✅ Created fcm-key.json');
    } catch (error) {
        console.error('❌ Error creating fcm-key.json:', error);
        process.exit(1);
    }
}