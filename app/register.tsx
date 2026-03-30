import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { auth, db, storage } from '../lib/firebaseConfig';
import { identifyAdditionalCert, verifyCIPCDocument, verifyCredentialDocument } from '../lib/ocr';

const THEME = {
    navy: '#001f3f',
    gold: '#FFD700',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    purple: '#A855F7',
    border: '#E5E7EB'
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
    "Cybersecurity": { label: "IT Security Cert", field: "itSecurityCertNumber", docField: "itSecurityCertUrl" },
    "Accountant": { label: "SAIPA / SARS No.", field: "saipaNumber", docField: "saipaUrl" },
    "Childcare": { label: "First Aid / Background Check", field: "childcareCertNumber", docField: "childcareCertUrl" }
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
        "handy": "Handyman",
        "ev": "Solar / EV",
        "cyber": "Cybersecurity",
        "account": "Accountant",
        "tax": "Accountant",
        "child": "Childcare",
        "baby": "Childcare",
        "nanny": "Childcare"
    };

    for (const [keyword, mapKey] of Object.entries(keywords)) {
        if (normalized.includes(keyword)) {
            return CREDENTIAL_MAPPING[mapKey];
        }
    }

    return null;
};

const SUGGESTED_CREDENTIALS = [
    "IOPSA Membership",
    "BEE Level 2 Certificate",
    "Tax Clearance Certificate",
    "Liability Insurance",
    "OHS Act Compliance",
    "Workman’s Compensation (COIDA)",
    "BIBC Registration",
    "World Plumbing Council Affiliation",
    "First Aid Level 1 Certificate",
    "N.S.R.I Member",
    "SEESA & NEASA Registered",
    "Institute of Plumbing Member",
    "NuFlow Potable License",
    "Solar Water Heating Installation",
    "Heat Pump Installer"
];

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

const CATEGORIES = [
    { label: "Electrician", value: "Electrician" },
    { label: "Plumber", value: "Plumber" },
    { label: "Handyman", value: "Handyman" },
    { label: "Solar/Power", value: "Solar/Power" },
    { label: "Locksmith", value: "Locksmith" },
    { label: "Cleaning", value: "Cleaning" },
    { label: "Automotive", value: "Automotive" },
    { label: "Panel Beater", value: "Panel Beater" },
    { label: "Builder", value: "Builder" },
    { label: "Carpenter", value: "Carpenter" },
    { label: "Gas", value: "Gas" },
    { label: "Air Conditioning", value: "Air Conditioning" },
    { label: "CCTV & Security", value: "CCTV & Security" },
    { label: "Pest Control", value: "Pest Control" },
    { label: "Appliance Repairs", value: "Appliance Repairs" },
    { label: "Roofing", value: "Roofing" },
    { label: "Gate Motors", value: "Gate Motors" },
    { label: "Solar / EV", value: "Solar / EV" },
    { label: "Cybersecurity", value: "Cybersecurity" },
    { label: "Accountant", value: "Accountant" },
    { label: "Childcare", value: "Childcare" },
    { label: "Other", value: "Other" },
];

export default function VendorRegister() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [provinces, setProvinces] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [regNumber, setRegNumber] = useState('');
    const [isVerifyingCIPC, setIsVerifyingCIPC] = useState(false);
    const [cipcVerified, setCipcVerified] = useState(false);
    const [cipcFile, setCipcFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [credentialFile, setCredentialFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [credentialVerified, setCredentialVerified] = useState(false);
    const [isVerifyingCredential, setIsVerifyingCredential] = useState(false);
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [additionalCerts, setAdditionalCerts] = useState<{ id: string; name: string; file: DocumentPicker.DocumentPickerAsset | null; url: string | null; isCustom: boolean }[]>([]);
    const [verifyingCertId, setVerifyingCertId] = useState<string | null>(null);


    const [formData, setFormData] = useState({
        businessName: '',
        email: '',
        phone: '',
        category: '',
        customCategory: '',
        credentialNumber: '',
        description: '',
        password: '',
        confirmPassword: '',
        website: '',
    });

    const selectedTierId = (params.tier as string) || 'basic';
    const tierRules = TIER_LIMITS[selectedTierId] || TIER_LIMITS['basic'];
    const credentialMapping = useMemo(() => {
        const effectiveCategory = formData.category === 'Other' ? formData.customCategory : formData.category;
        return resolveCredentialMapping(effectiveCategory);
    }, [formData.category, formData.customCategory]);

    const handleRegister = async () => {
        if (!cipcVerified || !regNumber) {
            Alert.alert("Verification Required", "Please upload and verify your CIPC document before proceeding.");
            return;
        }

        const effectiveCategory = formData.category === 'Other' ? formData.customCategory : formData.category;
        if (!formData.businessName || !formData.email || !formData.password || !effectiveCategory || provinces.length === 0 || regions.length === 0) {
            Alert.alert("Missing Fields", "Please fill in all the required fields.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            Alert.alert("Password Error", "Passwords do not match.");
            return;
        }

        if (formData.website) {
            if (!formData.website.startsWith('http') || !formData.website.includes('.')) {
                Alert.alert("Invalid URL", "Please enter a valid website URL (e.g., https://your-site.com)");
                return;
            }
        }

        const mapping = resolveCredentialMapping(effectiveCategory);
        if (mapping && (!formData.credentialNumber || formData.credentialNumber.length < 3)) {
            Alert.alert("Credential Error", `Please enter a valid ${mapping.label} Number.`);
            return;
        }

        setLoading(true);
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const { uid } = userCredential.user;

            // Upload Logo if exists
            let logoUrl = null;
            if (logoUri) {
                const response = await fetch(logoUri);
                const blob = await response.blob();
                const storageRef = ref(storage, `logos/${uid}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, blob);
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            // Upload CIPC doc
            let cipcDocumentUrl = null;
            if (cipcFile) {
                const response = await fetch(cipcFile.uri);
                const blob = await response.blob();
                const storageRef = ref(storage, `cipc_docs/${uid}_${cipcFile.name}`);
                const snapshot = await uploadBytes(storageRef, blob);
                cipcDocumentUrl = await getDownloadURL(snapshot.ref);
            }

            // Upload Additional Certs
            const finalAdditionalCerts = [];
            for (const cert of additionalCerts) {
                if (!cert.name.trim() || !cert.file) continue;
                const response = await fetch(cert.file.uri);
                const blob = await response.blob();
                const storageRef = ref(storage, `additional_certs/${uid}/${Date.now()}_${cert.file.name}`);
                const snapshot = await uploadBytes(storageRef, blob);
                const certUrl = await getDownloadURL(snapshot.ref);
                finalAdditionalCerts.push({ name: cert.name, url: certUrl });
            }

            let credentialDocUrl = null;
            if (credentialFile && mapping) {
                const response = await fetch(credentialFile.uri);
                const blob = await response.blob();
                const storageRef = ref(storage, `credentials/${uid}/${mapping.field}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, blob);
                credentialDocUrl = await getDownloadURL(snapshot.ref);
            }

            // 2. Construct Vendor Profile Data
            const vendorData: any = {
                uid: uid,
                name: formData.businessName,
                email: formData.email,
                phone: formData.phone,
                website: formData.website,
                category: effectiveCategory,
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
            };

            // Add CIPC data
            vendorData.cipcRegistrationNumber = regNumber;
            vendorData.cipcVerified = cipcVerified;
            vendorData.cipcDocumentUrl = cipcDocumentUrl;
            vendorData.additionalCertifications = finalAdditionalCerts;

            // Add credential data if applicable
            if (credentialMapping && formData.credentialNumber) {
                vendorData[credentialMapping.field] = formData.credentialNumber;
                if (credentialDocUrl) {
                    vendorData[credentialMapping.docField] = credentialDocUrl;
                }
                vendorData.credentialVerified = credentialVerified;
            }

            // 3. Create Vendor Profile in Firestore
            await setDoc(doc(db, "professionals", uid), vendorData);

            // 4. Create User Profile (for login tracking)
            await setDoc(doc(db, "users", uid), {
                email: formData.email,
                role: 'vendor',
                hasAcceptedTerms: false
            });

            await sendEmailVerification(userCredential.user);

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

    const processCIPCFile = async (file: DocumentPicker.DocumentPickerAsset) => {
        setIsVerifyingCIPC(true);
        try {
            // NOTE: The OCR function needs a native implementation. This is a placeholder call.
            const result = await verifyCIPCDocument(file);

            if (result.registrationNumber) {
                setRegNumber(result.registrationNumber);
                if (result.vendorName) {
                    setFormData(prev => ({ ...prev, businessName: result.vendorName as string }));
                }
                setCipcVerified(true);
                setCipcFile(file);
                Alert.alert("Success", `Successfully scanned: ${result.registrationNumber}`);
            } else {
                throw new Error(result.error || "Could not find a valid Registration Number.");
            }
        } catch (error: any) {
            Alert.alert("Verification Failed", error.message || "Scan failed. Please upload a clear CIPC document.");
            setCipcVerified(false);
            setCipcFile(null);
        } finally {
            setIsVerifyingCIPC(false);
        }
    };

    const processCredentialFile = async (file: DocumentPicker.DocumentPickerAsset, label: string) => {
        setIsVerifyingCredential(true);
        try {
            const result = await verifyCredentialDocument(file, label);
            if (result.number) {
                setFormData(prev => ({ ...prev, credentialNumber: result.number || '' }));
                setCredentialVerified(true);
                setCredentialFile(file);
                Alert.alert("Success", `Successfully scanned ${label}: ${result.number}`);
            } else {
                throw new Error(result.error || `Could not find a valid ${label} Number.`);
            }
        } catch (error: any) {
            Alert.alert("Verification Failed", error.message || "Scan failed. Please upload a clear document.");
            setCredentialVerified(false);
            setCredentialFile(null);
        } finally {
            setIsVerifyingCredential(false);
        }
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

    const handleProvinceToggle = (p: string) => {
        const isSelected = provinces.includes(p);

        if (!isSelected) {
            if (tierRules.provinces === 1) {
                setProvinces([p]);
                setRegions([]);
            } else {
                if (provinces.length >= tierRules.provinces) {
                    Alert.alert("Limit Reached", `You can only select ${tierRules.provinces} province(s) on this plan.`);
                    return;
                }
                setProvinces([...provinces, p]);
            }
        } else {
            const updatedProvinces = provinces.filter(item => item !== p);
            const updatedRegions = regions.filter(r =>
                updatedProvinces.some(prov => LOCATION_MAPPING[prov].includes(r))
            );
            setProvinces(updatedProvinces);
            setRegions(updatedRegions);
        }
    };

    const handleRegionToggle = (region: string) => {
        if (!regions.includes(region)) {
            if (regions.length >= tierRules.regions) {
                Alert.alert(`Limit Reached`, `Your ${selectedTierId} tier only allows ${tierRules.regions} hubs.`);
                return;
            }
            setRegions([...regions, region]);
        } else {
            setRegions(regions.filter(r => r !== region));
        }
    };

    const handleSelectAllRegions = (province: string) => {
        const regionsInProvince = LOCATION_MAPPING[province] || [];
        const allSelected = regionsInProvince.every(r => regions.includes(r));

        if (allSelected) {
            setRegions(regions.filter(r => !regionsInProvince.includes(r)));
        } else {
            const newRegions = regionsInProvince.filter(r => !regions.includes(r));
            const combined = [...regions, ...newRegions];
            if (combined.length > tierRules.regions) {
                Alert.alert("Limit Exceeded", `Selecting all regions in ${province} would exceed your plan's limit of ${tierRules.regions} hubs.`);
                return;
            }
            setRegions(combined);
        }
    };

    const addCertRow = () => {
        setAdditionalCerts([...additionalCerts, { id: `new_${Date.now()}_${Math.random()}`, name: "", file: null, url: null, isCustom: false }]);
    };

    const removeCertRow = (id: string) => {
        setAdditionalCerts(additionalCerts.filter(c => c.id !== id));
    };

    const handleCertTypeChange = (id: string, value: string) => {
        setAdditionalCerts(prev => prev.map(c => {
            if (c.id === id) {
                if (value === "Other") {
                    return { ...c, isCustom: true, name: "" };
                } else {
                    return { ...c, isCustom: false, name: value };
                }
            }
            return c;
        }));
    };

    const handleCertNameChange = (id: string, name: string) => {
        setAdditionalCerts(additionalCerts.map(c => c.id === id ? { ...c, name } : c));
    };

    const handleCertFileChange = async (id: string, file: DocumentPicker.DocumentPickerAsset) => {
        setAdditionalCerts(prev => prev.map(c => c.id === id ? { ...c, file } : c));

        setVerifyingCertId(id);
        try {
            const result = await identifyAdditionalCert(file);
            if (result.type) {
                const certName = result.number ? `${result.type} - ${result.number}` : result.type;
                setAdditionalCerts(prev => prev.map(c => {
                    if (c.id === id && !c.name) { // Only auto-fill if user hasn't typed a name
                        return { ...c, name: certName, isCustom: !SUGGESTED_CREDENTIALS.includes(result.type!) };
                    }
                    return c;
                }));
                Alert.alert("Document Identified", `Scanned: ${certName}`);
            }
        } finally {
            setVerifyingCertId(null);
        }
    };

    const Section = ({ title, number, children }: { title: string, number: number, children: React.ReactNode }) => (
        <View style={styles.section}>
            <View style={styles.sectionHeaderContainer}>
                <Text style={styles.sectionHeader}>{number}. {title}</Text>
            </View>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={THEME.navy} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Vendor Registration</Text>
                    <Text style={styles.subtitle}>Tier: {selectedTierId.replace('_', ' ').toUpperCase()}</Text>

                    <Section number={1} title="Business Branding">
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
                    </Section>

                    <Section number={2} title="Account Access">
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
                            value={formData.confirmPassword} onChangeText={(t) => setFormData({ ...formData, confirmPassword: t })}
                        />
                    </Section>

                    <Section number={3} title="Service Capabilities">
                        <View style={styles.verificationCard}>
                            <Text style={styles.label}>CIPC Registration (Required)</Text>
                            <Text style={styles.helperText}>Upload your CIPC/BizProfile document. We'll scan it for you.</Text>
                            <View style={{ gap: 10, marginTop: 10 }}>
                                <TextInput
                                    style={[styles.input, styles.disabledInput]}
                                    placeholder="Registration Number (from scan)"
                                    value={regNumber}
                                    editable={false}
                                />
                                <TouchableOpacity style={[styles.fileButton, cipcVerified && styles.verifiedFileButton]} onPress={async () => {
                                    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                    if (result.canceled === false) processCIPCFile(result.assets[0]);
                                }} disabled={isVerifyingCIPC} activeOpacity={0.7}>
                                    {isVerifyingCIPC
                                        ? <ActivityIndicator color={THEME.navy} />
                                        : <Text style={[styles.fileButtonText, cipcVerified && { color: '#15803d' }]}>{cipcVerified ? `✓ Verified: ${cipcFile?.name}` : "Upload CIPC Document"}</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.label}>Trading Name</Text>
                        <TextInput
                            style={[styles.input, cipcVerified && styles.disabledInput]}
                            placeholder="Your Business Name"
                            value={formData.businessName}
                            editable={!cipcVerified}
                            onChangeText={(t) => setFormData({ ...formData, businessName: t })}
                        />

                        <Text style={styles.label}>Primary Category</Text>
                        <RNPickerSelect
                            onValueChange={(value: string) => {
                                if (value) {
                                    setFormData({ ...formData, category: value, customCategory: '' });
                                    setShowCustomCategory(value === 'Other');
                                } else {
                                    setFormData({ ...formData, category: '', customCategory: '' });
                                    setShowCustomCategory(false);
                                }
                            }}
                            items={CATEGORIES}
                            style={pickerSelectStyles}
                            placeholder={{ label: "Choose Industry...", value: null, color: '#999' }}
                            useNativeAndroidPickerStyle={false}
                            Icon={() => {
                                return <Ionicons name="chevron-down" size={20} color="gray" />;
                            }}
                        />

                        {showCustomCategory && (
                            <TextInput style={styles.input} placeholder="Specify your industry" value={formData.customCategory} onChangeText={(t) => setFormData({ ...formData, customCategory: t })} />
                        )}

                        {credentialMapping && (
                            <View style={styles.credentialCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <Text style={{ fontSize: 20 }}>🛡️</Text>
                                    <Text style={styles.credentialTitle}>{credentialMapping.label} Verification</Text>
                                </View>
                                <Text style={styles.label}>{credentialMapping.label} Number</Text>
                                <TextInput style={styles.input} placeholder="Registration Number" value={formData.credentialNumber} onChangeText={(t) => setFormData({ ...formData, credentialNumber: t })} />
                                <Text style={styles.label}>Proof of Registration (Optional)</Text>
                                <TouchableOpacity style={[styles.fileButton, credentialFile && styles.verifiedFileButton]} onPress={async () => {
                                    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                    if (!result.canceled) processCredentialFile(result.assets[0], credentialMapping.label);
                                }} disabled={isVerifyingCredential} activeOpacity={0.7}>
                                    {isVerifyingCredential
                                        ? <ActivityIndicator color={THEME.navy} />
                                        : <Text style={[styles.fileButtonText, credentialFile && { color: '#15803d' }]}>{credentialFile ? `✓ Verified: ${credentialFile.name}` : "Upload Document"}</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={{ marginTop: 20 }}>
                            <View style={[styles.sectionHeaderContainer, { borderBottomColor: '#F3F4F6' }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.sectionHeader}>Additional Certifications</Text>
                                    <TouchableOpacity onPress={addCertRow} style={styles.addButton}>
                                        <Text style={styles.addButtonText}>+ ADD</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {additionalCerts.length === 0 ? (
                                <Text style={styles.helperText}>No additional certifications added.</Text>
                            ) : (
                                <View style={{ gap: 15 }}>
                                    {additionalCerts.map((cert) => (
                                        <View key={cert.id} style={styles.certRow}>
                                            <View style={{ flex: 1, gap: 10 }}>
                                                <RNPickerSelect
                                                    onValueChange={(value) => handleCertTypeChange(cert.id, value)}
                                                    items={[...SUGGESTED_CREDENTIALS.map(s => ({ label: s, value: s })), { label: "Other (Type Manually)", value: "Other" }]}
                                                    style={pickerSelectStyles}
                                                    value={cert.isCustom ? "Other" : cert.name}
                                                    placeholder={{ label: "Select Certificate Type...", value: null }}
                                                    useNativeAndroidPickerStyle={false}
                                                    Icon={() => <Ionicons name="chevron-down" size={20} color="gray" />}
                                                />
                                                {cert.isCustom && (
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Enter Certificate Name"
                                                        value={cert.name}
                                                        onChangeText={(name) => handleCertNameChange(cert.id, name)}
                                                    />
                                                )}
                                                <TouchableOpacity style={[styles.fileButton, cert.file && styles.verifiedFileButton]} onPress={async () => {
                                                    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                                    if (!result.canceled) handleCertFileChange(cert.id, result.assets[0]);
                                                }} disabled={verifyingCertId === cert.id} activeOpacity={0.7}>
                                                    {verifyingCertId === cert.id
                                                        ? <ActivityIndicator color={THEME.navy} />
                                                        : <Text style={[styles.fileButtonText, cert.file && { color: '#15803d' }]}>{cert.file ? `✓ ${cert.file.name}` : "Upload Proof"}</Text>
                                                    }
                                                </TouchableOpacity>
                                            </View>
                                            <TouchableOpacity onPress={() => removeCertRow(cert.id)} style={{ padding: 5, marginLeft: 10 }}>
                                                <Ionicons name="trash-outline" size={20} color="#f87171" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>



                        <Text style={styles.label}>Website URL (Optional)</Text>
                        <TextInput style={styles.input} placeholder="https://yourbusiness.co.za" keyboardType="url" value={formData.website} onChangeText={(t) => setFormData({ ...formData, website: t })} />

                        <Text style={styles.label}>About Your Services</Text>
                        <TextInput style={[styles.input, styles.textArea]} placeholder="Describe your expertise..." multiline value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} />
                    </Section>

                    <Section number={4} title="Coverage Zones">
                        <Text style={styles.label}>Select Provinces:</Text>
                        <View style={styles.provinceGrid}>
                            {Object.keys(LOCATION_MAPPING).map(p => (
                                <TouchableOpacity key={p} onPress={() => handleProvinceToggle(p)} style={[styles.provinceItem, provinces.includes(p) && styles.provinceItemSelected]}>
                                    <Text style={[styles.provinceItemText, provinces.includes(p) && styles.provinceItemTextSelected]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {provinces.length > 0 && (
                            <View style={{ gap: 20, marginTop: 20 }}>
                                {provinces.map(prov => (
                                    <View key={prov}>
                                        <View style={styles.regionHeader}>
                                            <Text style={styles.regionHeaderText}>{prov} Hubs</Text>
                                            {tierRules.regions > 10 && (
                                                <TouchableOpacity onPress={() => handleSelectAllRegions(prov)}>
                                                    <Text style={styles.selectAllText}>
                                                        {(LOCATION_MAPPING[prov] || []).every(r => regions.includes(r)) ? "Deselect All" : "Select All"}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <View style={styles.regionGrid}>
                                            {(LOCATION_MAPPING[prov] || []).map(region => (
                                                <TouchableOpacity key={region} onPress={() => handleRegionToggle(region)} style={[styles.regionItem, regions.includes(region) && styles.regionItemSelected]}>
                                                    <Text style={[styles.regionItemText, regions.includes(region) && styles.regionItemTextSelected]}>{region}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </Section>

                    <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
                        {loading ? <ActivityIndicator color={THEME.navy} /> : <Text style={styles.submitButtonText}>CREATE ACCOUNT</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.white },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 20 },
    backButton: { marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: THEME.navy, marginBottom: 5, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -1 },
    subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 30, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    section: { marginBottom: 40 },
    sectionHeaderContainer: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12, marginBottom: 20 },
    sectionHeader: { fontSize: 18, fontWeight: '900', color: THEME.navy, textTransform: 'uppercase', letterSpacing: -0.5 },
    sectionContent: { gap: 15 },
    label: { color: THEME.navy, fontSize: 10, fontWeight: '900', marginLeft: 5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    input: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, color: THEME.navy, borderWidth: 1, borderColor: '#F3F4F6', fontWeight: '700', fontSize: 14 },
    disabledInput: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
    textArea: { height: 100, textAlignVertical: 'top' },
    verificationCard: { backgroundColor: '#F0F7FF', borderRadius: 24, padding: 20, gap: 5, borderWidth: 1, borderColor: '#DBEAFE' },
    helperText: { color: '#6B7280', fontSize: 11, marginLeft: 5, fontWeight: '600' },
    credentialCard: { backgroundColor: '#F0FDF4', borderRadius: 24, padding: 20, gap: 10, borderWidth: 1, borderColor: '#DCFCE7' },
    credentialTitle: { color: THEME.navy, fontWeight: '900', textTransform: 'uppercase', fontSize: 14 },
    fileButton: { backgroundColor: THEME.white, borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
    fileButtonText: { color: THEME.navy, fontWeight: '800', fontSize: 12 },
    provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    provinceItem: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6' },
    provinceItemSelected: { backgroundColor: THEME.navy, borderColor: THEME.navy },
    provinceItemText: { color: THEME.navy, fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' },
    provinceItemTextSelected: { color: THEME.white },
    regionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 10 },
    regionHeaderText: { color: THEME.navy, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
    selectAllText: { color: '#B8860B', fontWeight: 'bold', fontSize: 10 },
    regionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    regionItem: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    regionItemSelected: { backgroundColor: THEME.gold, borderColor: THEME.gold },
    regionItemText: { color: THEME.navy, fontWeight: '700', fontSize: 10 },
    regionItemTextSelected: { color: THEME.navy },
    submitButton: { backgroundColor: THEME.gold, padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    submitButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    logoContainer: { width: 120, height: 120, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: THEME.gold, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
    logoImage: { width: '100%', height: '100%' },
    logoPlaceholder: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    logoText: { color: '#9CA3AF', fontSize: 10, fontWeight: 'bold', marginTop: 5 },
    verifiedFileButton: { backgroundColor: '#dcfce7' },
    addButton: { backgroundColor: THEME.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    addButtonText: { color: THEME.navy, fontWeight: '900', fontSize: 10 },
    certRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F9FAFB',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
});

const pickerSelectStyles = StyleSheet.create({
    inputIOS: {
        ...styles.input,
    },
    inputAndroid: {
        ...styles.input,
    },
    iconContainer: {
        top: 18,
        right: 15,
    },
});