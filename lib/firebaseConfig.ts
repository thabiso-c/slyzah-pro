import { initializeApp } from "firebase/app";
// @ts-ignore
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeAuth } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDihondydupBhiZf9Wb_BavwKQYDlg9Jjg",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "slyzah-10d1c.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "slyzah-10d1c",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "slyzah-10d1c.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "155997597456",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:155997597456:web:39612f8de2c94ceebc7f95",
};

export const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
