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
import { getTierLimits } from '../lib/tiers';
// OCR imports removed to scrap auto-scan

const THEME = {
    navy: '#000046',
    gold: '#D5AD36',
    navy800: '#000046',
    gold400: '#D5AD36',
    surface: '#1A1A2E',
    white: '#FFFFFF',
    gray: '#F3F4F6',
    purple: '#A855F7',
    border: '#E5E7EB'
};

import { CREDENTIAL_MAPPING, resolveCredentialMapping, SUGGESTED_CREDENTIALS, LOCATION_MAPPING, CATEGORIES } from ‘../lib/constants’;

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


export default function VendorRegister() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [provinces, setProvinces] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [regNumber, setRegNumber] = useState('');
    const [isUploadingCIPC, setIsUploadingCIPC] = useState(false);
    const [cipcVerified, setCipcVerified] = useState(false);
    const [cipcFile, setCipcFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [credentialFile, setCredentialFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [credentialVerified, setCredentialVerified] = useState(false);
    const [isVerifyingCredential, setIsVerifyingCredential] = useState(false);
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [isIndependentContractor, setIsIndependentContractor] = useState(false);
    const [additionalCerts, setAdditionalCerts] = useState<{ id: string; name: string; file: DocumentPicker.DocumentPickerAsset | null; url: string | null; isCustom: boolean }[]>([]);

    const [importReputation, setImportReputation] = useState(false);
    const [reputationSource, setReputationSource] = useState('Google');
    const [reputationUrl, setReputationUrl] = useState('');
    const [reputationRating, setReputationRating] = useState('4.8');
    const [reputationReviewCount, setReputationReviewCount] = useState('10');


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
    const tierRules = getTierLimits(selectedTierId);
    const credentialMapping = useMemo(() => {
        const effectiveCategory = formData.category === 'Other' ? formData.customCategory : formData.category;
        return resolveCredentialMapping(effectiveCategory);
    }, [formData.category, formData.customCategory]);

    const handleRegister = async () => {
        if (!isIndependentContractor && !regNumber) {
            Alert.alert("Information Required", "Please enter your CIPC business registration number.");
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
                const storageRef = ref(storage, `logos/${uid}/${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            // Upload CIPC doc
            let cipcDocumentUrl = null;
            if (cipcFile && !isIndependentContractor) {
                const response = await fetch(cipcFile.uri);
                const blob = await response.blob();
                const cipcExt = cipcFile.name.split('.').pop() || 'pdf';
                const storageRef = ref(storage, `cipc_docs/${uid}/registration_${Date.now()}.${cipcExt}`);
                const snapshot = await uploadBytes(storageRef, blob, {
                    contentType: cipcFile.mimeType || 'application/pdf'
                });
                cipcDocumentUrl = await getDownloadURL(snapshot.ref);
            }

            // Upload Additional Certs
            const finalAdditionalCerts = [];
            for (const cert of additionalCerts) {
                if (!cert.name.trim() || !cert.file) continue;
                const response = await fetch(cert.file.uri);
                const blob = await response.blob();
                const certExt = cert.file.name.split('.').pop() || 'pdf';
                const storageRef = ref(storage, `additional_certs/${uid}/cert_${Date.now()}.${certExt}`);
                const snapshot = await uploadBytes(storageRef, blob, {
                    contentType: cert.file.mimeType || 'application/pdf'
                });
                const certUrl = await getDownloadURL(snapshot.ref);
                finalAdditionalCerts.push({ name: cert.name, url: certUrl });
            }

            let credentialDocUrl = null;
            if (credentialFile && credentialMapping) {
                const response = await fetch(credentialFile.uri);
                const blob = await response.blob();
                const credExt = credentialFile.name.split('.').pop() || 'pdf';
                const storageRef = ref(storage, `credentials/${uid}/proof_${Date.now()}.${credExt}`);
                const snapshot = await uploadBytes(storageRef, blob, {
                    contentType: credentialFile.mimeType || 'application/pdf'
                });
                credentialDocUrl = await getDownloadURL(snapshot.ref);
            }

            // 2. Construct Vendor Profile Data
            const initialRating = importReputation ? parseFloat(reputationRating) || 4.8 : 4.8;
            const initialReviewCount = importReputation ? parseInt(reputationReviewCount, 10) || 0 : 1;

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
                isIndependentContractor: isIndependentContractor,
                createdAt: serverTimestamp(),
                logo: logoUrl,
                rating: initialRating,
                reviews: initialReviewCount,
                reviewCount: initialReviewCount,
                reputationImported: importReputation,
                reputationSource: importReputation ? reputationSource : null,
                reputationUrl: importReputation ? reputationUrl : null,
                reputationRating: importReputation ? parseFloat(reputationRating) || 4.8 : null,
                reputationReviewCount: importReputation ? parseInt(reputationReviewCount, 10) || 0 : null,
            };

            // Add CIPC data
            if (!isIndependentContractor) {
                vendorData.cipcRegistrationNumber = regNumber;
                vendorData.cipcVerified = cipcVerified;
                vendorData.cipcDocumentUrl = cipcDocumentUrl;
                vendorData.cipcVerifiedAt = cipcVerified ? serverTimestamp() : null;
            } else {
                vendorData.cipcRegistrationNumber = null;
                vendorData.cipcVerified = false;
                vendorData.cipcDocumentUrl = null;
            }
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

            // Create appropriate initial review record
            if (!importReputation) {
                const reviewId = `welcome_${uid}`;
                await setDoc(doc(db, "reviews", reviewId), {
                    vendorId: uid,
                    userId: "slyzah_team",
                    userName: "Slyzah Verification",
                    rating: 5.0,
                    comment: "Verified profile with active service capability. Welcome to Slyzah!",
                    createdAt: serverTimestamp(),
                });
            } else if (importReputation && initialReviewCount > 0) {
                const reviewId = `imported_${uid}`;
                await setDoc(doc(db, "reviews", reviewId), {
                    vendorId: uid,
                    userId: "external_reputation",
                    userName: `${reputationSource || "External Platform"} Reviews`,
                    rating: parseFloat(reputationRating) || 4.8,
                    comment: `Imported reputation summary: This business has an outstanding track record of ${reputationReviewCount} reviews with an average rating of ${reputationRating} on ${reputationSource || "their Google/Facebook profile"}.`,
                    createdAt: serverTimestamp(),
                    isImported: true,
                    sourceUrl: reputationUrl || null
                });
            }

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

    const processCIPCFile = (file: DocumentPicker.DocumentPickerAsset) => {
        try {
            setCipcFile(file);
            // We mark as "verified" locally just to show the UI checkmark, 
            // actual verification happens via manual admin review of the uploaded doc.
            setCipcVerified(true);
            Alert.alert("Document Attached", `${file.name} has been added to your application.`);
        } catch (error: any) {
            Alert.alert("Error", "Could not attach file.");
            setCipcVerified(false);
            setCipcFile(null);
        }
    };

    const processCredentialFile = (file: DocumentPicker.DocumentPickerAsset, label: string) => {
        setIsVerifyingCredential(true);
        try {
            setCredentialFile(file);
            setCredentialVerified(true); // Flag for admin that proof is attached
            Alert.alert("Document Attached", `${label} proof has been added.`);
        } catch (error: any) {
            Alert.alert("Error", "Could not attach file.");
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
        Alert.alert("File Attached", `Certification proof added.`);
    };

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
                            <Text style={styles.label}>Independent Contractor Status</Text>
                            <Text style={styles.helperText}>Are you an independent contractor / sole proprietor?</Text>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    isIndependentContractor && { backgroundColor: THEME.gold, borderColor: THEME.gold }
                                ]}
                                onPress={() => {
                                    setIsIndependentContractor(!isIndependentContractor);
                                    if (!isIndependentContractor) {
                                        setRegNumber('');
                                        setCipcVerified(false);
                                        setCipcFile(null);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    isIndependentContractor ? { color: THEME.navy, fontWeight: '900' } : { color: '#6B7280' }
                                ]}>
                                    {isIndependentContractor ? "YES, I AM A SOLE PROPRIETOR" : "NO, I HAVE REGISTERED BUSINESS DOCS"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {!isIndependentContractor && (
                            <View style={styles.verificationCard}>
                                <Text style={styles.label}>CIPC Registration (Required)</Text>
                                <Text style={styles.helperText}>Enter your registration number and upload the document for verification.</Text>
                                <View style={{ gap: 10, marginTop: 10 }}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Registration Number (e.g. 2024/123456/07)"
                                        placeholderTextColor="#999"
                                        value={regNumber}
                                        onChangeText={setRegNumber}
                                    />
                                    <TouchableOpacity style={[styles.fileButton, cipcVerified && styles.verifiedFileButton]} onPress={async () => {
                                        const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"] });
                                        if (result.canceled === false) processCIPCFile(result.assets[0]);
                                    }} disabled={isUploadingCIPC} activeOpacity={0.7}>
                                        {isUploadingCIPC
                                            ? <ActivityIndicator color={THEME.navy} />
                                            : <Text style={[styles.fileButtonText, cipcVerified && { color: '#15803d' }]}>{cipcVerified ? `✓ Attached: ${cipcFile?.name}` : "Upload CIPC Document"}</Text>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <Text style={styles.label}>Trading Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Your Business Name"
                            value={formData.businessName}
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
                                        : <Text style={[styles.fileButtonText, credentialFile && { color: '#15803d' }]}>{credentialFile ? `✓ Attached: ${credentialFile.name}` : "Upload Document"}</Text>
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
                                                }} activeOpacity={0.7}>
                                                    <Text style={[styles.fileButtonText, cert.file && { color: '#15803d' }]}>{cert.file ? `✓ ${cert.file.name}` : "Upload Proof"}</Text>
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

                        {/* REPUTATION & REVIEWS IMPORT (MOBILE UX) */}
                        <View style={[styles.verificationCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7', marginTop: 15, padding: 15, borderRadius: 16, borderWidth: 1 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Text style={{ fontSize: 18 }}>🌟</Text>
                                <Text style={[styles.credentialTitle, { color: '#B45309' }]}>Reputation & Reviews Import</Text>
                            </View>
                            <Text style={styles.helperText}>
                                Bring your existing rating and reviews from other platforms to get an immediate results sorting boost!
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    importReputation && { backgroundColor: THEME.gold, borderColor: THEME.gold },
                                    { marginTop: 10 }
                                ]}
                                onPress={() => setImportReputation(!importReputation)}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    importReputation ? { color: THEME.navy, fontWeight: '900' } : { color: '#6B7280' }
                                ]}>
                                    {importReputation ? "✓ YES, IMPORT REPUTATION" : "NO, START FRESH"}
                                </Text>
                            </TouchableOpacity>

                            {importReputation && (
                                <View style={{ gap: 10, marginTop: 15 }}>
                                    <Text style={styles.label}>Reputation Source</Text>
                                    <RNPickerSelect
                                        onValueChange={(val) => setReputationSource(val || 'Google')}
                                        items={[
                                            { label: 'Google Business Profile', value: 'Google' },
                                            { label: 'Facebook Page', value: 'Facebook' },
                                            { label: 'Yelp', value: 'Yelp' },
                                            { label: 'HelloPeter', value: 'HelloPeter' },
                                            { label: 'Other', value: 'Other' },
                                        ]}
                                        style={pickerSelectStyles}
                                        value={reputationSource}
                                        placeholder={{ label: "Select Source...", value: null }}
                                        useNativeAndroidPickerStyle={false}
                                        Icon={() => <Ionicons name="chevron-down" size={20} color="gray" />}
                                    />

                                    <Text style={styles.label}>Profile / Proof URL</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="https://g.co/kgs/... or Facebook URL"
                                        placeholderTextColor="#999"
                                        value={reputationUrl}
                                        onChangeText={setReputationUrl}
                                    />

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Rating (1.0 - 5.0)</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. 4.8"
                                                placeholderTextColor="#999"
                                                keyboardType="numeric"
                                                value={reputationRating}
                                                onChangeText={setReputationRating}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Reviews Count</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. 15"
                                                placeholderTextColor="#999"
                                                keyboardType="numeric"
                                                value={reputationReviewCount}
                                                onChangeText={setReputationReviewCount}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {!importReputation && (
                                <View style={{ marginTop: 10, padding: 10, backgroundColor: '#FEF3C7', borderRadius: 10 }}>
                                    <Text style={{ fontSize: 10, color: '#B45309', fontWeight: 'bold', lineHeight: 14 }}>
                                        ⭐ Slyzah Registration Incentive: If you don't import reputation, you will start with a stellar rating of 4.8 / 5.0 and a welcome review to give you an immediate competitive advantage!
                                    </Text>
                                </View>
                            )}
                        </View>
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
    toggleButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 15,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        marginTop: 10,
    },
    toggleButtonText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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