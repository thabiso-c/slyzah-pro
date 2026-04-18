import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { auth, db } from '../lib/firebaseConfig';

const THEME = {
  navy: '#001f3f',
  gold: '#FFD700',
  white: '#FFFFFF',
};



function CustomDrawerContent(props: any) {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
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
              source={require('../assets/splash-icon.png')}
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
  const [isTermsAccepted, setIsTermsAccepted] = useState(true);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize modular push notifications hook
  usePushNotifications(user, router);

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



  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Only update if the field exists to avoid race conditions with local writes (e.g. push tokens)
        // creating partial documents before the full user profile syncs.
        if (data && 'hasAcceptedTerms' in data) {
          setIsTermsAccepted(data.hasAcceptedTerms === true);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("User snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBusinessName(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "professionals", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessName(data.name || null);
        setSubscriptionTier(data.tier || null);
      }
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
      } else if (isTermsAccepted && (pathname === '/' || pathname === '/terms')) {
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
            drawerLabel: ({ color }) => (
              <View style={{ marginLeft: -15 }}>
                <Text style={{ color, fontWeight: 'bold', fontSize: 13 }}>
                  {businessName ? `${businessName.toUpperCase()} DASHBOARD` : 'DASHBOARD'}
                </Text>
                {subscriptionTier && (
                  <Text style={{ color: THEME.gold, fontSize: 9, fontWeight: '900', marginTop: 2 }}>
                    {subscriptionTier.toUpperCase()} PLAN
                  </Text>
                )}
              </View>
            ),
            headerShown: false,
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
