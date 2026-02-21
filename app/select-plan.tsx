import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
};

const PLANS = [
    { id: 'basic', name: "Basic", price: 0, frequency: "Free", features: ["Standard business listing", "Professional profile page", "Receive requests", "Appear in search", "3 specific regions"], trial: false },
    { id: 'one_region', name: "One Region", price: 199, frequency: "Monthly", features: ["Be Seen First in your region", "Verified Pro Badge", "Appear in Top 8 local results", "Detailed Weekly Growth Reports"], trial: true },
    { id: 'three_regions', name: "Three Regions", price: 299, frequency: "Monthly", features: ["Be Seen First in 3 regions", "Verified Pro Badge", "Appear in Top 8 local results", "Detailed Weekly Growth Reports"], trial: true },
    { id: 'provincial', name: "Provincial", price: 599, frequency: "Monthly", features: ["Coverage for an entire province", "Everything in 'One Region'", "Featured on provincial home", "Priority support", "Advanced analytics"], trial: true, recommended: true },
    { id: 'multi_province', name: "Multi-Province", price: 1499, frequency: "Monthly", features: ["Unlimited multi-province coverage", "Everything in 'Provincial'", "Verified National Partner", "Unlimited category listings"], trial: true }
];

// Replace with your actual PayFast Merchant ID and Key
const MERCHANT_ID = process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_ID || "33365711";
const MERCHANT_KEY = process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_KEY || "ump8fde2nc8xm";
const PASSPHRASE = process.env.EXPO_PUBLIC_PAYFAST_PASSPHRASE || "Motivation_1";
const PAYFAST_URL = process.env.EXPO_PUBLIC_PAYFAST_URL || "https://www.payfast.co.za/eng/process";
// IMPORTANT: This must point to your LIVE web backend to process the ITN
const NOTIFY_URL = "https://slyzah.co.za/api/payfast/itn";

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

export default function SelectPlan() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [currentTier, setCurrentTier] = useState<string | null>(null);
    const [termsVisible, setTermsVisible] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<typeof PLANS[0] | null>(null);
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
        if (plan.name === currentTier) {
            Alert.alert("Current Plan", "You are already subscribed to this plan.");
            return;
        }

        const currentPlanObj = PLANS.find(p => p.name === currentTier);
        const currentPrice = currentPlanObj ? currentPlanObj.price : 0;

        // Check for Downgrade
        if (plan.price < currentPrice) {
            setPendingPlan(plan);
            setDowngradeModalVisible(true);
            return;
        }

        initiateSelection(plan);
    };

    const initiateSelection = (plan: typeof PLANS[0]) => {
        if (plan.price > 0) {
            setPendingPlan(plan);
            setTermsAccepted(false);
            setTermsVisible(true);
        } else {
            processPlanSelection(plan);
        }
    };

    const processPlanSelection = async (plan: typeof PLANS[0]) => {
        const user = auth.currentUser;

        // If not logged in, redirect to Register with selected tier
        if (!user) {
            router.push({ pathname: '/register', params: { tier: plan.id } } as any);
            return;
        }

        setSelectedPlan(plan.id);
        setLoading(true);

        try {
            // 1. Update Profile with Pending Plan
            await updateDoc(doc(db, "professionals", user.uid), {
                pendingTier: plan.name,
                updatedAt: new Date()
            });

            // 2. Handle Free Plan
            if (plan.price === 0) {
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
            if (!MERCHANT_ID || !MERCHANT_KEY) {
                Alert.alert("Configuration Error", "PayFast Merchant ID/Key not found.");
                setLoading(false);
                return;
            }

            const { initialAmount, recurringAmount, billingDate } = calculateSubscription(plan.price, plan.trial);

            // Construct PayFast URL
            // PayFast requires valid HTTP/HTTPS URLs. Custom schemes trigger 400 Bad Request.
            const returnUrl = `https://slyzah.co.za/payment-return?status=success`;
            const cancelUrl = `https://slyzah.co.za/payment-cancel?status=cancel`;

            const data: Record<string, string> = {
                merchant_id: MERCHANT_ID,
                merchant_key: MERCHANT_KEY,
                return_url: returnUrl,
                cancel_url: cancelUrl,
                notify_url: NOTIFY_URL,
                email_address: user.email || "",
                m_payment_id: `sub_${user.uid}_${Date.now()}`,
                amount: initialAmount,
                item_name: `Slyzah ${plan.name} Subscription`,
                item_description: `Monthly subscription for the ${plan.name} tier.`,
                subscription_type: '1',
                billing_date: billingDate,
                recurring_amount: recurringAmount,
                frequency: '3',
                cycles: '0'
            };

            // Generate Signature
            let pfOutput = "";
            const requiredOrder = [
                'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
                'email_address', 'm_payment_id', 'amount', 'item_name', 'item_description',
                'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles'
            ];

            requiredOrder.forEach((key) => {
                if (data[key]) {
                    const value = String(data[key]).trim();
                    // Align with Web: replace %20 with + and ensure uppercase hex for PayFast compatibility
                    const encodedValue = encodeURIComponent(value)
                        .replace(/%20/g, "+")
                        .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase());
                    pfOutput += `${key}=${encodedValue}&`;
                }
            });

            let signatureString = pfOutput.slice(0, -1); // Remove trailing &
            if (PASSPHRASE) {
                signatureString += `&passphrase=${encodeURIComponent(PASSPHRASE.trim())
                    .replace(/%20/g, "+")
                    .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase())}`;
            }

            const signature = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.MD5,
                signatureString
            );

            const paymentUrl = `${PAYFAST_URL}?${pfOutput}signature=${signature}`;

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

        const currentPlanObj = PLANS.find(p => p.name === currentTier);

        if (currentPlanObj) {
            if (plan.price > currentPlanObj.price) return "UPGRADE";
            if (plan.price < currentPlanObj.price) return "DOWNGRADE";
        }

        // For new vendors or if prices are the same
        return `CHOOSE ${plan.name.toUpperCase()}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Select Your Plan</Text>
                <Text style={styles.headerSubtitle}>Choose the best tier for your business</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {PLANS.map((plan) => (
                    <TouchableOpacity
                        key={plan.id}
                        style={[styles.planCard, (selectedPlan === plan.id || plan.name === currentTier) && styles.selectedCard, (plan as any).recommended && styles.recommendedCard]}
                        onPress={() => handlePlanPress(plan)}
                        disabled={loading || plan.name === currentTier}
                    >
                        {(plan as any).recommended && (
                            <View style={styles.recommendedBadge}>
                                <Text style={styles.recommendedText}>RECOMMENDED</Text>
                            </View>
                        )}
                        <View style={styles.planHeader}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            <Text style={styles.planPrice}>
                                {plan.price === 0 ? "Free" : `R${plan.price}`}
                                {plan.price > 0 && <Text style={styles.frequency}>/mo</Text>}
                            </Text>
                            {plan.trial && <Text style={styles.trialText}>30-Day Free Trial</Text>}
                        </View>

                        <View style={styles.featuresContainer}>
                            {plan.features.map((feature, index) => (
                                <View key={index} style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={16} color={THEME.gold} />
                                    <Text style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.selectButton}>
                            {loading && selectedPlan === plan.id ? (
                                <ActivityIndicator color={THEME.navy} />
                            ) : (
                                <Text style={styles.selectButtonText}>
                                    {getButtonText(plan)}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* TERMS MODAL */}
            <Modal visible={termsVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Growth Plan Terms</Text>
                        <Text style={styles.modalSubtitle}>Please review and accept the terms to proceed.</Text>

                        <ScrollView style={styles.termsScroll}>
                            {GROWTH_PLAN_TERMS.map((term, index) => (
                                <Text key={index} style={styles.termText}>{term}</Text>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setTermsAccepted(!termsAccepted)}
                        >
                            <Ionicons
                                name={termsAccepted ? "checkbox" : "square-outline"}
                                size={24}
                                color={termsAccepted ? THEME.gold : THEME.white}
                            />
                            <Text style={styles.checkboxText}>I accept the subscription terms</Text>
                        </TouchableOpacity>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setTermsVisible(false)}>
                                <Text style={styles.cancelButtonText}>CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.acceptButton, !termsAccepted && styles.disabledButton]}
                                onPress={() => {
                                    setTermsVisible(false);
                                    if (pendingPlan) processPlanSelection(pendingPlan);
                                }}
                                disabled={!termsAccepted}
                            >
                                <Text style={styles.acceptButtonText}>CONTINUE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DOWNGRADE WARNING MODAL */}
            <Modal visible={downgradeModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderColor: '#EF4444' }]}>
                        <View style={{ alignItems: 'center', marginBottom: 15 }}>
                            <Ionicons name="warning" size={48} color="#EF4444" />
                        </View>
                        <Text style={[styles.modalTitle, { color: '#EF4444', textAlign: 'center' }]}>Warning: Downgrade</Text>
                        <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
                            You are about to downgrade to the <Text style={{ fontWeight: 'bold', color: THEME.white }}>{pendingPlan?.name}</Text> plan.
                        </Text>
                        <Text style={[styles.termText, { textAlign: 'center', marginBottom: 20 }]}>
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
                                    if (pendingPlan) initiateSelection(pendingPlan);
                                }}
                            >
                                <Text style={[styles.acceptButtonText, { color: THEME.white }]}>CONFIRM DOWNGRADE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.navy },
    header: { padding: 20, paddingTop: 60, alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: THEME.white, textTransform: 'uppercase' },
    headerSubtitle: { fontSize: 12, color: THEME.gold, marginTop: 5, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 50 },

    planCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectedCard: {
        borderColor: THEME.gold,
        backgroundColor: 'rgba(255, 215, 0, 0.05)',
    },
    recommendedCard: {
        borderColor: THEME.gold,
        borderWidth: 2,
    },
    recommendedBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: THEME.gold,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 12,
    },
    recommendedText: { color: THEME.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap' },
    planName: { fontSize: 18, fontWeight: '900', color: THEME.white, textTransform: 'uppercase' },
    planPrice: { fontSize: 20, fontWeight: '900', color: THEME.gold },
    frequency: { fontSize: 10, color: '#999' },
    trialText: { fontSize: 10, color: '#10B981', fontWeight: 'bold', width: '100%', marginTop: 5, textTransform: 'uppercase' },

    featuresContainer: { gap: 8, marginBottom: 20 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureText: { color: '#ccc', fontSize: 12, fontWeight: 'bold' },

    selectButton: {
        backgroundColor: THEME.white,
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    selectButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 12, letterSpacing: 1 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.95)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.navy, borderRadius: 20, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: THEME.gold },
    modalTitle: { fontSize: 20, fontWeight: '900', color: THEME.white, marginBottom: 5, textTransform: 'uppercase' },
    modalSubtitle: { fontSize: 12, color: '#ccc', marginBottom: 15 },
    termsScroll: { marginBottom: 20 },
    termText: { color: '#e0e0e0', fontSize: 13, marginBottom: 12, lineHeight: 20 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
    checkboxText: { color: THEME.white, fontSize: 14, fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', gap: 10 },
    cancelButton: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#666', alignItems: 'center' },
    cancelButtonText: { color: '#ccc', fontWeight: 'bold' },
    acceptButton: { flex: 1, backgroundColor: THEME.gold, padding: 15, borderRadius: 12, alignItems: 'center' },
    disabledButton: { backgroundColor: '#555' },
    acceptButtonText: { color: THEME.navy, fontWeight: '900' },
});
