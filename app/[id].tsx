import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User } from 'firebase/auth';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    placeholder: '#9CA3AF',
};

export default function UnifiedChatPage() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const chatId = Array.isArray(id) ? id[0] : id;
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<any[]>([]);
    const [chatMeta, setChatMeta] = useState<any>(null);
    const [newMessage, setNewMessage] = useState("");
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVendorView, setIsVendorView] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!chatId) return;

        const unsubAuth = auth.onAuthStateChanged(async (u: User | null) => {
            if (!u) {
                router.replace("/login");
                return;
            }
            setUser(u);

            // 1. Verify Permission & Get Metadata
            const docRef = doc(db, "chats", chatId);

            const unsubChatMeta = onSnapshot(docRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    let isAuthorized = false;
                    let isVendor = false;

                    // 1. Check if user is the customer
                    if (u.uid === data.customerId) {
                        isAuthorized = true;
                    }
                    // 2. Check if user is the vendor (Direct ID match)
                    else if (u.uid === data.vendorId) {
                        isAuthorized = true;
                        isVendor = true;
                    }
                    // 3. Fallback: Check if user OWNS the vendor profile
                    else {
                        try {
                            const profRef = doc(db, "professionals", data.vendorId);
                            const profSnap = await getDoc(profRef);
                            if (profSnap.exists() && profSnap.data().uid === u.uid) {
                                isAuthorized = true;
                                isVendor = true;
                            }
                        } catch (e) { console.error(e); }
                    }

                    if (!isAuthorized) {
                        if (loading) {
                            Alert.alert("Error", "Unauthorized access.");
                            router.replace("/");
                        }
                        return;
                    }

                    setIsVendorView(isVendor);
                    setChatMeta(data);
                    setLoading(false);

                    // Handle Typing Indicator
                    if (data.typingStatus) {
                        const isOtherTyping = Object.entries(data.typingStatus).some(([uid, status]) => uid !== u.uid && status === true);
                        setIsTyping(isOtherTyping);
                    }

                } else {
                    Alert.alert("Error", "Chat not found.");
                    router.replace("/");
                }
            });

            return () => unsubChatMeta();
        });

        // 3. Listen to Messages
        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubMsgs = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubAuth(); unsubMsgs(); };
    }, [chatId]);

    // 4. Mark as Read (Heartbeat)
    useEffect(() => {
        if (!chatId || !user || !chatMeta) return;

        const markRead = async () => {
            const field = isVendorView ? "vendorLastRead" : "customerLastRead";
            await updateDoc(doc(db, "chats", chatId), {
                [field]: serverTimestamp(),
                [isVendorView ? "vendorUnreadCount" : "customerUnreadCount"]: 0
            });
        };
        markRead();
    }, [messages.length, chatId, user, isVendorView]);

    const handleTyping = async (status: boolean) => {
        if (!user || !chatId) return;
        await updateDoc(doc(db, "chats", chatId), {
            [`typingStatus.${user.uid}`]: status
        });
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !chatMeta) return;

        const text = newMessage.trim();
        setNewMessage("");
        handleTyping(false);

        try {
            const isVendor = isVendorView;
            const currentSenderName = isVendor
                ? (chatMeta.vendorName || "Professional")
                : (chatMeta.customerName || "Customer");

            // Add Message
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text,
                senderId: user.uid,
                senderName: currentSenderName,
                timestamp: serverTimestamp(),
            });

            // Update Chat Meta
            await updateDoc(doc(db, "chats", chatId), {
                lastMessage: text,
                lastSenderId: user.uid,
                updatedAt: serverTimestamp(),
                [isVendor ? "customerUnreadCount" : "vendorUnreadCount"]: (chatMeta[isVendor ? "customerUnreadCount" : "vendorUnreadCount"] || 0) + 1
            });

            // Notify Vendor if I am the customer
            if (!isVendor) {
                await addDoc(collection(db, "professionals", chatMeta.vendorId, "notifications"), {
                    type: "message",
                    notificationMessage: `New message from ${user.displayName || "Customer"}`,
                    status: "unread",
                    createdAt: serverTimestamp(),
                    chatId: chatId
                });
            }

            // --- NEW: Send Push Notification to Recipient ---
            const recipientId = isVendor ? chatMeta.customerId : chatMeta.vendorId;
            if (recipientId) {
                const recipientDoc = await getDoc(doc(db, "users", recipientId));
                if (recipientDoc.exists()) {
                    const recipientData = recipientDoc.data();
                    const token = recipientData.expoPushToken;

                    if (token) {
                        console.log(`Sending push to token: ${token}`);
                        const response = await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: token,
                                sound: 'default',
                                title: currentSenderName,
                                body: text,
                                data: { chatId: chatId }, // Used by _layout.tsx to navigate
                            }),
                        });
                        const responseData = await response.json();
                        console.log("Push notification response:", responseData);
                        if (responseData.data.status === 'error') {
                            console.error('Push notification error:', responseData.data.message);
                            Alert.alert('Push Notification Error', `Could not send notification: ${responseData.data.details?.error}`);
                        }
                    } else {
                        console.log("Recipient does not have a push token.");
                    }
                }
            }
        } catch (error) {
            console.error("Error sending:", error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.gold} />
            </View>
        );
    }

    const otherName = isVendorView ? chatMeta?.customerName : chatMeta?.vendorName;
    const otherLastRead = isVendorView ? chatMeta?.customerLastRead : chatMeta?.vendorLastRead;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={THEME.navy} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{otherName?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>{otherName}</Text>
                        <View style={styles.secureBadge}>
                            <Ionicons name="shield-checkmark" size={10} color="green" />
                            <Text style={styles.headerSubtitle}> Secure Connection</Text>
                        </View>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* MESSAGES */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    style={{ flex: 1 }}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => {
                        const isMe = item.senderId === user?.uid || (isVendorView && item.senderId === chatMeta?.vendorId);
                        const senderName = isMe ? "You" : (otherName || item.senderName || "User");

                        const isRead = isMe && otherLastRead && item.timestamp
                            ? item.timestamp.toMillis() <= otherLastRead.toMillis()
                            : false;

                        return (
                            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                                <View style={{ maxWidth: '80%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                    <Text style={[styles.senderName, isMe ? { color: THEME.navy } : { color: '#999' }]}>{senderName}</Text>
                                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                                            {item.text}
                                        </Text>
                                    </View>
                                    {item.timestamp?.seconds && (
                                        <View style={styles.metaRow}>
                                            <Text style={styles.timeText}>
                                                {new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            {isMe && (
                                                <Ionicons
                                                    name={isRead ? "checkmark-done" : "checkmark"}
                                                    size={12}
                                                    color={isRead ? THEME.gold : "#ccc"}
                                                    style={{ marginLeft: 4 }}
                                                />
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    }}
                    ListFooterComponent={
                        isTyping ? <Text style={styles.typingText}>Typing...</Text> : null
                    }
                />

                {/* INPUT */}
                <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        value={newMessage}
                        onChangeText={setNewMessage}
                        onFocus={() => handleTyping(true)}
                        onBlur={() => handleTyping(false)}
                        multiline
                    />
                    <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
                        <Ionicons name="send" size={20} color={THEME.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.gray },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.white },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: THEME.white,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { marginRight: 16 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: THEME.navy,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarText: { color: THEME.gold, fontWeight: '900' },
    headerTitle: { fontSize: 14, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    secureBadge: { flexDirection: 'row', alignItems: 'center' },
    headerSubtitle: { fontSize: 10, color: 'green', fontWeight: 'bold', textTransform: 'uppercase' },
    listContent: { padding: 16 },
    messageRow: { marginBottom: 16, flexDirection: 'row' },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },
    senderName: { fontSize: 10, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' },
    bubble: { padding: 12, borderRadius: 20 },
    myBubble: { backgroundColor: THEME.navy, borderTopRightRadius: 4 },
    otherBubble: { backgroundColor: THEME.white, borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#eee' },
    messageText: { fontSize: 14, fontWeight: '600' },
    myMessageText: { color: THEME.white },
    otherMessageText: { color: THEME.navy },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, alignSelf: 'flex-end' },
    timeText: { fontSize: 8, fontWeight: 'bold', color: '#ccc' },
    typingText: { fontSize: 10, fontWeight: '900', color: '#999', marginLeft: 16, marginBottom: 10, textTransform: 'uppercase' },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: THEME.white,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    input: {
        flex: 1,
        backgroundColor: THEME.gray,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 100,
        marginRight: 10,
        fontSize: 14,
        color: THEME.navy,
    },
    sendButton: {
        backgroundColor: THEME.navy,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});