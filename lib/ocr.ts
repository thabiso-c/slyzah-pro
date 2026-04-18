import * as FileSystem from 'expo-file-system';

// --- OCR API Configurations ---

// PRIMARY: OCR.space API (Free alternative)
// Get a free key at https://ocr.space/ocrapi/freekey to avoid 'helloworld' rate limits.
const OCR_SPACE_API_KEY = process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || "helloworld";
const OCR_SPACE_API_URL = "https://api.ocr.space/parse/image";

// FALLBACK: API Ninjas - Get your free key from https://api-ninjas.com/
const API_NINJAS_API_KEY = process.env.EXPO_PUBLIC_API_NINJAS_API_KEY;
const API_NINJAS_API_URL = "https://api.api-ninjas.com/v1/imagetotext";

// Patterns for different credential types
const CREDENTIAL_PATTERNS: Record<string, RegExp> = {
    "PIRB / CoCT Reg": /\b(\d{4,6}\/\d{2}|\d{3}\s\d{4}\/\d{2}|\d{5,15})\b/, // Matches PIRB or CoCT numeric ID
    "Wireman's License": /\b(IE\s?\d{4,}|[A-Z]{1,2}\d{4,})\b/i, // Dept of Labour often IE prefix
    "RMI Member": /\b(\d{4,8})\b/,
    "NHBRC Reg": /\b(\d{5,10})\b/,
    "SAQCC Gas": /\b(\d{4,8})\b/,
    "PSiRA Reg": /\b(\d{5,10})\b/,
    "SARACCA": /\b(\d{4,8})\b/,
    // Fallback pattern for unknown types: looks for 4-15 alphanumeric chars that look like an ID
    "default": /\b([A-Z0-9-]{4,15})\b/i
};

const extractTextWithOcrSpace = async (file: any): Promise<string> => {
    try {
        if (!file || !file.uri) throw new Error("Invalid file");

        // Read the file as Base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: 'base64',
        });

        // Detect mime type or default to jpeg (OCR.space supports PDF/Image via base64)
        const mimeType = file.mimeType || (file.uri.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const dataUri = `data:${mimeType};base64,${base64}`;

        const formData = new FormData();
        formData.append("base64Image", dataUri);
        formData.append("apikey", OCR_SPACE_API_KEY);
        formData.append("language", "eng");
        formData.append("isOverlayRequired", "false");
        formData.append("OCREngine", "2"); // Engine 2 is often better for text documents

        const response = await fetch(OCR_SPACE_API_URL, {
            method: "POST",
            body: formData
        });

        const json = await response.json();

        if (json.IsErroredOnProcessing) {
            console.warn("OCR Space Error:", json.ErrorMessage);
            return "";
        }

        if (json.ParsedResults && Array.isArray(json.ParsedResults)) {
            return json.ParsedResults.map((r: any) => r.ParsedText).join('\n');
        }

        return "";
    } catch (error: any) {
        console.error("OCR.space Extraction Error:", error);
        return "";
    }
};

const extractTextWithApiNinjas = async (file: any): Promise<string> => {
    if (!API_NINJAS_API_KEY) {
        console.warn("API Ninjas OCR is not configured. Skipping fallback.");
        return "";
    }

    try {
        const formData = new FormData();
        // The type assertion is needed because React Native's FormData typing for fetch is slightly different
        formData.append('image', {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'image/jpeg',
        } as any);

        const response = await fetch(API_NINJAS_API_URL, {
            method: 'POST',
            headers: {
                'X-Api-Key': API_NINJAS_API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Ninjas OCR failed with status ${response.status}: ${errorText}`);
        }

        const json = await response.json();
        if (Array.isArray(json)) {
            return json.map((item: any) => item.text).join('\n');
        }
        return "";

    } catch (error) {
        console.error("API Ninjas OCR Extraction Error:", error);
        return "";
    }
};

// Helper to extract text from file (PDF or Image) with fallback
const extractTextFromDocument = async (file: any, stopRegex?: RegExp): Promise<string> => {
    // Primary: OCR.space
    let text = await extractTextWithOcrSpace(file);

    // Fallback: API-Ninjas if primary fails or returns no text
    if (!text) {
        console.log("OCR.space failed or returned empty, falling back to API Ninjas OCR...");
        text = await extractTextWithApiNinjas(file);
    }

    return text;
};

export const verifyCIPCDocument = async (file: any) => {
    try {
        // World-class robust regex: Captures parts separately to ignore OCR separator errors
        // Matches years 1900-2099 followed by 6 digits and then 2 digits.
        const regExp = /\b((?:19|20)\d{2})[\s\/\-\|\\\.]*(\d{6})[\s\/\-\|\\\.]*(\d{2})\b/;

        const text = await extractTextFromDocument(file, regExp);
        const registrationNumber = text.match(regExp);

        // Enhanced Enterprise Name Regex:
        // Captures text immediately following the label, supporting values on the same line or the next line.
        // Added "Registration Name" as a fallback label found in some document variants.
        const enterpriseNameMatch = text.match(/(?:Enterprise Name|Name of Enterprise|Registration Name)[\s.:]*\n?\s*([A-Z0-9 .&()-]+)/i);

        let vendorName = enterpriseNameMatch ? enterpriseNameMatch[1].trim() : null;
        if (vendorName && vendorName.length < 3) vendorName = null;

        // Reconstruction logic: Rebuild the number from captured parts to ensure correct formatting
        // even if the OCR read "2023 | 123456 | 07" or "202312345607"
        let cleanedReg = null;
        if (registrationNumber) {
            const [_, year, serial, suffix] = registrationNumber;
            cleanedReg = `${year}/${serial}/${suffix}`;
        }

        return {
            registrationNumber: cleanedReg,
            vendorName: vendorName,
            rawText: text
        };
    } catch (error: any) {
        console.error("CIPC OCR Verification Error:", error);
        // Safe error message extraction
        const errorMessage = error?.message || (typeof error === 'string' ? error : "Unknown error during OCR");

        return {
            registrationNumber: null,
            vendorName: null,
            error: errorMessage
        };
    }
};

export const verifyCredentialDocument = async (file: any, label: string) => {
    try {
        const pattern = CREDENTIAL_PATTERNS[label] || CREDENTIAL_PATTERNS["default"];
        const text = await extractTextFromDocument(file, pattern);

        const match = text.match(pattern);

        let designation = null;
        if (label === "PIRB / CoCT Reg") {
            const desMatch = text.match(/(?:Designation)[\s.:]+([A-Za-z\s]+)(?:\n|$)/i);
            if (desMatch) designation = desMatch[1].trim();
        }

        return {
            number: match ? match[1] || match[0] : null,
            designation,
            rawText: text
        };
    } catch (error: any) {
        console.error("Credential OCR Error:", error);
        return { number: null, error: error?.message || "Scan failed" };
    }
};

export const identifyAdditionalCert = async (file: any) => {
    try {
        const rawText = await extractTextFromDocument(file);
        // Flatten text to single line for easier regex matching
        const text = rawText.replace(/\s+/g, ' ').trim();
        const textLower = text.toLowerCase();

        const heuristics = [
            {
                label: "Tax Clearance",
                keywords: ["tax clearance", "sars", "revenue service", "tax compliance"],
                pattern: /(?:Reference|Clearance|Certificate|No)[\s.:-]*(\d{10,})/i
            },
            {
                label: "BEE Certificate",
                keywords: ["b-bbee", "broad-based", "bee level", "bee status", "sanas"],
                pattern: /(?:Certificate|Ref|No)[\s.:-]*([A-Z0-9\-\/]{6,})/i
            },
            {
                label: "COIDA / Good Standing",
                keywords: ["compensation fund", "coida", "good standing", "letter of good standing"],
                pattern: /(?:Ref|Reg|Enq|No)[\s.:-]*(\d{10,})/i
            },
            {
                label: "IOPSA Membership",
                keywords: ["institute of plumbing", "iopsa"],
                pattern: /(?:Member|Reg)[\s.:-]*(\d{4,})/i
            },
            {
                label: "NHBRC",
                keywords: ["nhbrc", "home builders"],
                pattern: /(?:Registration|Reg|Cert)[\s.:-]*(\d{5,})/i
            },
            {
                label: "PIRB",
                keywords: ["PIRB", "Plumbing Industry"],
                pattern: /\b(\d{4,6}\/\d{2})\b/
            }
        ];

        let identifiedType: string | null = null;
        let identifiedNumber: string | null = null;

        for (const h of heuristics) {
            if (h.keywords.some(k => textLower.includes(k))) {
                if (!identifiedType) identifiedType = h.label;
                const match = text.match(h.pattern);
                if (match) {
                    identifiedNumber = match[1];
                    identifiedType = h.label; // Confirm specific type match
                    break;
                }
            }
        }

        if (!identifiedNumber) {
            // Fallback: look for generic registration patterns if no specific type is found
            const genericMatch = text.match(/(?:Registration|Certificate|Ref)[\s.:-]*No[\s.:-]*([A-Z0-9\-\/]{5,})/i);
            if (genericMatch) {
                identifiedNumber = genericMatch[1];
                if (!identifiedType) identifiedType = "Certificate";
            }
        }

        return { type: identifiedType, number: identifiedNumber, rawText: text };
    } catch (error: any) {
        console.error("Additional Cert OCR Error:", error);
        return { type: null, number: null, error: error?.message || "Scan failed" };
    }
};
