// lib/payfast.ts
import crypto from 'crypto';

/**
 * --- CONFIGURATION ---
 * These variables are read directly from the environment.
 * - In development (.env.local), these should be your SANDBOX credentials.
 * - In production (Vercel), these must be set to your LIVE credentials.
 */
export const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || "";
export const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || "";
export const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || "";

// The URL is determined by the environment context.
export const PAYFAST_URL = process.env.NODE_ENV === 'production'
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";

// Base URL for the REST API
const PAYFAST_API_URL = "https://api.payfast.co.za";

// Helper to ensure valid URL (adds https:// if missing, removes trailing slash)
const getSiteUrl = () => {
    let url = process.env.NEXT_PUBLIC_BASE_URL || 'https://slyzah.co.za';
    url = url.replace(/\/$/, ''); // Remove trailing slash
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }
    return url;
};
export const SITE_URL = getSiteUrl();
export const NOTIFY_URL = `${SITE_URL}/api/payfast/itn`;

export function getUpdateCardUrl(token: string) {
    const baseUrl = process.env.NODE_ENV !== 'production'
        ? "https://sandbox.payfast.co.za"
        : "https://www.payfast.co.za";
    return `${baseUrl}/eng/recurring/update/${token}?return=${SITE_URL}/dashboard/vendor`;
}

// Helper for strict PHP-style urlencoding to fix Signature Mismatch
function pfUrlEncode(val: string): string {
    return encodeURIComponent(val)
        .replace(/%20/g, "+");
}

// Plan Pricing (ZAR)
export const PLAN_PRICES: Record<string, number> = {
    "one-region": 199,
    "three-regions": 399,
    "provincial": 599,
    "multi-province": 1499
};

// --- LOGIC: Calculate Subscription Totals ---
export function calculateSubscription(monthlyPrice: number, isTrial: boolean = false) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    if (isTrial) {
        // FREE TRIAL: Pay R0 now, billing starts in 1 month
        const nextBillingDate = new Date(now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        return {
            initialAmount: "5.00", // PayFast requires min R5.00 to tokenize card
            recurringAmount: monthlyPrice.toFixed(2),
            billingDate: nextBillingDate.toISOString().split('T')[0]
        };
    } else {
        // PRO RATA: Pay for remaining days, billing starts 1st of next month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const remainingDays = daysInMonth - now.getDate() + 1;

        const dailyRate = monthlyPrice / daysInMonth;
        let initialAmountVal = dailyRate * remainingDays;

        // Ensure minimum initial amount is 5.00
        if (initialAmountVal < 5) {
            initialAmountVal = 5.00;
        }

        // Billing starts on 1st of next month
        const nextBillingDate = new Date(year, month + 1, 1).toISOString().split('T')[0];

        return {
            initialAmount: initialAmountVal.toFixed(2), // Pay this today
            recurringAmount: monthlyPrice.toFixed(2), // Pay this from next month
            billingDate: nextBillingDate
        };
    }
}

// --- SECURITY: Generate Signature ---
export function generateSignature(data: Record<string, any>, passphrase?: string) {
    // 1. Define the STRICT order of keys as per PayFast documentation
    const requiredOrder = [
        'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
        'email_address', 'm_payment_id', 'amount', 'item_name', 'item_description',
        'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles'
    ];

    // 2. Create the string using ONLY non-blank values in the correct order
    let pfOutput = "";
    requiredOrder.forEach((key) => {
        if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
            const value = data[key].toString().trim();
            // PayFast requires URL encoding with '+' for spaces and UPPERCASE hex
            const encodedValue = encodeURIComponent(value)
                .replace(/%20/g, "+")
                .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase());

            pfOutput += `${key}=${encodedValue}&`;
        }
    });

    // 3. Remove trailing '&' and append the passphrase
    let finalString = pfOutput.slice(0, -1);
    if (passphrase) {
        finalString += `&passphrase=${encodeURIComponent(passphrase.trim())
            .replace(/%20/g, "+")
            .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase())}`;
    }

    // 4. Return the MD5 hash
    return crypto.createHash("md5").update(finalString).digest("hex");
}

// --- API ACTIONS ---

/**
 * Generates a signature for the PayFast REST API.
 * This differs from the form signature by including the passphrase in the alphabetical sort.
 */
function generateApiSignature(data: Record<string, any>, passPhrase: string | null): string {
    const filteredData: Record<string, string> = {};
    for (const key in data) {
        if (data[key] !== '' && data[key] !== null && data[key] !== undefined) {
            filteredData[key] = String(data[key]).trim();
        }
    }

    const sortedKeys = Object.keys(filteredData).sort();

    let pfParamString = sortedKeys
        .map(key => `${key}=${pfUrlEncode(filteredData[key])}`)
        .join('&');

    // Append passphrase at the end, outside of the sort
    if (passPhrase) {
        pfParamString += `&passphrase=${pfUrlEncode(passPhrase)}`;
    }

    console.log("PayFast API Signature String:", pfParamString);
    return crypto.createHash('md5').update(pfParamString).digest('hex');
}

export async function cancelSubscriptionApi(token: string) {
    const url = `${PAYFAST_API_URL}/subscriptions/${token}/cancel${process.env.NODE_ENV !== 'production' ? '?testing=true' : ''}`;
    const timestamp = new Date().toISOString();
    const version = 'v1';

    const signatureData = {
        'merchant-id': PAYFAST_MERCHANT_ID,
        'version': version,
        'timestamp': timestamp,
    };

    const signature = generateApiSignature(signatureData, PAYFAST_PASSPHRASE);

    const headers = {
        'merchant-id': PAYFAST_MERCHANT_ID,
        'version': version,
        'timestamp': timestamp,
        'signature': signature,
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: headers,
    });

    return response.json();
}
