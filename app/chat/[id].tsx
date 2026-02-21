import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
};

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const user = auth.currentUser;

    useEffect(() => {
        if (!id) return;

        const q = query(
            collection(db, "chats", id as string, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            setLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        return () => unsubscribe();
    }, [id]);

    const handleSend = async () => {
        if (!newMessage.trim() || !user || !id) return;

        const msgText = newMessage.trim();
        setNewMessage('');

        try {
            await addDoc(collection(db, "chats", id as string, "messages"), {
                text: msgText,
                senderId: user.uid,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "chats", id as string), {
                lastMessage: msgText,
                lastSenderId: user.uid,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.navy} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={THEME.navy} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesList}
                    renderItem={({ item }) => {
                        const isMe = item.senderId === user?.uid;
                        return (
                            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                                    {item.text}
                                </Text>
                            </View>
                        );
                    }}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Type a message..."
                        placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                        <Ionicons name="send" size={20} color={THEME.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.gray },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 16, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    messagesList: { padding: 20, paddingBottom: 20 },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 20, marginBottom: 10 },
    myMessage: { alignSelf: 'flex-end', backgroundColor: THEME.navy, borderBottomRightRadius: 4 },
    theirMessage: { alignSelf: 'flex-start', backgroundColor: THEME.white, borderBottomLeftRadius: 4 },
    messageText: { fontSize: 14 },
    myMessageText: { color: THEME.white },
    theirMessageText: { color: THEME.navy },
    inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: THEME.white, alignItems: 'center', gap: 10 },
    input: { flex: 1, backgroundColor: THEME.gray, borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, fontSize: 14, color: THEME.navy },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.gold, justifyContent: 'center', alignItems: 'center' },
});