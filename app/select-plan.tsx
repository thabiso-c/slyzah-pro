import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    purple: '#A855F7',
    border: '#E5E7EB'
};

const PLANS = [
    {
        id: 'basic',
        name: "Basic",
        price: "Free Forever",
        description: "Perfect for new businesses just starting out.",
        color: 'navy',
        live: true,
        features: ["Standard business listing", "Professional profile page", "Receive requests via the platform", "Appear in search based on reviews"],
        trial: false
    },
    {
        id: 'one_region',
        name: "One Region",
        price: "R199/mo",
        description: "For professionals dominating a single suburb or region.",
        color: 'gold',
        live: true,
        features: ["Be Seen First in your region", "Verified Pro Badge", "Appear in Top 8 local results", "Detailed Weekly Growth Reports"],
        trial: true
    },
    {
        id: 'three_regions',
        name: "Three Regions",
        price: "R399/mo",
        description: "For professionals dominating multiple suburbs or regions.",
        color: 'gold',
        live: true,
        features: ["Be Seen First in 3 regions", "Verified Pro Badge", "Appear in Top 8 local results", "Detailed Weekly Growth Reports"],
        trial: true
    },
    {
        id: 'provincial',
        name: "Provincial",
        price: "R599/mo",
        description: "Scale across multiple regions in one province.",
        color: 'gold',
        live: true,
        features: ["Coverage for an entire province", "Everything in 'One Region' plan", "Featured Pro on provincial home page", "Priority support line"],
        trial: true,
        recommended: true
    },
    {
        id: 'multi_province',
        name: "Multi-Province",
        price: "R1499/mo",
        description: "National coverage for large service businesses.",
        color: 'gold',
        live: true,
        features: ["Unlimited multi-province coverage", "Everything in 'Provincial' plan", "Verified National Partner status", "Unlimited category listings"],
        trial: true
    },
    {
        id: 'premium',
        name: "Premium",
        price: "Coming Soon",
        description: "Enterprise features for large service companies.",
        color: 'gray',
        live: false,
        features: ["Guaranteed Top 3 Search Ranking", "Personal Account Manager", "Video Header for your profile", "Zero lead commission fees"],
        trial: false
    }
];

// Replace with your actual PayFast Merchant ID and Key
// IMPORTANT: Your secret keys (MERCHANT_KEY, PASSPHRASE) should NOT be here.
// They must be moved to a secure backend. This file will now call a secure API
// endpoint to generate the payment link.
const YOUR_BACKEND_URL = "https://slyzah.co.za"; // Replace with your actual backend URL

const GROWTH_PLAN_TERMS = [
    "1. Subscription Activation: All paid tiers (One Region, Provincial, Multi-Province) are billed immediately upon registration. Service access is granted once the first payment is confirmed.",
    "2. Geographic Limitations: Vendors are responsible for selecting the correct tier. If a vendor is found to be operating outside their subscribed region, the account may be suspended or limited until the plan is upgraded.",
    "3. Automatic Billing: Subscriptions are recurring. Your provided payment method will be debited monthly on the anniversary of your signup date.",
    "4. Cancellation: You may cancel your subscription at any time via the Vendor Dashboard. Cancellation stops future billing, but no partial refunds are provided for the remaining days of the current cycle.",
    "5. Upgrades: Moving from One Region to Provincial or Multi-Province takes effect immediately, with a pro-rata charge for the difference in plan pricing."
];

// Helper function to calculate subscription details (Pro-rata & Trial)
function calculateSubscription(monthlyPrice: number, isTrial: boolean = false) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    if (isTrial) {
        // FREE TRIAL: Pay R5.00 now (tokenization), billing starts in 1 month
        const nextBillingDate = new Date(now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        return {
            initialAmount: "5.00",
            recurringAmount: monthlyPrice.toFixed(2),
            billingDate: nextBillingDate.toISOString().split('T')[0]
        };
    } else {
        // PRO RATA: Pay for remaining days, billing starts 1st of next month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const remainingDays = daysInMonth - now.getDate() + 1;

        const dailyRate = monthlyPrice / daysInMonth;
        let initialAmountVal = dailyRate * remainingDays;

        // Ensure minimum initial amount is 5.00
        if (initialAmountVal < 5) {
            initialAmountVal = 5.00;
        }

        // Billing starts on 1st of next month
        const nextBillingDate = new Date(year, month + 1, 1).toISOString().split('T')[0];

        return {
            initialAmount: initialAmountVal.toFixed(2),
            recurringAmount: monthlyPrice.toFixed(2),
            billingDate: nextBillingDate
        };
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.white },
    scrollContent: { padding: 20, paddingBottom: 80 },
    header: { alignItems: 'center', marginBottom: 40, marginTop: 40 },
    logo: { width: 60, height: 60, marginBottom: 20, opacity: 0.6 },
    headerTitle: { fontSize: 32, fontWeight: '900', color: THEME.navy, fontStyle: 'italic', textTransform: 'uppercase', textAlign: 'center' },
    headerSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 10, fontWeight: '500', maxWidth: 300 },

    planCard: {
        backgroundColor: THEME.white,
        borderRadius: 32,
        marginBottom: 24,
        borderWidth: 2,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        overflow: 'hidden'
    },
    goldBorder: { borderColor: THEME.gold },
    grayBorder: { borderColor: '#F3F4F6' },
    dimmed: { opacity: 0.6 },
    cardPadding: { padding: 24 },

    comingSoonBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#6B7280', paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 16, zIndex: 10 },
    comingSoonText: { color: THEME.white, fontSize: 9, fontWeight: '900', letterSpacing: 1 },

    planName: { fontSize: 24, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase', letterSpacing: -1 },
    planDescription: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16, height: 30 },

    priceContainer: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', paddingBottom: 24 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline' },
    priceValue: { fontSize: 32, fontWeight: '900', color: THEME.navy, letterSpacing: -1 },
    moLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', marginLeft: 4 },

    trialInfo: { marginTop: 8 },
    standardPrice: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textDecorationLine: 'line-through' },
    trialBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.purple, marginRight: 6 },
    trialLabel: { fontSize: 10, fontWeight: '900', color: THEME.purple, textTransform: 'uppercase' },

    featuresContainer: { gap: 12 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start' },
    checkCircle: { width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginTop: 2, marginRight: 8 },
    goldBg: { backgroundColor: THEME.gold },
    navyBg: { backgroundColor: THEME.navy },
    featureText: { fontSize: 11, fontWeight: '800', color: THEME.navy, flex: 1, lineHeight: 16 },

    selectButton: { margin: 16, paddingVertical: 18, borderRadius: 20, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    goldBtn: { backgroundColor: THEME.gold },
    navyBtn: { backgroundColor: THEME.navy },
    disabledBtn: { backgroundColor: '#F3F4F6' },
    selectButtonText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    navyText: { color: THEME.navy },
    whiteText: { color: THEME.white },

    termsBox: { backgroundColor: '#F9FAFB', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#E5E7EB' },
    termsHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    termsHeaderTitle: { fontSize: 11, fontWeight: '900', color: THEME.navy, marginLeft: 8, letterSpacing: 1 },
    termsScroll: { height: 120, marginBottom: 20 },
    termParagraph: { fontSize: 10, fontWeight: '600', color: '#6B7280', lineHeight: 16, marginBottom: 12 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center' },
    checkboxLabel: { fontSize: 10, fontWeight: '900', color: THEME.navy, marginLeft: 12, flex: 1, textTransform: 'uppercase', letterSpacing: -0.2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.95)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.white, borderRadius: 32, padding: 24 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, fontWeight: '600' },
    modalButtons: { flexDirection: 'row', gap: 12 },
    cancelButton: { flex: 1, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
    cancelButtonText: { color: '#9CA3AF', fontWeight: '900', fontSize: 12 },
    acceptButton: { flex: 1, backgroundColor: THEME.gold, padding: 18, borderRadius: 20, alignItems: 'center' },
    acceptButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 12 }
});

export default function SelectPlan() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<string | null>(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [downgradeModalVisible, setDowngradeModalVisible] = useState(false);

    // Fetch Current Plan
    useEffect(() => {
        const fetchProfile = async () => {
            const user = auth.currentUser;
            if (user) {
                const d = await getDoc(doc(db, "professionals", user.uid));
                if (d.exists()) {
                    setCurrentTier(d.data().tier);
                }
            }
        };
        fetchProfile();
    }, []);

    // Handle return from PayFast
    useEffect(() => {
        const handlePaymentReturn = async () => {
            const user = auth.currentUser;
            if (!user) return;

            if (params.status === 'success') {
                // Activate Plan on Success
                const d = await getDoc(doc(db, "professionals", user.uid));
                if (d.exists()) {
                    const pending = d.data().pendingTier;
                    if (pending) {
                        await updateDoc(doc(db, "professionals", user.uid), {
                            tier: pending,
                            pendingTier: null,
                            isApproved: true,
                            updatedAt: new Date()
                        });
                    }
                }
                Alert.alert("Payment Successful", "Your subscription is now active!");
                router.replace('/dashboard');
            } else if (params.status === 'cancel') {
                // Downgrade to Basic on Cancel and enforce tier rules
                const profDocRef = doc(db, "professionals", user.uid);
                const profDoc = await getDoc(profDocRef);

                if (profDoc.exists()) {
                    const data = profDoc.data();
                    // Revert to the primary province and region saved during registration to enforce Basic tier rules
                    const primaryProvince = data.province ? [data.province] : [];
                    const primaryRegion = data.region ? [data.region] : [];

                    await updateDoc(profDocRef, {
                        tier: "Basic",
                        pendingTier: null,
                        provinces: primaryProvince,
                        regions: primaryRegion,
                        updatedAt: new Date()
                    });
                }
                Alert.alert("Payment Cancelled", "You have been enrolled on the Basic (Free) plan.");
                router.replace('/dashboard');
            }
        };
        handlePaymentReturn();
    }, [params.status]);

    // Handle Auto-Trigger from Registration
    useEffect(() => {
        if (params.action === 'pay' && params.tier) {
            const planToPay = PLANS.find(p => p.id === params.tier);
            if (planToPay) {
                processPlanSelection(planToPay);
            }
        }
    }, [params.action, params.tier]);

    const handlePlanPress = (plan: typeof PLANS[0]) => {
        if (!plan.live) return;
        if (plan.name === currentTier) {
            Alert.alert("Current Plan", "You are already subscribed to this plan.");
            return;
        }

        if (!agreedToTerms && plan.id !== 'basic') {
            Alert.alert("Terms Required", "Please read and agree to the Subscription Terms at the bottom of the page.");
            return;
        }

        // Note: Simple price comparison for downgrade warning
        const currentPrice = PLANS.find(p => p.name === currentTier)?.price;
        const numericCurrentPrice = typeof currentPrice === 'number' ? currentPrice : 0;
        const numericNewPrice = typeof plan.price === 'number' ? plan.price : (plan.id === 'basic' ? 0 : parseInt(plan.price.replace(/\D/g, '')));

        if (numericNewPrice < numericCurrentPrice) {
            setDowngradeModalVisible(true);
            setSelectingId(plan.id);
            return;
        }

        processPlanSelection(plan);
    };

    const processPlanSelection = async (plan: typeof PLANS[0]) => {
        const user = auth.currentUser;

        // If not logged in, redirect to Register with selected tier
        if (!user) {
            router.push({ pathname: '/register', params: { tier: plan.id } } as any);
            return;
        }

        setSelectingId(plan.id);
        setLoading(true);

        try {
            const numericPrice = typeof plan.price === 'number' ? plan.price : (plan.id === 'basic' ? 0 : parseInt(plan.price.replace(/\D/g, '')));

            // 1. Update Profile with Pending Plan
            await updateDoc(doc(db, "professionals", user.uid), {
                pendingTier: plan.name,
                updatedAt: new Date()
            });

            // 2. Handle Free Plan
            if (numericPrice === 0) {
                await updateDoc(doc(db, "professionals", user.uid), {
                    tier: plan.name,
                    pendingTier: null,
                    isApproved: true // Auto-approve basic for now
                });
                Alert.alert("Success", "You are now on the Basic plan.");
                router.replace('/dashboard');
                return;
            }

            // 3. Handle Paid Plan (PayFast Integration)
            const { initialAmount, recurringAmount, billingDate } = calculateSubscription(numericPrice, plan.trial);

            // Data to send to your backend API to generate a signed URL
            const payload = {
                email_address: user.email || "",
                m_payment_id: `sub_${user.uid}_${Date.now()}`,
                amount: initialAmount,
                item_name: `Slyzah ${plan.name} Subscription`,
                item_description: `Monthly subscription for the ${plan.name} tier.`,
                subscription_type: '1',
                billing_date: billingDate,
                recurring_amount: recurringAmount,
                frequency: '3', // 3 = Monthly
                cycles: '0' // 0 = Indefinite
            };

            // Call your secure backend endpoint to get the signed URL
            const response = await fetch(`${YOUR_BACKEND_URL}/api/generate-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Secure your endpoint by verifying the user's identity
                    'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to generate payment link from server.");
            }

            const { paymentUrl } = await response.json();

            if (!paymentUrl) {
                throw new Error("Payment URL was not returned from the server.");
            }

            // Open Web Browser for Payment
            const result = await WebBrowser.openBrowserAsync(paymentUrl);

            // Note: On iOS, the deep link will close the browser and trigger the useEffect above.
            // On Android, the user might need to manually close or the deep link will handle it.

            setLoading(false);

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", "Could not process plan selection.");
            setLoading(false);
        }
    };

    const getButtonText = (plan: typeof PLANS[0]) => {
        if (plan.name === currentTier) return "CURRENT PLAN";

        if (plan.trial) return "START 30-DAY TRIAL";
        if (plan.id === 'basic') return "START FOR FREE";
        return "SELECT PLAN";
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Image source={require('../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.headerTitle}>SCALE YOUR BUSINESS</Text>
                    <Text style={styles.headerSubtitle}>Expand your reach across South Africa. Choose the geographic tier that fits your service area.</Text>
                </View>

                {PLANS.map((plan) => (
                    <View
                        key={plan.id}
                        style={[
                            styles.planCard,
                            plan.color === 'gold' ? styles.goldBorder : styles.grayBorder,
                            !plan.live && styles.dimmed
                        ]}
                    >
                        {!plan.live && (
                            <View style={styles.comingSoonBadge}>
                                <Text style={styles.comingSoonText}>COMING SOON</Text>
                            </View>
                        )}
                        <View style={styles.cardPadding}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            <Text style={styles.planDescription}>{plan.description}</Text>

                            {/* PRICE SECTION */}
                            <View style={styles.priceContainer}>
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceValue}>
                                        {plan.trial ? "R5.00" : plan.price}
                                    </Text>
                                    {plan.live && plan.id !== 'basic' && (
                                        <Text style={styles.moLabel}>/mo</Text>
                                    )}
                                </View>

                                {plan.trial && (
                                    <View style={styles.trialInfo}>
                                        <Text style={styles.standardPrice}>Standard: {plan.price}</Text>
                                        <View style={styles.trialBadgeRow}>
                                            <View style={styles.pulseDot} />
                                            <Text style={styles.trialLabel}>30-Day Trial (R5 Setup Fee)</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={styles.featuresContainer}>
                                {plan.features.map((feature, index) => (
                                    <View key={index} style={styles.featureRow}>
                                        <View style={[styles.checkCircle, plan.color === 'gold' ? styles.goldBg : styles.navyBg]}>
                                            <Ionicons name="checkmark" size={10} color={THEME.white} />
                                        </View>
                                        <Text style={styles.featureText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            disabled={!plan.live || loading}
                            style={[
                                styles.selectButton,
                                plan.color === 'gold' ? styles.goldBtn : (plan.live ? styles.navyBtn : styles.disabledBtn)
                            ]}
                            onPress={() => handlePlanPress(plan)}
                        >
                            {loading && selectingId === plan.id ? (
                                <ActivityIndicator color={plan.color === 'gold' ? THEME.navy : THEME.white} />
                            ) : (
                                <Text style={[styles.selectButtonText, plan.color === 'gold' ? styles.navyText : styles.whiteText]}>
                                    {getButtonText(plan)}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ))}

                {/* TERMS BOX */}
                <View style={styles.termsBox}>
                    <View style={styles.termsHeaderRow}>
                        <Ionicons name="shield-checkmark" size={16} color="#B8860B" />
                        <Text style={styles.termsHeaderTitle}>GROWTH PLAN SUBSCRIPTION TERMS</Text>
                    </View>
                    <ScrollView style={styles.termsScroll} nestedScrollEnabled={true}>
                        {GROWTH_PLAN_TERMS.map((term, index) => (
                            <Text key={index} style={styles.termParagraph}>{term}</Text>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setAgreedToTerms(!agreedToTerms)}
                    >
                        <Ionicons
                            name={agreedToTerms ? "checkbox" : "square-outline"}
                            size={20}
                            color={THEME.navy}
                        />
                        <Text style={styles.checkboxLabel}>I AGREE TO THE SUBSCRIPTION TERMS AND AUTHORIZE RECURRING MONTHLY BILLING.</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* DOWNGRADE WARNING MODAL */}
            <Modal visible={downgradeModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderColor: '#EF4444', borderWidth: 1 }]}>
                        <View style={{ alignItems: 'center', marginBottom: 15 }}>
                            <Ionicons name="warning" size={48} color="#EF4444" />
                        </View>
                        <Text style={[styles.modalTitle, { color: '#EF4444', textAlign: 'center' }]}>Warning: Downgrade</Text>
                        <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
                            You are about to downgrade your plan.
                        </Text>
                        <Text style={[styles.termParagraph, { textAlign: 'center', marginBottom: 20 }]}>
                            This action will limit your access to leads, reduce your coverage area, and remove premium features. Are you sure you want to proceed?
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setDowngradeModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.acceptButton, { backgroundColor: '#EF4444' }]}
                                onPress={() => {
                                    setDowngradeModalVisible(false);
                                    const plan = PLANS.find(p => p.id === selectingId);
                                    if (plan) processPlanSelection(plan);
                                }}
                            >
                                <Text style={[styles.acceptButtonText, { color: THEME.white }]}>CONFIRM DOWNGRADE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
