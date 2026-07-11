export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
}

export interface Quote {
    vendorId: string;
    vendorName?: string;
    vendorEmail?: string;
    amount: number;
    price?: number;
    message?: string;
    submittedAt?: Timestamp;
    timestamp?: Timestamp | string;
    status?: 'pending' | 'accepted' | 'rejected' | 'expired';
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
    issue?: string;
    urgency?: 'urgent' | 'comparing' | 'standard';
    status: 'open' | 'assigned' | 'awarded' | 'closed' | 'completed';
    quotes?: Record<string, Quote>;
    vendorIds?: string[];
    winnerId?: string;
    winnerName?: string;
    imageUrl?: string;
    imageUrls?: string[];
    platform?: 'web' | 'mobile' | 'pro';
    source?: string;
    isWebOutreach?: boolean;
    reviewEmailSent?: boolean;
    rejectionFeedback?: string | { reason: string; details?: string };
    createdAt?: Timestamp;
    assignedAt?: Timestamp;
    completedAt?: Timestamp;
}

export interface Professional {
    id: string;
    uid?: string;
    name?: string;
    vendorName?: string;
    businessName?: string;
    email: string;
    phone?: string;
    website?: string;
    description?: string;
    tier?: 'Basic' | 'One Region' | 'Three Regions' | 'Provincial' | 'Multi-Province' | 'Pending Payment';
    subscriptionStatus?: 'active' | 'cancelled' | 'pending' | 'trial';
    subscriptionToken?: string;
    pendingTier?: string;
    verified: boolean;
    cipcVerified?: boolean;
    cipcNumber?: string;
    cipcDocUrl?: string;
    credentialVerified?: boolean;
    credentialDocUrl?: string;
    additionalCerts?: Array<string | { name: string; url?: string }>;
    rating?: number;
    reviews?: number;
    category?: string;
    logo?: string;
    regions?: string[];
    provinces?: string[];
    expoPushToken?: string;
    isApproved?: boolean;
    source?: string;
    totalEarned?: number;
    mrrContribution?: number;
    lastPaymentDate?: Timestamp;
    nextBillingDate?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface SupportTicket {
    id: string;
    userName: string;
    userEmail: string;
    message: string;
    title?: string;
    type: 'vendor' | 'customer' | 'system_error' | 'user';
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

export interface Chat {
    id: string;
    customerId: string;
    vendorId: string;
    customerName?: string;
    vendorName?: string;
    leadId?: string;
    lastMessage?: string;
    lastMessageAt?: Timestamp;
    typingStatus?: Record<string, boolean>;
    unreadCount?: Record<string, number>;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName?: string;
    text: string;
    timestamp?: Timestamp;
    read?: boolean;
    readAt?: Timestamp;
}

export interface Review {
    id: string;
    leadId: string;
    customerId: string;
    customerName: string;
    vendorId: string;
    vendorName?: string;
    rating: number;
    comment?: string;
    createdAt?: Timestamp;
}
