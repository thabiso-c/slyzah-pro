import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore'; // Changed updateDoc to setDoc
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../lib/firebaseConfig';

const { width } = Dimensions.get('window');

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    textGray: '#4B5563',
    disabled: '#9CA3AF',
};

export default function TermsScreen() {
    const router = useRouter();
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
    const [loading, setLoading] = useState(false);

    // Detect when user hits the bottom of the ScrollView
    const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const paddingToBottom = 50; // Increased threshold for easier trigger
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            setIsScrolledToBottom(true);
        }
    };

    const handleAccept = async () => {
        if (!isScrolledToBottom) return;

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                // setDoc with merge: true creates the doc if it doesn't exist
                // This fixes your "No document to update" error
                await setDoc(doc(db, "users", user.uid), {
                    hasAcceptedTerms: true,
                    role: 'vendor', // Automatically ensures they have a role
                    updatedAt: new Date()
                }, { merge: true });

                router.replace('/dashboard');
            } else {
                Alert.alert("Session Error", "Please login again.");
                router.replace('/login');
            }
        } catch (error) {
            console.error("Terms Acceptance Error:", error);
            Alert.alert("Error", "Could not save your acceptance. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <View style={styles.card}>
            <Text style={styles.sectionHeader}>{title}</Text>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    const Paragraph = ({ children }: { children: React.ReactNode }) => (
        <Text style={styles.paragraph}>{children}</Text>
    );

    return (
        <View style={styles.container}>
            {/* Header with Integrated Logout */}
            <SafeAreaView style={styles.header}>
                <Text style={styles.headerTitle}>VENDOR AGREEMENT</Text>
                <Text style={styles.headerSubtitle}>Please read carefully to continue</Text>
            </SafeAreaView>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <Section title="1. Growth Plan Subscription Terms">
                    <Paragraph>
                        <Text style={{ fontWeight: 'bold' }}>1.1 Subscription Activation:</Text> All paid tiers (One Region, Provincial, Multi-Province) are billed immediately upon registration. Service access is granted once the first payment is confirmed.
                    </Paragraph>
                    <Paragraph>
                        <Text style={{ fontWeight: 'bold' }}>1.2 Geographic Limitations:</Text> Vendors are responsible for selecting the correct tier. If a vendor is found to be operating outside their subscribed region, the account may be suspended or limited until the plan is upgraded.
                    </Paragraph>
                    <Paragraph>
                        <Text style={{ fontWeight: 'bold' }}>1.3 Automatic Billing:</Text> Subscriptions are recurring. Your provided payment method will be debited monthly on the anniversary of your signup date.
                    </Paragraph>
                    <Paragraph>
                        <Text style={{ fontWeight: 'bold' }}>1.4 Cancellation:</Text> You may cancel your subscription at any time via the Vendor Dashboard. Cancellation stops future billing, but no partial refunds are provided for the remaining days of the current cycle.
                    </Paragraph>
                    <Paragraph>
                        <Text style={{ fontWeight: 'bold' }}>1.5 Upgrades:</Text> Moving from One Region to Provincial or Multi-Province takes effect immediately, with a pro-rata charge for the difference in plan pricing.
                    </Paragraph>
                </Section>

                <Section title="2. Service Standards & Conduct">
                    <Paragraph>
                        As a registered professional on Slyzah, you agree to maintain high standards of service. You must treat all customers with respect, provide accurate quotes, and deliver work as agreed.
                    </Paragraph>
                    <Paragraph>
                        Slyzah reserves the right to suspend or terminate accounts that receive consistent negative feedback or violate our community guidelines.
                    </Paragraph>
                </Section>

                <Section title="3. Lead Management">
                    <Paragraph>
                        Leads provided through the platform are for your exclusive use in quoting. You may not resell or redistribute lead information to third parties.
                    </Paragraph>
                </Section>

                <Section title="4. Payments & Fees">
                    <Paragraph>
                        Subscription fees are for access to the platform and leads. Slyzah does not take a commission on jobs won unless explicitly stated in specific promotional campaigns.
                    </Paragraph>
                </Section>

                <Section title="5. Liability & Indemnity">
                    <Paragraph>
                        Slyzah acts as a connector. You are solely responsible for the quality of your work, safety compliance, and any disputes arising with the customer. You agree to indemnify Slyzah against any claims resulting from your services.
                    </Paragraph>
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Sticky Bottom Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.button,
                        isScrolledToBottom ? styles.buttonActive : styles.buttonDisabled
                    ]}
                    onPress={handleAccept}
                    disabled={!isScrolledToBottom || loading}
                >
                    {loading ? (
                        <ActivityIndicator color={THEME.navy} />
                    ) : (
                        <Text style={[
                            styles.buttonText,
                            isScrolledToBottom ? styles.buttonTextActive : styles.buttonTextDisabled
                        ]}>
                            {isScrolledToBottom ? "I ACCEPT VENDOR TERMS" : "SCROLL TO END TO ACCEPT"}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.navy,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: THEME.navy,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: THEME.gold,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    headerSubtitle: {
        fontSize: 12,
        color: THEME.white,
        opacity: 0.7,
        marginTop: 5,
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: THEME.white,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '900',
        color: THEME.navy,
        marginBottom: 12,
    },
    sectionContent: {
        gap: 10,
    },
    paragraph: {
        fontSize: 14,
        color: THEME.textGray,
        lineHeight: 22,
    },
    footer: {
        padding: 20,
        backgroundColor: THEME.white,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    button: {
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonActive: {
        backgroundColor: THEME.gold,
    },
    buttonDisabled: {
        backgroundColor: '#E2E8F0',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    buttonTextActive: {
        color: THEME.navy,
    },
    buttonTextDisabled: {
        color: '#94A3B8',
    },
});