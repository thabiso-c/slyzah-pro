/**
 * API Client for Slyzah Pro Mobile App (Vendor / Provider Portal)
 * 
 * SECURITY NOTE: 
 * React Native apps cannot host secure /api/ routes. 
 * We must call the deployed Web App's API with a Firebase ID token 
 * to securely authorize requests on the Next.js server.
 */

import { auth } from '../firebaseConfig';

export const WEB_API_BASE_URL = process.env.EXPO_PUBLIC_WEB_API_URL || "https://slyzah.co.za";

/**
 * Dispatches push notification through the centralized Slyzah Server API.
 * Securely passes the authenticated vendor's ID Token.
 */
export const sendPushNotification = async (expoPushToken: string, title: string, body: string, data: any) => {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const token = await auth.currentUser?.getIdToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        await fetch(`${WEB_API_BASE_URL}/api/admin/notifications/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                to: expoPushToken,
                title,
                body,
                data,
                channelId: 'slyzah_alert'
            }),
        });
    } catch (error) {
        console.error("Centralized Notification API Error:", error);
    }
};

/**
 * Securely verifies CIPC business registration details via Next.js backend proxy.
 */
export const verifyCipcBusiness = async (registrationNumber: string) => {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const token = await auth.currentUser?.getIdToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${WEB_API_BASE_URL}/api/verify-cipc`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ registrationNumber }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Verification failed");
        }

        return data; // Returns { enterpriseName: "...", ... }
    } catch (error: any) {
        console.error("CIPC Verification Error:", error);
        throw error;
    }
};
