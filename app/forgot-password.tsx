import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logErrorTicket } from '../lib/client-logger';
import { auth } from '../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
};

export default function ForgotPassword() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleReset = async () => {
        const cleanEmail = email.trim();
        if (!cleanEmail) {
            Alert.alert("Error", "Please enter your email address.");
            return;
        }
        setLoading(true);
        try {
            console.log("Sending password reset to:", cleanEmail);
            await sendPasswordResetEmail(auth, cleanEmail, {
                url: 'https://slyzah.co.za/login', // Helps ensure the link is generated correctly
                handleCodeInApp: false
            });
            console.log("Password reset email sent successfully");
            setResetSent(true);
        } catch (error: any) {
            console.error("Password reset error:", error);
            logErrorTicket(error, "handleReset (ForgotPassword)", undefined, "high");
            if (error.code === 'auth/user-not-found') {
                Alert.alert("Account Not Found", "No vendor account found with this email.");
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert("Invalid Email", "Please enter a valid email address.");
            } else {
                Alert.alert("Error", error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    if (resetSent) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.successIcon}>
                        <Text style={{ fontSize: 40 }}>📨</Text>
                    </View>
                    <Text style={[styles.title, { textAlign: 'center' }]}>Check your inbox</Text>
                    <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                        We've sent a password reset link to{"\n"}
                        <Text style={{ color: THEME.gold, fontWeight: 'bold' }}>{email}</Text>
                    </Text>

                    <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                        <Text style={styles.buttonText}>BACK TO LOGIN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.gold }]} onPress={handleReset} disabled={loading}>
                        {loading ? <ActivityIndicator color={THEME.gold} /> : <Text style={[styles.buttonText, { color: THEME.gold }]}>RESEND EMAIL</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setResetSent(false)}>
                        <Text style={{ color: '#999', fontSize: 12, fontWeight: 'bold' }}>Try a different email</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={THEME.white} />
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>Enter your email to receive a reset link.</Text>

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                    style={styles.input}
                    placeholder="vendor@example.com"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={THEME.navy} />
                    ) : (
                        <Text style={styles.buttonText}>SEND RESET LINK</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.navy, padding: 20 },
    backButton: { marginTop: 40, marginBottom: 20 },
    content: { flex: 1, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: '900', color: THEME.white, marginBottom: 10 },
    subtitle: { fontSize: 14, color: '#ccc', marginBottom: 30 },
    label: { color: THEME.gold, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 15,
        color: THEME.white,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        marginBottom: 20,
    },
    button: { backgroundColor: THEME.gold, padding: 18, borderRadius: 15, alignItems: 'center' },
    buttonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    successIcon: {
        width: 80,
        height: 80,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 20
    }
});