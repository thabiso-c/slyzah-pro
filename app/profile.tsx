import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    'one region': { provinces: 1, regions: 1 },
    'three regions': { provinces: 1, regions: 3 },
    'provincial': { provinces: 1, regions: 999 },
    'multi-province': { provinces: 9, regions: 999 }
};

export default function ProfileScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        fullCategoryDescription: '',
        website: '',
    });

    // Location Modal State
    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'province' | 'region'>('province');
    const [tempProvinces, setTempProvinces] = useState<string[]>([]);
    const [tempRegions, setTempRegions] = useState<string[]>([]);
    const [logoUri, setLogoUri] = useState<string | null>(null);

    const isPaidTier = useMemo(() => profile?.tier && profile.tier.toLowerCase() !== 'basic', [profile]);

    useEffect(() => {
        const fetchProfile = async () => {
            const user = auth.currentUser;
            if (!user) {
                router.replace('/');
                return;
            }

            try {
                const docRef = doc(db, "professionals", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Normalize location data for existing/legacy accounts
                    const loadedProvinces = Array.isArray(data.provinces) ? data.provinces : (data.province ? [data.province] : []);
                    const loadedRegions = Array.isArray(data.regions) ? data.regions : (data.region ? [data.region] : []);

                    setProfile({ ...data, provinces: loadedProvinces, regions: loadedRegions });

                    setFormData({
                        name: data.name || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        fullCategoryDescription: data.fullCategoryDescription || data.description || '',
                        website: data.website || '',
                    });
                    setLogoUri(data.logo || null);
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
                Alert.alert("Error", "Could not load profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setSaving(true);
        try {
            let logoUrl = profile.logo; // Keep old logo by default

            // If a new logo was picked (it's a local file URI)
            if (logoUri && logoUri.startsWith('file://')) {
                const response = await fetch(logoUri);
                const blob = await response.blob();
                const storageRef = ref(storage, `logos/${user.uid}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, blob);
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            const docRef = doc(db, "professionals", user.uid);
            await updateDoc(docRef, {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                fullCategoryDescription: formData.fullCategoryDescription,
                website: formData.website,
                logo: logoUrl,
            });
            Alert.alert("Success", "Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Could not update profile. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const openLocationModal = (type: 'province' | 'region') => {
        if (type === 'region' && tempProvinces.length === 0) {
            Alert.alert("Select Province", "Please select a province first.");
            return;
        }
        setModalType(type);
        setLocationModalVisible(true);
    };

    const handleLocationSelection = (item: string) => {
        const tierId = profile?.tier?.toLowerCase().replace(' ', '_') || 'basic';
        const tierRules = TIER_LIMITS[tierId] || TIER_LIMITS['basic'];

        if (modalType === 'province') {
            if (tempProvinces.includes(item)) {
                const newProvinces = tempProvinces.filter(p => p !== item);
                setTempProvinces(newProvinces);
                const regionsToRemove = LOCATION_MAPPING[item] || [];
                setTempRegions(tempRegions.filter(r => !regionsToRemove.includes(r)));
            } else {
                if (tempProvinces.length >= tierRules.provinces) {
                    if (tierRules.provinces === 1) {
                        setTempProvinces([item]);
                        setTempRegions([]);
                    } else {
                        Alert.alert("Limit Reached", `You can only select ${tierRules.provinces} province(s) on this plan.`);
                    }
                } else {
                    setTempProvinces([...tempProvinces, item]);
                }
            }
        } else { // Region
            if (tempRegions.includes(item)) {
                setTempRegions(tempRegions.filter(r => r !== item));
            } else {
                if (tempRegions.length >= tierRules.regions) {
                    Alert.alert("Limit Reached", `You can only select ${tierRules.regions} region(s) on this plan.`);
                } else {
                    setTempRegions([...tempRegions, item]);
                }
            }
        }
    };

    const handleSaveLocations = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setSaving(true);
        try {
            const docRef = doc(db, "professionals", user.uid);
            await updateDoc(docRef, {
                provinces: tempProvinces,
                regions: tempRegions,
            });
            setProfile({ ...profile, provinces: tempProvinces, regions: tempRegions });
            setLocationModalVisible(false);
            Alert.alert("Success", "Service area updated!");
        } catch (error) {
            console.error("Error updating locations:", error);
            Alert.alert("Error", "Could not update service area.");
        } finally {
            setSaving(false);
        }
    };

    const getModalData = () => {
        if (modalType === 'province') return Object.keys(LOCATION_MAPPING);
        return tempProvinces.flatMap(p => LOCATION_MAPPING[p] || []);
    };

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
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

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.gold} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={THEME.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>EDIT PROFILE</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity onPress={pickImage} style={styles.avatar}>
                            {logoUri ? (
                                <Image source={{ uri: logoUri }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>{profile?.name?.charAt(0) || "V"}</Text>
                            )}
                            <View style={styles.editAvatarBadge}>
                                <Ionicons name="pencil" size={12} color={THEME.navy} />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.tierBadge}>{profile?.tier || "Basic"} Plan</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Business Name</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.name}
                                onChangeText={(t) => setFormData({ ...formData, name: t })}
                                placeholder="Business Name"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.phone}
                                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                                placeholder="Phone Number"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.email}
                                onChangeText={(t) => setFormData({ ...formData, email: t })}
                                placeholder="Email Address"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Website</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.website}
                                onChangeText={(t) => setFormData({ ...formData, website: t })}
                                placeholder="https://your-business.com"
                                keyboardType="url"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.fullCategoryDescription}
                                onChangeText={(t) => setFormData({ ...formData, fullCategoryDescription: t })}
                                placeholder="Describe your services..."
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <View style={styles.readOnlyGroup}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.readOnlyInput}>
                                <Text style={styles.readOnlyText}>{profile?.category || "Not set"}</Text>
                                <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                            </View>
                            <Text style={styles.helperText}>Contact support to change category.</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Service Area</Text>
                            <View style={[styles.readOnlyInput, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                                <Text style={styles.readOnlyText}><Text style={{ fontWeight: '900' }}>Provinces:</Text> {profile?.provinces?.join(', ') || 'Not set'}</Text>
                                <Text style={styles.readOnlyText}><Text style={{ fontWeight: '900' }}>Regions:</Text> {profile?.regions?.join(', ') || 'Not set'}</Text>
                            </View>
                            {isPaidTier ? (
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => {
                                        setTempProvinces(profile?.provinces || []);
                                        setTempRegions(profile?.regions || []);
                                        setLocationModalVisible(true);
                                    }}
                                >
                                    <Ionicons name="pencil" size={12} color={THEME.navy} />
                                    <Text style={styles.editButtonText}>EDIT SERVICE AREA</Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.helperText}>Upgrade your plan to service more areas.</Text>
                            )}
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color={THEME.navy} />
                            ) : (
                                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Location Selection Modal */}
            <Modal visible={locationModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {modalType}</Text>
                            <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                                <Ionicons name="close" size={24} color={THEME.navy} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={getModalData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => {
                                const isSelected = modalType === 'province' ? tempProvinces.includes(item) : tempRegions.includes(item);
                                return (
                                    <TouchableOpacity style={[styles.modalItem, isSelected && { backgroundColor: '#f0f9ff' }]} onPress={() => handleLocationSelection(item)}>
                                        <Text style={[styles.modalItemText, isSelected && { color: THEME.navy, fontWeight: '900' }]}>{item}</Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={THEME.navy} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity style={[styles.saveButton, { marginTop: 10 }]} onPress={handleSaveLocations} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color={THEME.navy} />
                            ) : (
                                <Text style={styles.saveButtonText}>SAVE AREA</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.navy },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.navy },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    content: { padding: 20 },
    avatarContainer: { alignItems: 'center', marginBottom: 30 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: THEME.gold },
    avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
    avatarText: { fontSize: 32, fontWeight: '900', color: THEME.navy },
    editAvatarBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: THEME.white,
        padding: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: THEME.navy,
    },
    tierBadge: { color: THEME.gold, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { color: THEME.white, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginLeft: 4 },
    input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, color: THEME.white, fontSize: 16 },
    textArea: { height: 100, textAlignVertical: 'top' },
    readOnlyGroup: { gap: 8, opacity: 0.7 },
    readOnlyInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    readOnlyText: { color: '#9CA3AF', fontSize: 16 },
    helperText: { color: '#9CA3AF', fontSize: 10, marginLeft: 4 },
    editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: THEME.gold, padding: 10, borderRadius: 8, alignSelf: 'flex-start', marginTop: -5 },
    editButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 10 },
    saveButton: { backgroundColor: THEME.gold, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.9)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.white, borderRadius: 20, padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 },
    modalItemText: { fontSize: 16, color: THEME.navy, fontWeight: '600' },
});