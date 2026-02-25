import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    green: '#10B981',
};

// Helper for "Time Ago"
const timeAgo = (date: any) => {
    if (!date || !date.seconds) return 'Just now';
    const seconds = Math.floor((new Date().getTime() - new Date(date.seconds * 1000).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
        case 'urgent': return 'Urgent';
        case 'notUrgent': return 'Not Urgent';
        case 'comparing': return 'Comparing Quotes';
        default: return urgency;
    }
};

export default function VendorDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [leads, setLeads] = useState<any[]>([]);
    const [chats, setChats] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
    const leadsRef = useRef<any[]>([]);
    const [jobsFilter, setJobsFilter] = useState<'active' | 'completed'>('active');

    // Quote Modal State
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const [lockedFeatureName, setLockedFeatureName] = useState('');
    const [selectedLead, setSelectedLead] = useState<any>(null);
    const [quotePrice, setQuotePrice] = useState('');
    const [quoteMessage, setQuoteMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Support State
    const [supportMessage, setSupportMessage] = useState("");

    // Stats
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    useEffect(() => {
        leadsRef.current = leads;
    }, [leads]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser: User | null) => {
            if (currentUser) {
                setUser(currentUser);
                const uid = currentUser.uid;

                // Fetch Profile
                const docRef = doc(db, "professionals", uid);
                const docSnap = await getDoc(docRef);

                let profileData: any = null;
                if (docSnap.exists()) {
                    profileData = { id: docSnap.id, ...docSnap.data() };
                } else {
                    // Fallback search by uid field
                    const q = query(collection(db, "professionals"), where("uid", "==", uid));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        profileData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                    }
                }

                if (profileData) {
                    setProfile(profileData);

                    // 2. Listen for Leads
                    const leadsQuery = query(
                        collection(db, "leads"),
                        where("category", "==", profileData.category),
                        orderBy("createdAt", "desc")
                    );
                    onSnapshot(leadsQuery, (snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            const data = change.doc.data();

                            // 1. New Lead Notification
                            if (change.type === "added") {
                                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                                // Only notify if created in the last 2 minutes (avoids spam on initial load)
                                if ((new Date().getTime() - createdAt.getTime()) < 120000) {
                                    Notifications.scheduleNotificationAsync({
                                        content: {
                                            title: 'New Lead Available! ⚡',
                                            body: `${data.issueDescription} in ${data.town || data.region}`,
                                            data: { leadId: change.doc.id },
                                            sound: 'default',
                                        },
                                        trigger: null,
                                    });
                                }
                            }

                            // 2. Job Won Notification
                            if (change.type === "modified") {
                                if (data.winnerId === profileData.id && data.status === 'assigned') {
                                    const prevLead = leadsRef.current.find(l => l.id === change.doc.id);
                                    if (!prevLead || prevLead.winnerId !== profileData.id) {
                                        Notifications.scheduleNotificationAsync({
                                            content: {
                                                title: 'Job Won! 🏆',
                                                body: `You have been selected for: ${data.issueDescription}`,
                                                data: { leadId: change.doc.id },
                                                sound: 'default',
                                            },
                                            trigger: null,
                                        });
                                        Alert.alert("Job Won! 🏆", `You have been selected for: ${data.issueDescription}. Check the Jobs tab.`);
                                    }
                                }
                            }
                        });
                        setLeads(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                        setLoading(false);
                    });

                    // 3. Listen for Chats
                    const chatsQuery = query(
                        collection(db, "chats"),
                        where("vendorId", "==", profileData.id),
                        orderBy("updatedAt", "desc")
                    );
                    onSnapshot(chatsQuery, (snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            if (change.type === "modified") {
                                const data = change.doc.data();
                                if (data.lastSenderId !== uid && data.vendorUnreadCount > 0) {
                                    Notifications.scheduleNotificationAsync({
                                        content: {
                                            title: `New Message from ${data.customerName || 'Customer'}`,
                                            body: data.lastMessage,
                                            data: { chatId: data.id },
                                            sound: 'default',
                                        },
                                        trigger: null,
                                    });
                                }
                            }
                        });
                        const chatList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        setChats(chatList);
                        const unread = chatList.reduce((acc: number, chat: any) => acc + (chat.vendorUnreadCount || 0), 0);
                        setUnreadMsgCount(unread);
                    });

                    // 4. Listen for Quotes
                    const quotesQuery = query(collection(db, "quotes"), where("vendorId", "==", profileData.id));
                    onSnapshot(quotesQuery, (snapshot) => {
                        setQuotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                    });

                    // 5. Listen for Notifications
                    const notifQuery = query(
                        collection(db, "professionals", profileData.id, "notifications"),
                        orderBy("createdAt", "desc"),
                        limit(20)
                    );
                    onSnapshot(notifQuery, (snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            if (change.type === "added") {
                                const data = change.doc.data();
                                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                                if ((new Date().getTime() - createdAt.getTime()) < 120000) {
                                    Notifications.scheduleNotificationAsync({
                                        content: {
                                            title: 'New Activity 🔔',
                                            body: typeof data.notificationMessage === 'string' ? data.notificationMessage : 'You have a new notification',
                                            data: { leadId: data.leadId, chatId: data.chatId },
                                            sound: 'default',
                                        },
                                        trigger: null,
                                    });
                                }
                            }
                        });
                        const notifList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        setNotifications(notifList);
                        const unread = notifList.filter((n: any) => n.status === 'unread').length;
                        setUnreadNotifCount(unread);
                    });
                } else {
                    Alert.alert("Error", "Vendor profile not found.");
                    setLoading(false);
                }
            } else {
                router.replace('/');
            }
        });
        return unsubscribeAuth;
    }, []);

    const handleSendSupport = async () => {
        if (!supportMessage.trim()) return;
        try {
            await addDoc(collection(db, "support_tickets"), {
                userId: user.uid,
                userEmail: user.email,
                userName: profile?.name || "Vendor",
                message: supportMessage,
                status: "open",
                createdAt: serverTimestamp(),
                type: "vendor"
            });
            Alert.alert("Success", "Support ticket sent!");
            setSupportMessage("");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    const handleTabPress = (tabId: string, tabLabel: string, isPaidFeature?: boolean) => {
        const isPaidTier = profile?.tier && profile.tier.toLowerCase() !== 'basic';

        if (isPaidFeature && !isPaidTier) {
            setLockedFeatureName(tabLabel);
            setUpgradeModalVisible(true);
        } else {
            setActiveTab(tabId);
        }
    };

    const handleQuotePress = (lead: any) => {
        setSelectedLead(lead);
    };

    const handleCompleteJob = async (leadId: string) => {
        Alert.alert(
            "Complete Job",
            "Are you sure you want to mark this job as completed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Complete",
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, "leads", leadId), {
                                status: 'completed',
                                completedAt: serverTimestamp()
                            });
                            Alert.alert("Success", "Job marked as completed!");
                        } catch (error: any) {
                            Alert.alert("Error", error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleSendQuote = async () => {
        if (!quotePrice || !quoteMessage) {
            Alert.alert("Missing Info", "Please enter a price and message.");
            return;
        }

        setSubmitting(true);
        try {
            const vendorName = profile.name || "Slyzah Pro";

            await addDoc(collection(db, "quotes"), {
                leadId: selectedLead.id,
                vendorId: profile.id,
                vendorName,
                vendorEmail: user.email || profile.email,
                price: Number(quotePrice),
                message: quoteMessage,
                status: "pending",
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, "leads", selectedLead.id), {
                [`quotes.${profile.id}`]: {
                    vendorName,
                    vendorEmail: user.email || profile.email,
                    amount: Number(quotePrice),
                    message: quoteMessage,
                    timestamp: new Date().toISOString()
                }
            });

            // 3. Send Push Notification to Customer (Mobile Equivalent of Server Action)
            if (selectedLead.customerId) {
                try {
                    const customerDoc = await getDoc(doc(db, "users", selectedLead.customerId));
                    if (customerDoc.exists()) {
                        const customerData = customerDoc.data();
                        if (customerData.expoPushToken) {
                            console.log(`Sending quote push to token: ${customerData.expoPushToken}`);
                            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    to: customerData.expoPushToken,
                                    sound: 'default',
                                    title: 'New Quote Received! 💰',
                                    body: `${vendorName} sent you a quote for R${quotePrice}`,
                                    data: { leadId: selectedLead.id },
                                    channelId: 'default',
                                    priority: 'high',
                                    badge: 1,
                                    _displayInForeground: true,
                                }),
                            });
                            const responseData = await response.json();
                            console.log("Quote push notification response:", responseData);
                            if (responseData.data?.status === 'error') {
                                console.error('Push notification error:', responseData.data.message);
                            }
                        } else {
                            console.log("Customer does not have a push token.");
                        }
                    }
                } catch (pushError) {
                    console.error("Failed to send push notification:", pushError);
                }
            }

            Alert.alert("Success", "Quote sent successfully!");
            setSelectedLead(null);
            setQuotePrice('');
            setQuoteMessage('');
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const directRequests = useMemo(() => {
        return leads.filter(lead =>
            lead.status === 'open' &&
            lead.vendorIds?.includes(profile?.id)
        );
    }, [leads, profile]);

    const totalQuotesSent = quotes.length;
    const leadsWon = leads.filter(l => l.winnerId === profile?.id).length;
    const winRate = totalQuotesSent > 0 ? Math.round((leadsWon / totalQuotesSent) * 100) : 0;
    const marketDemand = leads.filter(l => l.status === 'open').length;

    // Rejection Analytics
    const rejections = leads.filter(lead => {
        const hasQuoted = lead.quotes && lead.quotes[profile?.id];
        const isLost = lead.status === 'assigned' && lead.winnerId !== profile?.id;
        return hasQuoted && isLost && lead.rejectionFeedback;
    });

    // Location Analytics
    const locationData = leads.reduce((acc: Record<string, number>, lead: any) => {
        const loc = lead.town ? `${lead.town}` : 'Unknown Area';
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
    }, {});

    const wonLeads = useMemo(() => {
        return leads.filter(l => l.winnerId === profile?.id);
    }, [leads, profile]);

    const selectedLeadImages = selectedLead?.images || selectedLead?.imageUrls || (selectedLead?.imageUrl ? [selectedLead.imageUrl] : []);

    const TABS = useMemo(() => [
        { id: 'dashboard', icon: 'grid-outline', label: 'Market' },
        { id: 'jobs', icon: 'briefcase-outline', label: 'Jobs', badge: wonLeads.length > 0 ? wonLeads.length : undefined },
        { id: 'insights', icon: 'trending-up-outline', label: 'Insights', paid: true },
        { id: 'messages', icon: 'chatbubble-outline', label: 'Chat', badge: unreadMsgCount },
        { id: 'notifications', icon: 'notifications-outline', label: 'Activity', badge: unreadNotifCount },
        { id: 'subscriptions', icon: 'card-outline', label: 'Plan' },
        { id: 'support', icon: 'help-buoy-outline', label: 'Support' },
    ], [unreadMsgCount, unreadNotifCount, wonLeads.length]);

    const isPaidTier = useMemo(() =>
        profile?.tier && profile.tier.toLowerCase() !== 'basic'
        , [profile]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.gold} />
                <Text style={styles.loadingText}>Loading Dashboard...</Text>
            </View>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <View>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Direct Requests</Text>
                            {directRequests.length > 0 ? (
                                directRequests.map((lead: any) => {
                                    const leadImages = lead.images || lead.imageUrls || (lead.imageUrl ? [lead.imageUrl] : []);
                                    return (<View key={lead.id} style={styles.leadCard}>
                                        <View style={styles.leadHeader}>
                                            <Text style={styles.leadCategory}>{lead.category}</Text>
                                            <View style={styles.directBadge}>
                                                <Text style={styles.directBadgeText}>FOR YOU</Text>
                                                <Text style={styles.urgencyText}>({getUrgencyLabel(lead.urgency)})</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.leadDescription}>{lead.issueDescription}</Text>
                                        <Text style={styles.leadLocation}>📍 {lead.address || `${lead.town}, ${lead.province}`}</Text>

                                        {leadImages.length > 0 && (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                                {leadImages.map((img: string, index: number) => (
                                                    <TouchableOpacity key={index} onPress={() => setViewingImage(img)}>
                                                        <Image source={{ uri: img }} style={styles.leadImage} />
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        )}

                                        {lead.quotes && lead.quotes[profile.id] ? (
                                            <View style={styles.quotedBadge}>
                                                <Ionicons name="checkmark-circle" size={16} color="#9CA3AF" />
                                                <Text style={styles.quotedText}>Quote Sent</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.quoteButton}
                                                onPress={() => handleQuotePress(lead)}
                                            >
                                                <Text style={styles.quoteButtonText}>Send Quote</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>);
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="flash-off-outline" size={30} color="#ccc" />
                                    <Text style={styles.emptyText}>No direct requests right now.</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Marketplace ({leads.length})</Text>
                            {leads.map((lead: any) => {
                                const leadImages = lead.images || lead.imageUrls || (lead.imageUrl ? [lead.imageUrl] : []);
                                return (<View key={lead.id} style={styles.leadCard}>
                                    <View style={styles.leadHeader}>
                                        <Text style={styles.leadCategory}>{lead.category}</Text>
                                        <Text style={styles.leadTime}>{timeAgo(lead.createdAt)}</Text>
                                        <Text style={styles.urgencyText}>({getUrgencyLabel(lead.urgency)})</Text>
                                    </View>
                                    <Text style={styles.leadDescription} numberOfLines={2}>{lead.issueDescription}</Text>
                                    <Text style={styles.leadLocation}>📍 {lead.address || `${lead.town}, ${lead.province}`}</Text>

                                    {leadImages.length > 0 && (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                            {leadImages.map((img: string, index: number) => (
                                                <TouchableOpacity key={index} onPress={() => setViewingImage(img)}>
                                                    <Image source={{ uri: img }} style={styles.leadImage} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}

                                    {lead.quotes && lead.quotes[profile.id] ? (
                                        <View style={styles.quotedBadge}>
                                            <Ionicons name="checkmark-circle" size={16} color="#9CA3AF" />
                                            <Text style={styles.quotedText}>Quote Sent</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.quoteButton, { backgroundColor: THEME.navy }]}
                                            onPress={() => handleQuotePress(lead)}
                                        >
                                            <Text style={[styles.quoteButtonText, { color: THEME.white }]}>Quote This Job</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>);
                            })}
                        </View>
                    </View>
                );

            case 'jobs':
                const displayedJobs = wonLeads.filter(job =>
                    jobsFilter === 'active' ? job.status !== 'completed' : job.status === 'completed'
                );

                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Jobs Awarded</Text>

                        <View style={styles.filterContainer}>
                            <TouchableOpacity
                                style={[styles.filterButton, jobsFilter === 'active' && styles.filterButtonActive]}
                                onPress={() => setJobsFilter('active')}
                            >
                                <Text style={[styles.filterText, jobsFilter === 'active' && styles.filterTextActive]}>Active Jobs</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterButton, jobsFilter === 'completed' && styles.filterButtonActive]}
                                onPress={() => setJobsFilter('completed')}
                            >
                                <Text style={[styles.filterText, jobsFilter === 'completed' && styles.filterTextActive]}>Completed Jobs</Text>
                            </TouchableOpacity>
                        </View>

                        {displayedJobs.length > 0 ? (
                            displayedJobs.map(lead => (
                                <View key={lead.id} style={[styles.leadCard, { borderLeftWidth: 5, borderLeftColor: jobsFilter === 'active' ? THEME.green : '#9CA3AF' }]}>
                                    <Text style={[styles.wonTitle, jobsFilter === 'completed' && { color: '#9CA3AF' }]}>
                                        {jobsFilter === 'active' ? "You Won the Job!" : "Job Completed"}
                                    </Text>
                                    <Text style={styles.wonSubtitle}>{jobsFilter === 'active' ? "Congratulations!" : "Well done!"}</Text>
                                    <Text style={styles.wonText}>
                                        <Text style={{ fontWeight: 'bold' }}>{lead.customerName || "The customer"}</Text> has selected your quote for the {lead.category} job.
                                    </Text>
                                    <View style={styles.contactDetails}>
                                        <Text style={styles.contactLabel}>Customer Contact Details:</Text>
                                        <Text style={styles.contactRow}><Text style={{ fontWeight: 'bold' }}>Name:</Text> {lead.customerName}</Text>
                                        <Text style={styles.contactRow}><Text style={{ fontWeight: 'bold' }}>Phone:</Text> {lead.customerPhone}</Text>
                                        <Text style={styles.contactRow}><Text style={{ fontWeight: 'bold' }}>Email:</Text> {lead.customerEmail}</Text>
                                        <Text style={styles.contactRow}><Text style={{ fontWeight: 'bold' }}>Address:</Text> {lead.address || `${lead.town}, ${lead.province}`}</Text>
                                    </View>
                                    <Text style={styles.wonFooter}>Please reach out to the customer immediately to finalize the job.</Text>
                                    {jobsFilter === 'active' && (
                                        <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteJob(lead.id)}>
                                            <Text style={styles.completeButtonText}>Mark as Completed</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>
                                    {jobsFilter === 'active' ? "No active jobs. Keep quoting!" : "No completed jobs yet."}
                                </Text>
                            </View>
                        )}
                    </View>
                );

            case 'insights':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Performance Insights</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Ionicons name="trending-up" size={24} color={THEME.gold} />
                                <Text style={styles.statValue}>{totalQuotesSent}</Text>
                                <Text style={styles.statLabel}>Quotes Sent</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name="trophy" size={24} color={THEME.green} />
                                <Text style={styles.statValue}>{leadsWon}</Text>
                                <Text style={styles.statLabel}>Leads Won</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name="pie-chart" size={24} color="#3B82F6" />
                                <Text style={styles.statValue}>{winRate}%</Text>
                                <Text style={styles.statLabel}>Win Rate</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name="star" size={24} color="#8B5CF6" />
                                <Text style={styles.statValue}>{profile?.rating || "5.0"}</Text>
                                <Text style={styles.statLabel}>Rating</Text>
                            </View>
                        </View>

                        <View style={styles.marketDemandCard}>
                            <Text style={styles.marketDemandTitle}>Market Demand</Text>
                            <Text style={styles.marketDemandValue}>{marketDemand} Active Leads</Text>
                            <Text style={styles.marketDemandSub}>Currently available in your category</Text>
                        </View>

                        {/* Location Hotspots */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Lead Hotspots</Text>
                            {Object.entries(locationData).slice(0, 5).map(([loc, count]: any) => (
                                <View key={loc} style={styles.hotspotCard}>
                                    <Text style={styles.hotspotText}>{loc}</Text>
                                    <Text style={styles.hotspotCount}>{count} Leads</Text>
                                </View>
                            ))}
                        </View>

                        {/* Rejection Feedback */}
                        {rejections.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Feedback</Text>
                                {rejections.map((lead) => (
                                    <View key={lead.id} style={styles.rejectionCard}>
                                        <Text style={styles.rejectionReason}>
                                            "{typeof lead.rejectionFeedback === 'object'
                                                ? (lead.rejectionFeedback.reason || JSON.stringify(lead.rejectionFeedback))
                                                : lead.rejectionFeedback}"
                                        </Text>
                                        <Text style={styles.rejectionJob}>
                                            Job: {lead.issueDescription}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );

            case 'messages':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Messages</Text>
                        {chats.length > 0 ? (
                            chats.map(chat => (
                                <TouchableOpacity
                                    key={chat.id}
                                    style={styles.chatCard}
                                    onPress={() => router.push(`/${chat.id}`)}
                                >
                                    <View style={styles.chatAvatar}>
                                        <Text style={styles.chatAvatarText}>{(chat.customerName || "C").charAt(0)}</Text>
                                    </View>
                                    <View style={styles.chatContent}>
                                        <View style={styles.chatHeader}>
                                            <Text style={styles.chatName}>{chat.customerName || "Customer"}</Text>
                                            <Text style={styles.chatTime}>{timeAgo(chat.updatedAt)}</Text>
                                        </View>
                                        <Text style={styles.chatMessage} numberOfLines={1}>
                                            {chat.lastSenderId === user.uid ? "You: " : ""}{chat.lastMessage}
                                        </Text>
                                    </View>
                                    {chat.vendorUnreadCount > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadText}>{chat.vendorUnreadCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubbles-outline" size={30} color="#ccc" />
                                <Text style={styles.emptyText}>No messages yet.</Text>
                            </View>
                        )}
                    </View>
                );

            case 'notifications':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Activity Feed</Text>
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <TouchableOpacity
                                    key={notif.id}
                                    style={[styles.notifCard, notif.status === 'unread' && styles.unreadNotif]}
                                    onPress={() => {
                                        if (notif.chatId) router.push(`/${notif.chatId}`);
                                        else if (notif.leadId) setActiveTab('dashboard');
                                    }}
                                >
                                    <Ionicons
                                        name={notif.type === 'won' ? 'trophy' : notif.type === 'lead' ? 'flash' : 'notifications'}
                                        size={20}
                                        color={THEME.navy}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.notifText}>
                                            {typeof notif.notificationMessage === 'object'
                                                ? (notif.notificationMessage.reason || JSON.stringify(notif.notificationMessage))
                                                : notif.notificationMessage}
                                        </Text>
                                        <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="notifications-off-outline" size={30} color="#ccc" />
                                <Text style={styles.emptyText}>No notifications.</Text>
                            </View>
                        )}
                    </View>
                );

            case 'subscriptions':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Plan</Text>
                        <View style={styles.planCard}>
                            <View style={styles.planHeader}>
                                <Text style={styles.planLabel}>Current Plan</Text>
                                <View style={styles.planBadge}>
                                    <Text style={styles.planBadgeText}>{profile?.tier || "Basic"}</Text>
                                </View>
                            </View>
                            <Text style={styles.planStatus}>Active</Text>
                            <Text style={styles.planDetail}>
                                Your subscription is active. You can upgrade or downgrade your plan at any time.
                            </Text>
                            <TouchableOpacity
                                style={styles.manageButton}
                                onPress={() => router.push('/select-plan')}
                            >
                                <Text style={styles.manageButtonText}>Manage Subscription</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'support':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Support</Text>
                        <View style={styles.supportCard}>
                            <Text style={styles.inputLabel}>How can we help?</Text>
                            <TextInput
                                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                                placeholder="Describe your issue..."
                                multiline
                                value={supportMessage}
                                onChangeText={setSupportMessage}
                            />
                            <TouchableOpacity style={styles.submitButton} onPress={handleSendSupport}>
                                <Text style={styles.submitButtonText}>SEND TICKET</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.vendorName}>{profile?.name || "Vendor"}</Text>
                </View>
                <View style={styles.tierBadge}>
                    <Text style={styles.tierText}>{profile?.tier || "Basic"}</Text>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.tabItem,
                                activeTab === tab.id && styles.activeTabItem,
                                tab.paid && !isPaidTier && styles.lockedTabItem
                            ]}
                            onPress={() => handleTabPress(tab.id, tab.label, tab.paid)}
                        >
                            <View>
                                {tab.paid && !isPaidTier
                                    ? <Ionicons name="lock-closed-outline" size={20} color={'#9CA3AF'} />
                                    : <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.id ? THEME.navy : '#9CA3AF'} />
                                }
                                {tab.badge ? <View style={styles.tabBadge} /> : null}
                            </View>
                            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel, tab.paid && !isPaidTier && styles.lockedTabLabel]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {renderTabContent()}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* QUOTE MODAL */}
            <Modal visible={!!selectedLead} animationType="slide" transparent>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalContent}>

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Quote</Text>
                            <TouchableOpacity onPress={() => setSelectedLead(null)}>
                                <Ionicons name="close" size={24} color={THEME.navy} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Urgency: {getUrgencyLabel(selectedLead?.urgency)}</Text>

                        <Text style={styles.modalSubtitle}>Job: {selectedLead?.issueDescription}</Text>

                        {selectedLeadImages.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                {selectedLeadImages.map((img: string, index: number) => (
                                    <TouchableOpacity key={index} onPress={() => setViewingImage(img)}>
                                        <Image source={{ uri: img }} style={styles.leadImage} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <Text style={styles.inputLabel}>Price (ZAR)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 1500"
                            keyboardType="numeric"
                            value={quotePrice}
                            onChangeText={setQuotePrice}
                        />

                        <Text style={styles.inputLabel}>Message</Text>
                        <TextInput
                            style={[styles.input, { height: 100 }]}
                            placeholder="Describe your service..."
                            multiline
                            value={quoteMessage}
                            onChangeText={setQuoteMessage}
                        />

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSendQuote}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color={THEME.navy} /> : <Text style={styles.submitButtonText}>SUBMIT QUOTE</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* UPGRADE MODAL */}
            <Modal visible={upgradeModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: THEME.navy, borderColor: THEME.gold, borderWidth: 1 }]}>
                        <View style={{ alignItems: 'center', marginBottom: 15 }}>
                            <Ionicons name="sparkles" size={48} color={THEME.gold} />
                        </View>
                        <Text style={[styles.modalTitle, { color: THEME.white, textAlign: 'center' }]}>Upgrade to Unlock</Text>
                        <Text style={[styles.modalSubtitle, { textAlign: 'center', color: '#ccc', marginBottom: 20, lineHeight: 18 }]}>
                            The <Text style={{ fontWeight: 'bold', color: THEME.white }}>{lockedFeatureName}</Text> tab is a premium feature. Upgrade your plan to track your jobs, view performance analytics, and get more leads.
                        </Text>

                        <View style={{ gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.submitButton, { marginTop: 0 }]}
                                onPress={() => {
                                    setUpgradeModalVisible(false);
                                    router.push('/select-plan');
                                }}
                            >
                                <Text style={styles.submitButtonText}>VIEW PLANS</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setUpgradeModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>MAYBE LATER</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* FULL SCREEN IMAGE MODAL */}
            <Modal visible={!!viewingImage} animationType="fade" transparent>
                <View style={styles.fullScreenImageContainer}>
                    <TouchableOpacity style={styles.closeImageButton} onPress={() => setViewingImage(null)}>
                        <Ionicons name="close" size={30} color={THEME.white} />
                    </TouchableOpacity>
                    {viewingImage && (
                        <Image source={{ uri: viewingImage }} style={styles.fullScreenImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.gray },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.navy },
    loadingText: { color: THEME.gold, marginTop: 10, fontWeight: 'bold' },
    header: { padding: 20, backgroundColor: THEME.navy, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greeting: { color: THEME.gold, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    vendorName: { color: THEME.white, fontSize: 20, fontWeight: '900' },
    tierBadge: { backgroundColor: THEME.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    tierText: { color: THEME.navy, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },

    statsRow: { flexDirection: 'row', padding: 15, gap: 10 },
    statCard: { flex: 1, backgroundColor: THEME.white, padding: 15, borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    statLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase' },
    statValue: { fontSize: 18, fontWeight: '900', color: THEME.navy, marginTop: 5 },

    // Tabs
    tabsContainer: { backgroundColor: THEME.white, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabsContent: { paddingHorizontal: 15, gap: 15 },
    tabItem: { alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, minWidth: 60 },
    activeTabItem: { backgroundColor: THEME.gold },
    lockedTabItem: { opacity: 0.6 },
    tabLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase' },
    activeTabLabel: { color: THEME.navy },
    lockedTabLabel: { color: '#9CA3AF' },
    tabBadge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' },

    // Sections
    section: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: THEME.navy, marginBottom: 15, textTransform: 'uppercase' },

    leadCard: { backgroundColor: THEME.white, padding: 20, borderRadius: 20, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    leadHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    leadCategory: { fontSize: 10, fontWeight: '900', color: THEME.white, backgroundColor: THEME.navy, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, textTransform: 'uppercase' },
    directBadge: { backgroundColor: THEME.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    directBadgeText: { fontSize: 8, fontWeight: '900', color: THEME.navy },
    leadTime: { fontSize: 10, color: '#9CA3AF' },
    urgencyText: {
        fontSize: 10,
        color: '#9CA3AF',
    },
    leadDescription: { fontSize: 16, fontWeight: 'bold', color: THEME.navy, marginBottom: 8 },
    leadLocation: { fontSize: 12, color: '#6B7280', marginBottom: 15, fontWeight: '600' },
    imageScroll: { marginBottom: 15, flexDirection: 'row' },
    leadImage: { width: 80, height: 80, borderRadius: 10, marginRight: 10, backgroundColor: '#eee' },

    quoteButton: { backgroundColor: THEME.gold, padding: 15, borderRadius: 12, alignItems: 'center' },
    quoteButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
    quotedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
    quotedText: { color: '#9CA3AF', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },

    emptyState: { alignItems: 'center', padding: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', borderRadius: 15 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 12 },

    // Jobs Awarded
    wonTitle: { fontSize: 18, fontWeight: '900', color: THEME.green, textTransform: 'uppercase', marginBottom: 5 },
    wonSubtitle: { fontSize: 14, fontWeight: 'bold', color: THEME.navy, marginBottom: 10 },
    wonText: { fontSize: 14, color: THEME.navy, marginBottom: 15 },
    contactDetails: { backgroundColor: '#F0FDF4', padding: 15, borderRadius: 10, marginBottom: 15 },
    contactLabel: { fontSize: 12, fontWeight: '900', color: THEME.navy, marginBottom: 10, textTransform: 'uppercase' },
    contactRow: { fontSize: 14, color: THEME.navy, marginBottom: 5 },
    wonFooter: { fontSize: 12, color: '#666', fontStyle: 'italic' },

    // Insights
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    marketDemandCard: { marginTop: 15, backgroundColor: THEME.navy, padding: 20, borderRadius: 20, alignItems: 'center' },
    marketDemandTitle: { color: THEME.gold, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    marketDemandValue: { color: THEME.white, fontSize: 24, fontWeight: '900', marginVertical: 5 },
    marketDemandSub: { color: '#ccc', fontSize: 10 },

    // Messages
    chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.white, padding: 15, borderRadius: 15, marginBottom: 10 },
    chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.navy, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    chatAvatarText: { color: THEME.gold, fontWeight: '900' },
    chatContent: { flex: 1 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    chatName: { fontSize: 14, fontWeight: 'bold', color: THEME.navy },
    chatTime: { fontSize: 10, color: '#999' },
    chatMessage: { fontSize: 12, color: '#666' },
    unreadBadge: { backgroundColor: THEME.gold, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 5 },
    unreadText: { fontSize: 10, fontWeight: 'bold', color: THEME.navy },

    // Notifications
    notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.white, padding: 15, borderRadius: 15, marginBottom: 10, gap: 10 },
    unreadNotif: { borderLeftWidth: 3, borderLeftColor: THEME.gold },
    notifText: { fontSize: 12, color: THEME.navy, fontWeight: '600' },
    notifTime: { fontSize: 10, color: '#999', marginTop: 2 },

    // Plan
    planCard: { backgroundColor: THEME.navy, padding: 20, borderRadius: 20 },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    planLabel: { color: '#ccc', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    planBadge: { backgroundColor: THEME.gold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    planBadgeText: { color: THEME.navy, fontSize: 10, fontWeight: '900' },
    planStatus: { color: THEME.white, fontSize: 24, fontWeight: '900', marginBottom: 10, fontStyle: 'italic' },
    planDetail: { color: '#ccc', fontSize: 12, lineHeight: 18 },
    manageButton: {
        marginTop: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    manageButtonText: {
        color: THEME.white,
        fontWeight: '900',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Insights Extras
    hotspotCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: THEME.white, borderRadius: 12, marginBottom: 8 },
    hotspotText: { fontWeight: 'bold', color: THEME.navy },
    hotspotCount: { color: THEME.gold, fontWeight: '900' },
    rejectionCard: { padding: 15, backgroundColor: '#FFF5F5', borderRadius: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#F87171' },
    rejectionReason: { fontStyle: 'italic', color: '#7F1D1D', marginBottom: 5 },
    rejectionJob: { fontSize: 10, color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },

    // Support
    supportCard: { backgroundColor: THEME.white, padding: 20, borderRadius: 20 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.9)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.white, borderRadius: 25, padding: 25 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    modalSubtitle: { fontSize: 12, color: '#666', marginBottom: 20, fontStyle: 'italic', lineHeight: 18 },
    inputLabel: { fontSize: 10, fontWeight: '900', color: THEME.navy, marginBottom: 5, textTransform: 'uppercase' },
    input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 16, fontWeight: 'bold', color: THEME.navy },
    submitButton: { backgroundColor: THEME.gold, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
    submitButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    cancelButton: { padding: 15, borderRadius: 12, alignItems: 'center' },
    cancelButtonText: { color: '#ccc', fontWeight: 'bold' },

    // Full Screen Image
    fullScreenImageContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
    fullScreenImage: { width: '100%', height: '100%' },
    closeImageButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },

    // Filters
    filterContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
    filterButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    filterButtonActive: { backgroundColor: THEME.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    filterText: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase' },
    filterTextActive: { color: THEME.navy },
    completeButton: { marginTop: 15, backgroundColor: THEME.green, padding: 12, borderRadius: 10, alignItems: 'center' },
    completeButtonText: { color: THEME.white, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
});
