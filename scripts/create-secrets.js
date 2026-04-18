const fs = require('fs');
const path = require('path');

const { GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST, KOTLIN_VERSION } = process.env;

// --- 1. Create google-services.json for Android ---
if (GOOGLE_SERVICES_JSON) {
    try {
        const decoded = Buffer.from(GOOGLE_SERVICES_JSON, 'base64').toString('utf8');
        JSON.parse(decoded); // Validation
        fs.writeFileSync(path.join(process.cwd(), 'google-services.json'), decoded);
        console.log('✅ Created google-services.json');
    } catch (error) {
        console.error('❌ Error creating google-services.json:', error);
        process.exit(1);
    }
}

// --- 2. Create GoogleService-Info.plist for iOS ---
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

// --- 3. FORCE INJECT KOTLIN VERSION (The Build Fix) ---
// This targets the generated android folder during the EAS build process
const buildGradlePath = path.join(process.cwd(), 'android', 'build.gradle');

if (fs.existsSync(buildGradlePath)) {
    try {
        let content = fs.readFileSync(buildGradlePath, 'utf8');
        const targetVersion = KOTLIN_VERSION || '1.9.24';

        if (!content.includes('kotlinVersion')) {
            // Find the buildscript block and inject the version
            const updatedContent = content.replace(
                /buildscript\s*{/,
                `buildscript {\n    ext.kotlinVersion = "${targetVersion}"`
            );
            fs.writeFileSync(buildGradlePath, updatedContent);
            console.log(`✅ Successfully injected kotlinVersion (${targetVersion}) into build.gradle`);
        }
    } catch (error) {
        console.error('⚠️ Could not modify build.gradle:', error);
    }
} else {
    console.log('ℹ️ No android directory found yet; skipping build.gradle injection.');
}