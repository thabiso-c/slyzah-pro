import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db, storage } from '../lib/firebaseConfig';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
};

const LOCATION_MAPPING: Record<string, string[]> = {
    "Western Cape": ["Cape Town CBD", "Northern Suburbs", "Southern Suburbs", "Atlantic Seaboard", "Western Seaboard", "South Peninsula", "Cape Helderberg", "Cape Winelands", "Paarl/Wellington", "Stellenbosch", "Garden Route", "George/Knysna", "West Coast", "Overberg", "Central Karoo"],
    "Gauteng": ["Johannesburg CBD", "Sandton/Rivonia", "Randburg", "Roodepoort", "Soweto", "Midrand", "Pretoria/Tshwane CBD", "Centurion", "Pretoria East", "Pretoria North", "Ekurhuleni (East Rand)", "Kempton Park", "Brakpan/Benoni", "Sedibeng", "West Rand"],
    "Kwa Zulu Natal": ["Durban Central", "Umhlanga/Ballito", "Durban North", "Durban South", "Pinetown/Westville", "Amanzimtoti", "Pietermaritzburg", "uMgungundlovu", "King Cetshwayo/Richards Bay", "iLembe", "Ugu (South Coast)", "Newcastle"],
    "Eastern Cape": ["Gqeberha (Port Elizabeth)", "East London (Buffalo City)", "Mthatha", "Sarah Baartman", "Amatole", "Chris Hani", "Joe Gqabi"],
    "Free State": ["Bloemfontein (Mangaung)", "Welkom", "Sasolburg", "Bethlehem", "Fezile Dabi", "Lejweleputswa", "Thabo Mofutsanyane"],
    "Limpopo": ["Polokwane (Capricorn)", "Thohoyandou (Vhembe)", "Tzaneen (Mopani)", "Sekhukhune", "Waterberg", "Bela-Bela"],
    "Mpumalanga": ["Nelspruit (Ehlanzeni)", "Witbank (Nkangala)", "Secunda (Gert Sibande)", "Middelburg", "White River"],
    "North West": ["Rustenburg (Bojanala)", "Mahikeng", "Potchefstroom (Dr Kenneth Kaunda)", "Klerksdorp", "Brits"],
    "Northern Cape": ["Kimberley (Frances Baard)", "Upington", "John Taolo Gaetsewe", "Namakwa", "Pixley ka Seme"]
};

const TIER_LIMITS: Record<string, { provinces: number; regions: number }> = {
    'basic': { provinces: 1, regions: 3 },
    'one_region': { provinces: 1, regions: 1 },
    'three_regions': { provinces: 1, regions: 3 },
    'provincial': { provinces: 1, regions: 999 },
    'multi_province': { provinces: 9, regions: 999 }
};

export default function VendorRegister() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [provinces, setProvinces] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'province' | 'region'>('province');
    const [logoUri, setLogoUri] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        businessName: '',
        email: '',
        phone: '',
        category: '',
        description: '',
        password: '',
        confirmPassword: ''
    });

    const selectedTierId = (params.tier as string) || 'basic';
    const tierRules = TIER_LIMITS[selectedTierId] || TIER_LIMITS['basic'];

    const handleRegister = async () => {
        if (!formData.businessName || !formData.email || !formData.password || !formData.category || provinces.length === 0 || regions.length === 0) {
            Alert.alert("Missing Fields", "Please fill in all required fields.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            Alert.alert("Password Error", "Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const uid = userCredential.user.uid;

            // Upload Logo if exists
            let logoUrl = null;
            if (logoUri) {
                const response = await fetch(logoUri);
                const blob = await response.blob();
                const storageRef = ref(storage, `logos/${uid}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, blob);
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            // 2. Create Vendor Profile in Firestore
            await setDoc(doc(db, "professionals", uid), {
                uid: uid,
                name: formData.businessName,
                email: formData.email,
                phone: formData.phone,
                category: formData.category,
                fullCategoryDescription: formData.description,
                province: provinces[0], // Primary province
                provinces: provinces,
                region: regions[0], // Primary region
                regions: regions,
                role: 'vendor',
                tier: selectedTierId === 'basic' ? 'Basic' : 'Pending Payment',
                isApproved: false, // Requires admin approval or payment
                createdAt: serverTimestamp(),
                logo: logoUrl,
                rating: 5.0,
                reviews: 0
            });

            // 3. Create User Profile (for login tracking)
            await setDoc(doc(db, "users", uid), {
                email: formData.email,
                role: 'vendor',
                hasAcceptedTerms: false
            });

            if (selectedTierId && selectedTierId !== 'basic') {
                // Redirect back to Select Plan to process payment
                router.replace({ pathname: '/select-plan', params: { tier: selectedTierId, action: 'pay' } } as any);
            } else {
                Alert.alert("Success", "Account created!");
                router.replace('/dashboard');
            }

        } catch (error: any) {
            console.error(error);
            Alert.alert("Registration Failed", error.message);
        } finally {
            setLoading(false);
        }
    };

    const openSelectionModal = (type: 'province' | 'region') => {
        if (type === 'region' && provinces.length === 0) {
            Alert.alert("Select Province", "Please select a province first.");
            return;
        }
        setModalType(type);
        setModalVisible(true);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setLogoUri(result.assets[0].uri);
        }
    };

    const handleSelection = (item: string) => {
        if (modalType === 'province') {
            if (provinces.includes(item)) {
                // Deselect
                const newProvinces = provinces.filter(p => p !== item);
                setProvinces(newProvinces);
                // Remove regions associated with this province
                const regionsToRemove = LOCATION_MAPPING[item] || [];
                setRegions(regions.filter(r => !regionsToRemove.includes(r)));
            } else {
                // Select
                if (provinces.length >= tierRules.provinces) {
                    if (tierRules.provinces === 1) {
                        // Swap if limit is 1
                        setProvinces([item]);
                        setRegions([]);
                    } else {
                        Alert.alert("Limit Reached", `You can only select ${tierRules.provinces} province(s) on this plan.`);
                    }
                } else {
                    setProvinces([...provinces, item]);
                }
            }
        } else {
            // Region Selection
            if (regions.includes(item)) {
                setRegions(regions.filter(r => r !== item));
            } else {
                if (regions.length >= tierRules.regions) {
                    Alert.alert("Limit Reached", `You can only select ${tierRules.regions} region(s) on this plan.`);
                } else {
                    setRegions([...regions, item]);
                }
            }
        }
    };

    const getModalData = () => {
        if (modalType === 'province') return Object.keys(LOCATION_MAPPING);
        // For regions, combine regions from all selected provinces
        return provinces.flatMap(p => LOCATION_MAPPING[p] || []);
    };

    const handleSelectAll = () => {
        const data = getModalData();
        const allSelected = data.every(item => regions.includes(item));

        if (allSelected) {
            setRegions([]);
        } else {
            if (data.length > tierRules.regions) {
                Alert.alert("Limit Reached", `This plan is limited to ${tierRules.regions} regions.`);
                return;
            }
            setRegions(data);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={THEME.white} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Register Business</Text>
                    <Text style={styles.subtitle}>Join the Slyzah Professional Network</Text>

                    <View style={{ marginBottom: 20, backgroundColor: 'rgba(255,215,0,0.1)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME.gold }}>
                        <Text style={{ color: THEME.gold, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>SELECTED PLAN: {selectedTierId.replace('_', ' ').toUpperCase()}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                            <TouchableOpacity onPress={pickImage} style={styles.logoContainer}>
                                {logoUri ? (
                                    <Image source={{ uri: logoUri }} style={styles.logoImage} />
                                ) : (
                                    <View style={styles.logoPlaceholder}>
                                        <Ionicons name="camera" size={32} color={THEME.white} />
                                        <Text style={styles.logoText}>ADD LOGO</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Business Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Joe's Plumbing"
                            placeholderTextColor="#999"
                            value={formData.businessName}
                            onChangeText={(t) => setFormData({ ...formData, businessName: t })}
                        />

                        <Text style={styles.label}>Service Category</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Plumber, Electrician"
                            placeholderTextColor="#999"
                            value={formData.category}
                            onChangeText={(t) => setFormData({ ...formData, category: t })}
                        />

                        <Text style={styles.label}>About Your Services</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Describe your services..."
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={4}
                            value={formData.description}
                            onChangeText={(t) => setFormData({ ...formData, description: t })}
                        />

                        <Text style={styles.label}>Province</Text>
                        <TouchableOpacity style={styles.selector} onPress={() => openSelectionModal('province')}>
                            <Text style={[styles.selectorText, provinces.length === 0 && styles.placeholderText]}>
                                {provinces.length > 0 ? `${provinces.length} Selected` : "Select Province(s)"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={THEME.white} />
                        </TouchableOpacity>

                        <Text style={styles.label}>Region / City</Text>
                        <TouchableOpacity style={styles.selector} onPress={() => openSelectionModal('region')}>
                            <Text style={[styles.selectorText, regions.length === 0 && styles.placeholderText]}>
                                {regions.length > 0 ? `${regions.length} Selected` : "Select Region(s)"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={THEME.white} />
                        </TouchableOpacity>

                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="business@example.com"
                            placeholderTextColor="#999"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={formData.email}
                            onChangeText={(t) => setFormData({ ...formData, email: t })}
                        />

                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="082 123 4567"
                            placeholderTextColor="#999"
                            keyboardType="phone-pad"
                            value={formData.phone}
                            onChangeText={(t) => setFormData({ ...formData, phone: t })}
                        />

                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={formData.password}
                            onChangeText={(t) => setFormData({ ...formData, password: t })}
                        />

                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={formData.confirmPassword}
                            onChangeText={(t) => setFormData({ ...formData, confirmPassword: t })}
                        />

                        <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
                            {loading ? <ActivityIndicator color={THEME.navy} /> : <Text style={styles.submitButtonText}>CREATE ACCOUNT</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Selection Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {modalType}</Text>
                            {modalType === 'region' && tierRules.regions > 10 && (
                                <TouchableOpacity onPress={handleSelectAll}>
                                    <Text style={{ color: THEME.navy, fontWeight: 'bold', fontSize: 12 }}>
                                        {getModalData().every(item => regions.includes(item)) ? "DESELECT ALL" : "SELECT ALL"}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={THEME.navy} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={getModalData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => {
                                const isSelected = modalType === 'province' ? provinces.includes(item) : regions.includes(item);
                                return (
                                    <TouchableOpacity style={[styles.modalItem, isSelected && { backgroundColor: '#f0f9ff' }]} onPress={() => handleSelection(item)}>
                                        <Text style={[styles.modalItemText, isSelected && { color: THEME.navy, fontWeight: '900' }]}>{item}</Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={THEME.navy} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity style={[styles.submitButton, { marginTop: 10 }]} onPress={() => setModalVisible(false)}>
                            <Text style={styles.submitButtonText}>DONE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.navy },
    scrollContent: { padding: 20, paddingBottom: 50 },
    backButton: { marginBottom: 20 },
    title: { fontSize: 28, fontWeight: '900', color: THEME.white, marginBottom: 5 },
    subtitle: { fontSize: 14, color: THEME.gold, marginBottom: 30, fontWeight: 'bold' },
    form: { gap: 15 },
    label: { color: THEME.white, fontSize: 12, fontWeight: 'bold', marginLeft: 5, textTransform: 'uppercase' },
    input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, color: THEME.white, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    textArea: { height: 100, textAlignVertical: 'top' },
    selector: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectorText: { color: THEME.white, fontWeight: 'bold' },
    placeholderText: { color: '#999' },
    submitButton: { backgroundColor: THEME.gold, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
    submitButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.9)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.white, borderRadius: 20, padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 },
    modalItemText: { fontSize: 16, color: THEME.navy, fontWeight: '600' },
    logoContainer: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', marginBottom: 10, borderWidth: 2, borderColor: THEME.gold, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    logoImage: { width: '100%', height: '100%' },
    logoPlaceholder: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    logoText: { color: THEME.gold, fontSize: 10, fontWeight: 'bold', marginTop: 5 },
});