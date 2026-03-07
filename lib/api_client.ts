const WEB_API_BASE_URL = "https://slyzah-web.vercel.app";

export const verifyCipcBusiness = async (registrationNumber: string) => {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/verify-cipc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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