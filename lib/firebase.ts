import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDihondydupBhiZf9Wb_BavwKQYDlg9Jjg",
    authDomain: "slyzah-10d1c.firebaseapp.com",
    projectId: "slyzah-10d1c",
    storageBucket: "slyzah-10d1c.firebasestorage.app",
    messagingSenderId: "155997597456",
    appId: "1:155997597456:web:39612f8de2c94ceebc7f95"
};

// 1. Initialize Firebase App FIRST
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Firestore with the VPN Fix (Long Polling)
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

// 3. Initialize other modules
const auth = getAuth(app);
const storage = getStorage(app);

// 4. Export everything
export { auth, db, storage };