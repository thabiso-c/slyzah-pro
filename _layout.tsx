import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from './lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
};

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error("Background task error:", error);
        return;
    }
    if (data) {
        console.log("Notification received in background:", data);
    }
});

// Configure Notification Handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

function CustomDrawerContent(props: any) {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: THEME.navy }}>
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header */}
                <View style={styles.drawerHeader}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../assets/logo6.png')}
                            style={styles.drawerLogo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.drawerTitle}>SLYZAH</Text>
                </View>

                {/* Navigation Items */}
                <View style={styles.drawerItemsContainer}>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* Footer */}
            <View style={[styles.drawerFooter, { paddingBottom: 20 + bottom }]}>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Ionicons name="log-out-outline" size={24} color={THEME.gold} />
                    <Text style={styles.logoutText}>LOGOUT</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function RootLayout() {
    const [user, setUser] = useState<User | null>(null);
    const [isTermsAccepted, setIsTermsAccepted] = useState(true); // Default to true to avoid flicker/redirect loop on start
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                setLoading(false);
            } else {
                setLoading(true);
            }
        });
        return unsubscribe;
    }, []);

    // Register for Push Notifications
    useEffect(() => {
        if (user) {
            registerForPushNotificationsAsync().then(token => {
                if (token) {
                    console.log("Push Token obtained:", token);
                    // Use setDoc with merge to ensure it saves even if doc is missing fields
                    // and to ensure the latest token is always active
                    setDoc(doc(db, "users", user.uid), {
                        expoPushToken: token,
                        lastTokenUpdate: new Date()
                    }, { merge: true }).catch(err => console.log("Error saving push token:", err));
                }
            });
        }
    }, [user]);

    async function registerForPushNotificationsAsync() {
        // Can't get a token on a simulator, so skip.
        if (!Device.isDevice) {
            return;
        }

        let token;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            Alert.alert('Permission Denied', 'Failed to get push token for push notification!');
            return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            Alert.alert('Configuration Error', 'Missing projectId in app.json/app.config.js under extra.eas');
            return;
        }
        console.log("Using EAS Project ID:", projectId);
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    }

    // Handle Notification Tap (Cold Start & Background)
    const lastNotificationResponse = Notifications.useLastNotificationResponse();

    useEffect(() => {
        if (
            lastNotificationResponse &&
            lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
        ) {
            const data = lastNotificationResponse.notification.request.content.data;
            if (data?.chatId) {
                // Try the standard chat route first, fallback to root dynamic route if needed
                try {
                    router.push(`/chat/${data.chatId}`);
                } catch (e) {
                    router.push(`/${data.chatId}`);
                }
            } else if (data?.leadId) {
                router.push('/dashboard');
            }
        }
    }, [lastNotificationResponse]);

    // Handle Notification Tap (Foreground/Background)
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log("Notification tapped while app is open/background:", data);
            if (data?.chatId) {
                try {
                    router.push(`/chat/${data.chatId}`);
                } catch (e) {
                    router.push(`/${data.chatId}`);
                }
            } else if (data?.leadId) {
                router.push('/dashboard');
            }
        });
        return () => subscription.remove();
    }, [router]);

    // Register background task immediately on mount, independent of notification response
    useEffect(() => {
        Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(err => console.log("Task Register Error:", err));
    }, []);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIsTermsAccepted(data?.hasAcceptedTerms === true);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (loading) return;

        // Public routes that don't require authentication
        const isPublicRoute = pathname === '/login' || pathname === '/' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/select-plan';
        const inTermsGroup = pathname === '/terms';
        const inPaymentGroup = pathname === '/select-plan';

        if (!user && !isPublicRoute) {
            // Force login if not authenticated
            router.replace('/');
        } else if (user) {
            if (!isTermsAccepted && !inTermsGroup && !inPaymentGroup) {
                router.replace('/terms');
            } else if (isTermsAccepted && (pathname === '/' || pathname === '/login')) {
                router.replace('/dashboard');
            }
        }
    }, [user, isTermsAccepted, loading, pathname]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.gold} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    headerStyle: { backgroundColor: THEME.navy },
                    headerTintColor: THEME.gold,
                    headerTitleStyle: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
                    drawerActiveTintColor: THEME.gold,
                    drawerInactiveTintColor: THEME.white,
                    drawerLabelStyle: { fontWeight: 'bold', marginLeft: 0, fontSize: 14 },
                    drawerStyle: { backgroundColor: THEME.navy, width: 280 },
                    drawerActiveBackgroundColor: 'rgba(255, 215, 0, 0.1)',
                }}
            >
                <Drawer.Screen
                    name="index"
                    options={{
                        drawerItemStyle: { display: 'none' }, // Hide Login from Drawer
                        headerShown: false,
                        swipeEnabled: false,
                    }}
                />
                <Drawer.Screen
                    name="dashboard"
                    options={{
                        drawerLabel: 'Dashboard',
                        title: 'VENDOR DASHBOARD',
                        drawerIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />
                    }}
                />
                <Drawer.Screen
                    name="profile"
                    options={{
                        drawerLabel: 'Profile',
                        title: 'PROFILE',
                        drawerIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />
                    }}
                />

                {/* Hidden Login Route */}
                <Drawer.Screen
                    name="login"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                        swipeEnabled: false,
                    }}
                />

                {/* Vendor Specific Hidden Routes */}
                <Drawer.Screen
                    name="register"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                        swipeEnabled: false,
                    }}
                />
                <Drawer.Screen
                    name="select-plan"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                        swipeEnabled: false,
                    }}
                />

                {/* Add these hidden screens to remove them from the drawer */}
                <Drawer.Screen
                    name="results"
                    options={{ drawerItemStyle: { display: 'none' }, headerShown: false }}
                />
                <Drawer.Screen
                    name="RequestQuoteForm"
                    options={{ drawerItemStyle: { display: 'none' }, headerShown: false }}
                />
                <Drawer.Screen
                    name="[id]"
                    options={{ drawerItemStyle: { display: 'none' }, headerShown: false }}
                />
                <Drawer.Screen
                    name="chat/[id]"
                    options={{ drawerItemStyle: { display: 'none' }, headerShown: false }}
                />
                <Drawer.Screen
                    name="terms"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                    }}
                />
                <Drawer.Screen
                    name="forgot-password"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                    }}
                />
            </Drawer>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: THEME.navy
    },
    drawerHeader: {
        height: 200,
        backgroundColor: THEME.navy,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
    },
    logoContainer: {
        width: 80,
        height: 80,
        marginBottom: 10,
    },
    drawerLogo: {
        width: '100%',
        height: '100%',
    },
    drawerTitle: {
        color: THEME.gold,
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 2,
    },
    drawerItemsContainer: {
        flex: 1,
        paddingTop: 10,
    },
    drawerFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: THEME.navy,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoutText: {
        color: THEME.gold,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    }
});
