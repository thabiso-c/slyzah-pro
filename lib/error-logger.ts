import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface LogEntry {
    message: string;
    stack?: string;
    context?: any;
    severity: ErrorSeverity;
    source: 'web' | 'pro-app' | 'client-app' | 'itn-handler' | 'push-service';
    userId?: string;
    timestamp: any;
}

export const logError = async (
    message: string,
    error?: any,
    context: any = {},
    severity: ErrorSeverity = 'medium',
    source: LogEntry['source'] = 'pro-app',
    userId?: string
) => {
    console.error(`[${source.toUpperCase()}] ${message}`, error);

    try {
        await addDoc(collection(db, 'system_logs'), {
            message,
            stack: error?.stack || null,
            context: {
                ...context,
                errorDetails: error?.message || String(error)
            },
            severity,
            source,
            status: 'open',
            userId: userId || null,
            timestamp: serverTimestamp()
        });
    } catch (logErr) {
        console.error('Failed to write to system_logs:', logErr);
    }
};
