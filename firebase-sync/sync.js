const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function syncAndCreateUsers() {
    console.log('Starting Deep Sync...');

    try {
        const snapshot = await db.collection('professionals').get();

        for (const doc of snapshot.docs) {
            const userData = doc.data();
            const uid = doc.id;
            const email = userData.email;

            if (!email) continue;

            try {
                // Attempt to update first
                await auth.updateUser(uid, { email: email });
                console.log(`✅ Updated: ${email}`);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // USER DOES NOT EXIST - Let's create them!
                    try {
                        await auth.createUser({
                            uid: uid,
                            email: email,
                            password: 'TemporaryPassword123!', // They will change this via "Forgot Password"
                            emailVerified: true
                        });
                        console.log(`🆕 Created New Auth User: ${email}`);
                    } catch (createError) {
                        console.error(`❌ Failed to create ${email}:`, createError.message);
                    }
                } else {
                    console.error(`⚠️ Error with ${email}:`, error.message);
                }
            }
        }
        console.log('Sync process completed.');
    } catch (err) {
        console.error('Snapshot error:', err);
    }
}

syncAndCreateUsers();