export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
}

export interface Quote {
    vendorId: string;
    vendorName?: string;
    amount: number;
    message?: string;
    submittedAt?: Timestamp;
}

export interface Lead {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    category: string;
    address?: string;
    town?: string;
    province?: string;
    region?: string;
    issueDescription?: string;
    urgency?: 'urgent' | 'comparing' | 'standard';
    status: 'open' | 'assigned' | 'awarded' | 'closed';
    quotes?: Record<string, Quote>;
    winnerId?: string;
    winnerName?: string;
    reviewEmailSent?: boolean;
    rejectionFeedback?: string | { reason: string; details?: string };
    createdAt?: Timestamp;
    assignedAt?: Timestamp;
}

export interface Professional {
    id: string;
    name?: string;
    vendorName?: string; // App-side compatibility
    email: string;
    tier?: 'Basic' | 'One Region' | 'Three Regions' | 'Provincial' | 'Multi-Province';
    subscriptionStatus?: 'active' | 'cancelled' | 'pending';
    subscriptionToken?: string;
    verified: boolean;
    rating?: number;
    category?: string;
    logo?: string;
    regions?: string[];
    provinces?: string[];
    totalEarned?: number;
    mrrContribution?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    cipcNumber?: string;
    cipcVerified?: boolean;
}

export interface SupportTicket {
    id: string;
    userName: string;
    userEmail: string;
    message: string;
    type: 'vendor' | 'customer' | 'system_error';
    status: 'open' | 'in_progress' | 'resolved';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    source?: 'web' | 'mobile' | 'server';
    logs?: string;
    createdAt?: Timestamp;
    resolvedAt?: Timestamp;
}

export interface TeamMessage {
    id: string;
    mailbox: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    content: string;
    status: 'unread' | 'read' | 'replied';
    receivedAt?: Timestamp;
    repliedAt?: Timestamp;
    isPriority?: boolean;
}

export interface NewsArticle {
    id: string;
    title: string;
    category: string;
    content: string;
    imageUrl?: string;
    publishedDate: string;
    sendPush?: boolean;
    pushAudience?: 'vendors' | 'customers' | 'all';
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}
