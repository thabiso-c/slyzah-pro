import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
// import { sendCriticalErrorEmail } from "@/app/actions/emails";

export async function logErrorTicket(
    error: any,
    context: string,
    user?: { uid?: string; email?: string; name?: string },
    priority: "high" | "critical" = "high"
) {
    try {
        console.error(`Error in ${context}:`, error);

        await addDoc(collection(db, "support_tickets"), {
            userId: user?.uid || "anonymous",
            userEmail: user?.email || "anonymous",
            userName: user?.name || "System",
            title: `System Error: ${context}`,
            message: error?.message || "Unknown error occurred",
            logs: JSON.stringify({
                stack: error?.stack,
                context,
                timestamp: new Date().toISOString(),
                platform: 'mobile-app'
            }),
            status: "open",
            createdAt: serverTimestamp(),
            type: "system_error",
            priority: priority,
            source: "mobile_app"
        });

        if (priority === "critical") {
            // await sendCriticalErrorEmail({
            //     source: "Web Client",
            //     title: context,
            //     message: error?.message || "Unknown error",
            //     stack: error?.stack
            // });
        }
    } catch (loggingError) {
        console.error("Failed to log error ticket:", loggingError);
    }
}