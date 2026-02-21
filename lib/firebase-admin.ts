import admin from 'firebase-admin';

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace literal \n with actual newlines for Vercel
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

let adminApp;

if (!admin.apps.length) {
    try {
        // Validate that all required environment variables are present
        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.warn("⚠️ Firebase Admin credentials not found. Skipping initialization.");
        } else {
            adminApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
            });
            console.log("Firebase Admin SDK initialized successfully.");
        }
    } catch (error: any) {
        console.error("Firebase Admin SDK initialization error:", error.message);
        // Re-throw the error so the build fails here instead of crashing later with a confusing error
        if (process.env.NODE_ENV === 'production') throw new Error("FATAL: Firebase Admin credentials missing. Server actions will fail.");
    }
}

export const adminDb = admin.apps.length > 0 ? admin.firestore() : {} as any;
export default admin;