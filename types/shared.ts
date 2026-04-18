export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
}

export interface Quote {
    vendorId: string;
    amount: number;
    message?: string;
    submittedAt?: Timestamp;
}

export interface Lead {
    id: string;
    customerName: string;
    customerEmail: string;
    category: string;
    town?: string;
    province?: string;
    region?: string;
    issueDescription?: string;
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
    verified: boolean;
    rating?: number;
    category?: string;
    logo?: string;
    createdAt?: Timestamp;
}

export interface SupportTicket {
    id: string;
    userName: string;
    userEmail: string;
    message: string;
    type: 'vendor' | 'customer';
    status: 'open' | 'resolved';
    createdAt?: Timestamp;
    resolvedAt?: Timestamp;
}

export interface TeamMessage {
    id: string;
    mailbox: string;
    from: string;
    subject: string;
    content: string;
    status: 'unread' | 'read' | 'replied';
    receivedAt?: Timestamp;
    repliedAt?: Timestamp;
}

export interface NewsArticle {
    id: string;
    title: string;
    category: string;
    content: string;
    imageUrl?: string;
    publishedDate: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}
