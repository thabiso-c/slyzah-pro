import { useRouter } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../lib/firebaseConfig';

const THEME = {
  navy: '#001f3f',
  gold: '#FFD700',
  white: '#FFFFFF',
  gray: '#F3F4F6',
};

export default function VendorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        checkVendorProfile(user.uid);
      } else {
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  const checkVendorProfile = async (uid: string) => {
    try {
      const docRef = doc(db, "professionals", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        router.replace('/dashboard');
      } else {
        // User exists in Auth but not in Professionals (might be a regular user)
        Alert.alert("Access Denied", "This account is not registered as a Vendor.");
        auth.signOut();
        setInitializing(false);
      }
    } catch (error) {
      console.error(error);
      setInitializing(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkVendorProfile(userCredential.user.uid);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={{ width: 120, height: 120, marginBottom: 10 }}
          resizeMode="contain"
        />
        <Text style={styles.appName}>SLYZAH PRO</Text>
        <Text style={styles.tagline}>FOR PROFESSIONALS</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="vendor@example.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: 20 }}>
          <Text style={{ color: THEME.gold, fontSize: 12, fontWeight: 'bold' }}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={THEME.navy} />
          ) : (
            <Text style={styles.loginButtonText}>LOGIN TO DASHBOARD</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/select-plan')} style={styles.registerLink}>
          <Text style={styles.registerText}>
            New Vendor? <Text style={{ color: THEME.gold, fontWeight: 'bold' }}>Register Business</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.navy, padding: 20, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 50 },
  logoPlaceholder: { width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  appName: { fontSize: 32, fontWeight: '900', color: THEME.white, letterSpacing: 1 },
  tagline: { fontSize: 12, fontWeight: 'bold', color: THEME.gold, letterSpacing: 4, marginTop: 5 },
  formContainer: { width: '100%' },
  label: { color: THEME.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, marginLeft: 5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 15,
    color: THEME.white,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: THEME.gold,
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  loginButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  registerLink: { marginTop: 25, alignItems: 'center' },
  registerText: { color: THEME.white, fontSize: 12 },
});