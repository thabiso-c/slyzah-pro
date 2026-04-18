import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
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
const CREDENTIAL_MAPPING: Record<string, { label: string; field: string; docField: string }> = {
    "Plumber": { label: "PIRB / CoCT Reg", field: "pirbNumber", docField: "pirbDocumentUrl" },
    "Electrician": { label: "Wireman's License", field: "wiremanNumber", docField: "wiremanDocumentUrl" },
    "Panel Beater": { label: "RMI Member", field: "rmiNumber", docField: "rmiDocumentUrl" },
    "Builder": { label: "NHBRC Reg", field: "nhbrcNumber", docField: "nhbrcDocumentUrl" },
    "Gas": { label: "SAQCC Gas", field: "saqccNumber", docField: "saqccDocumentUrl" },
    "Air Conditioning": { label: "SARACCA", field: "saraccaNumber", docField: "saraccaDocumentUrl" },
    "CCTV & Security": { label: "PSiRA Reg", field: "psiraNumber", docField: "psiraDocumentUrl" },
    "Pest Control": { label: "PCO Reg", field: "pcoNumber", docField: "pcoDocumentUrl" },
    "Appliance Repairs": { label: "Trade Cert", field: "tradeCertNumber", docField: "tradeCertDocumentUrl" },
    "Locksmith": { label: "LASA Member", field: "lasaNumber", docField: "lasaDocumentUrl" },
    "Roofing": { label: "PRA Member", field: "praNumber", docField: "praDocumentUrl" },
    "Gate Motors": { label: "Certified Installer", field: "installerNumber", docField: "installerDocumentUrl" },
    "Handyman": { label: "Liability Insurance", field: "liabilityPolicyNumber", docField: "liabilityPolicyUrl" },
    "Solar/Power": { label: "PV Green Card", field: "pvGreenCardNumber", docField: "pvGreenCardUrl" },
    "Cleaning": { label: "NCCA Member", field: "nccaNumber", docField: "nccaUrl" },
    "Automotive": { label: "RMI / MIWA", field: "rmiMiwaNumber", docField: "rmiMiwaUrl" },
    "Carpenter": { label: "Trade Certificate", field: "tradeCertNumber", docField: "tradeCertDocumentUrl" },
    "Solar": { label: "PV GreenCard", field: "pvGreenCardNumber", docField: "pvGreenCardUrl" },
    "Fire Protection": { label: "SAQCC Fire", field: "fireRegNumber", docField: "fireRegUrl" },
    "Movers": { label: "PMA Member", field: "pmaNumber", docField: "pmaUrl" },
    "Mechanic": { label: "MIWA/RMI Member", field: "miwaNumber", docField: "miwaUrl" },
    "Auto Glass": { label: "SAGGA Member", field: "saggaNumber", docField: "saggaUrl" },
    "Borehole": { label: "BWA Member", field: "bwaNumber", docField: "bwaUrl" },
    "Pool Services": { label: "NSPI Member", field: "nspiNumber", docField: "nspiUrl" },
    "Tree Felling": { label: "Public Liability", field: "insuranceNumber", docField: "insuranceUrl" },
    "Solar / EV": { label: "PV GreenCard / EV Cert", field: "pvGreenCardNumber", docField: "pvGreenCardUrl" },
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

const resolveCredentialMapping = (categoryInput: string) => {
    if (!categoryInput) return null;

    // 1. Exact Match
    if (CREDENTIAL_MAPPING[categoryInput]) return CREDENTIAL_MAPPING[categoryInput];

    // 2. Fuzzy / Keyword Match
    const normalized = categoryInput.toLowerCase();

    const keywords: Record<string, string> = {
        "plumb": "Plumber",
        "electr": "Electrician",
        "carpent": "Carpenter",
        "build": "Builder",
        "gas": "Gas",
        "air": "Air Conditioning",
        "condition": "Air Conditioning",
        "security": "CCTV & Security",
        "cctv": "CCTV & Security",
        "pest": "Pest Control",
        "appliance": "Appliance Repairs",
        "lock": "Locksmith",
        "roof": "Roofing",
        "gate": "Gate Motors",
        "solar": "Solar/Power",
        "power": "Solar/Power",
        "clean": "Cleaning",
        "auto": "Automotive",
        "mechanic": "Automotive",
        "panel": "Panel Beater",
        "beat": "Panel Beater",
    };

    for (const [keyword, mapKey] of Object.entries(keywords)) {
        if (normalized.includes(keyword)) {
            return CREDENTIAL_MAPPING[mapKey];
        }
    }

    return null;
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
        credentialNumber: '',
        additionalCerts: [] as (string | { name: string; url?: string; file?: DocumentPicker.DocumentPickerAsset })[],
    });

    // Location Modal State
    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'province' | 'region'>('province');
    const [tempProvinces, setTempProvinces] = useState<string[]>([]);
    const [tempRegions, setTempRegions] = useState<string[]>([]);
    const [newCertInput, setNewCertInput] = useState('');
    const [newCertFile, setNewCertFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [cipcVerificationLoading, setCipcVerificationLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [cipcRegNumber, setCipcRegNumber] = useState('');
    const [cipcFile, setCipcFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [credentialFile, setCredentialFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

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

                    const loadedMapping = resolveCredentialMapping(data.category);

                    setFormData({
                        name: data.name || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        fullCategoryDescription: data.fullCategoryDescription || data.description || '',
                        website: data.website || '',
                        credentialNumber: loadedMapping ? data[loadedMapping.field] || '' : '',
                        additionalCerts: data.additionalCerts || [],
                    });
                    setLogoUri(data.logo || null);
                    setCipcRegNumber(data.cipcRegistrationNumber || '');
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

    // Helper to handle resumable uploads with progress tracking
    const uploadWithProgress = async (storageRef: any, blob: Blob, metadata: any, progressKey: string) => {
        const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

        return new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(prev => ({ ...prev, [progressKey]: progress }));
                },
                (error) => reject(error),
                async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
            );
        });
    };

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user || saving) return;

        // Input Validation
        if (formData.name.length < 2) {
            Alert.alert("Validation Error", "Business name is too short.");
            return;
        }

        setSaving(true);
        try {
            // Sanitization
            const sanitizedName = formData.name.trim().replace(/[<>]/g, "");
            let logoUrl = profile.logo;
            setUploadProgress({});

            // If a new logo was picked (it's a local file URI)
            if (logoUri && logoUri.startsWith('file://')) {
                const response = await fetch(logoUri);
                const blob = await response.blob();
                const storageRef = ref(storage, `logos/${user.uid}/${Date.now()}`);
                logoUrl = await uploadWithProgress(storageRef, blob, { contentType: 'image/jpeg' }, 'logo');
            }

            // Process Additional Certifications (Handle new uploads)
            const finalAdditionalCerts = [];
            for (let i = 0; i < formData.additionalCerts.length; i++) {
                const cert = formData.additionalCerts[i];
                if (typeof cert === 'string') {
                    finalAdditionalCerts.push(cert);
                } else if (cert && typeof cert === 'object') {
                    const c = cert as { name: string; url?: string; file?: DocumentPicker.DocumentPickerAsset };
                    if (c.file) {
                        const response = await fetch(c.file.uri);
                        const blob = await response.blob();
                        const ext = c.file.name.split('.').pop() || 'pdf';
                        const storageRef = ref(storage, `additional_certs/${user.uid}/cert_${Date.now()}_${Math.random()}.${ext}`);

                        const url = await uploadWithProgress(
                            storageRef, blob,
                            { contentType: c.file.mimeType || 'application/pdf' },
                            `cert_${i}`
                        );
                        finalAdditionalCerts.push({ name: c.name, url });
                    } else {
                        finalAdditionalCerts.push(cert);
                    }
                }
            }

            const updateData: any = {
                name: sanitizedName,
                phone: formData.phone.trim(),
                email: formData.email.toLowerCase().trim(),
                fullCategoryDescription: formData.fullCategoryDescription.trim(),
                website: formData.website.trim(),
                additionalCerts: finalAdditionalCerts,
                logo: logoUrl,
                cipcRegistrationNumber: cipcRegNumber.trim(),
            };

            // Handle Professional Number
            const mapping = resolveCredentialMapping(profile.category);
            if (mapping) {
                updateData[mapping.field] = formData.credentialNumber;
            }

            // Handle CIPC Document Upload
            if (cipcFile) {
                const response = await fetch(cipcFile.uri);
                const blob = await response.blob();
                const ext = cipcFile.name.split('.').pop() || 'pdf';
                const storageRef = ref(storage, `cipc_docs/${user.uid}/registration_${Date.now()}.${ext}`);

                updateData.cipcDocumentUrl = await uploadWithProgress(
                    storageRef, blob,
                    { contentType: cipcFile.mimeType || 'application/pdf' },
                    'cipc'
                );
            }

            // Handle Professional Credential Upload
            if (credentialFile && mapping) {
                const response = await fetch(credentialFile.uri);
                const blob = await response.blob();
                const ext = credentialFile.name.split('.').pop() || 'pdf';
                const storageRef = ref(storage, `credentials/${user.uid}/proof_${Date.now()}.${ext}`);

                updateData[mapping.docField] = await uploadWithProgress(
                    storageRef, blob,
                    { contentType: credentialFile.mimeType || 'application/pdf' },
                    'credential'
                );
            }

            // Security: Always use user.uid from the Auth state, never from a prop or URL
            const docRef = doc(db, "professionals", user.uid);
            await updateDoc(docRef, updateData);

            // Refresh local profile state
            setProfile((prev: any) => ({ ...prev, ...updateData }));
            setLogoUri(logoUrl);
            setCipcFile(null);
            setCredentialFile(null);

            Alert.alert("Success", "Profile updated successfully!");
            setUploadProgress({});
        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Could not update profile. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddCert = () => {
        if (newCertInput.trim()) {
            setFormData(prev => ({
                ...prev,
                additionalCerts: [...prev.additionalCerts, {
                    name: newCertInput.trim(),
                    file: newCertFile || undefined
                }]
            }));
            setNewCertInput('');
            setNewCertFile(null);
        }
    };

    const handleRemoveCert = (indexToRemove: number) => {
        setFormData(prev => ({
            ...prev,
            additionalCerts: prev.additionalCerts.filter((_, index) => index !== indexToRemove)
        }));
    };

    const ProgressBar = ({ progress }: { progress?: number }) => {
        if (progress === undefined || progress <= 0 || progress >= 100) return null;
        return (
            <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
        );
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

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Additional Certifications</Text>
                            <Text style={styles.helperText}>Showcase other qualifications to stand out.</Text>

                            {formData.additionalCerts.map((cert, index) => {
                                const isObject = typeof cert !== 'string';
                                const certData = cert as any;
                                const name = isObject ? certData.name : cert;
                                const url = isObject ? certData.url : null;
                                const localFile = isObject ? certData.file : null;
                                const progress = uploadProgress[`cert_${index}`];

                                return (
                                    <View key={index} style={[styles.certItem, progress > 0 && { paddingBottom: 15 }]}>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Text style={styles.certText} numberOfLines={1}>
                                                {localFile ? `✓ ${name} (Pending Save)` : name}
                                            </Text>
                                            {isObject && url && (
                                                <TouchableOpacity
                                                    onPress={() => WebBrowser.openBrowserAsync(url)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="eye-outline" size={18} color={THEME.gold} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <ProgressBar progress={progress} />
                                        <TouchableOpacity onPress={() => handleRemoveCert(index)}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginRight: 10 }]}
                                    placeholder="e.g. Certified Welder"
                                    value={newCertInput}
                                    onChangeText={setNewCertInput}
                                />
                                <TouchableOpacity
                                    style={[styles.editButton, { paddingVertical: 12, paddingHorizontal: 15 }]}
                                    onPress={handleAddCert}
                                >
                                    <Text style={styles.editButtonText}>ADD</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.readOnlyGroup}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.readOnlyInput}>
                                <Text style={styles.readOnlyText}>{profile?.category || "Not set"}</Text>
                                <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                            </View>
                            <Text style={styles.helperText}>Contact support to change category.</Text>
                        </View>

                        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 20 }}>
                            <Text style={[styles.label, { color: THEME.gold, fontSize: 14, marginBottom: 15 }]}>Business Documents</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CIPC Registration Number</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 2024/123456/07"
                                    placeholderTextColor="#999"
                                    value={cipcRegNumber}
                                    onChangeText={setCipcRegNumber}
                                />
                                <ProgressBar progress={uploadProgress['cipc']} />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.readOnlyInput, { flex: 1 }, cipcFile && { borderColor: THEME.gold, borderWidth: 1 }]}
                                        onPress={async () => {
                                            const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                            if (!result.canceled) setCipcFile(result.assets[0]);
                                        }}
                                    >
                                        <Text style={[styles.readOnlyText, cipcFile && { color: THEME.white }]} numberOfLines={1}>
                                            {cipcFile ? `✓ Attached: ${cipcFile.name}` : (profile?.cipcDocumentUrl ? "Update CIPC Document" : "Upload CIPC Document")}
                                        </Text>
                                        <Ionicons name="document-attach" size={20} color={cipcFile ? THEME.gold : "#9CA3AF"} />
                                    </TouchableOpacity>

                                    {profile?.cipcDocumentUrl && !cipcFile && (
                                        <TouchableOpacity
                                            style={styles.previewButton}
                                            onPress={() => WebBrowser.openBrowserAsync(profile.cipcDocumentUrl)}
                                        >
                                            <Ionicons name="eye-outline" size={24} color={THEME.gold} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>

                        {profile?.cipcVerified && (
                            <Text style={{ color: '#10B981', fontWeight: 'bold', marginTop: -5, marginLeft: 5 }}>✓ CIPC Verified: {profile.cipcEnterpriseName}</Text>
                        )}

                        <View style={styles.inputGroup}>
                            {(() => {
                                const mapping = profile ? resolveCredentialMapping(profile.category) : null;
                                if (mapping) {
                                    return (
                                        <View style={{ gap: 8 }}>
                                            <Text style={styles.label}>{mapping.label}</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={formData.credentialNumber}
                                                onChangeText={(t) => setFormData({ ...formData, credentialNumber: t })}
                                                placeholder={`${mapping.label} Number`}
                                            />
                                            <ProgressBar progress={uploadProgress['credential']} />
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity
                                                    style={[styles.readOnlyInput, { flex: 1 }, credentialFile && { borderColor: THEME.gold, borderWidth: 1 }]}
                                                    onPress={async () => {
                                                        const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                                        if (!result.canceled) setCredentialFile(result.assets[0]);
                                                    }}
                                                >
                                                    <Text style={[styles.readOnlyText, credentialFile && { color: THEME.white }]} numberOfLines={1}>
                                                        {credentialFile ? `✓ Attached: ${credentialFile.name}` : (profile?.[mapping.docField] ? `Update ${mapping.label}` : `Upload ${mapping.label}`)}
                                                    </Text>
                                                    <Ionicons name="ribbon" size={20} color={credentialFile ? THEME.gold : "#9CA3AF"} />
                                                </TouchableOpacity>

                                                {profile?.[mapping.docField] && !credentialFile && (
                                                    <TouchableOpacity
                                                        style={styles.previewButton}
                                                        onPress={() => WebBrowser.openBrowserAsync(profile[mapping.docField])}
                                                    >
                                                        <Ionicons name="eye-outline" size={24} color={THEME.gold} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                }
                                return null;
                            })()}
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
    previewButton: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    helperText: { color: '#9CA3AF', fontSize: 10, marginLeft: 4 },
    editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: THEME.gold, padding: 10, borderRadius: 8, alignSelf: 'flex-start', marginTop: -5 },
    editButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 10 },
    saveButton: { backgroundColor: THEME.gold, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    certItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, width: '100%', position: 'absolute', bottom: 0, left: 12 },
    progressBar: { height: '100%', backgroundColor: THEME.gold, borderRadius: 2 },
    certText: {
        color: THEME.white,
        fontSize: 14,
    },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,31,63,0.9)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: THEME.white, borderRadius: 20, padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 },
    modalItemText: { fontSize: 16, color: THEME.navy, fontWeight: '600' },
});