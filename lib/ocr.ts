import * as FileSystem from 'expo-file-system';

// REPLACE THIS WITH YOUR ACTUAL GOOGLE CLOUD VISION API KEY
const GOOGLE_CLOUD_VISION_API_KEY = "YOUR_GOOGLE_CLOUD_VISION_API_KEY";
const GOOGLE_CLOUD_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`;

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

// Helper to extract text from file (PDF or Image)
const extractTextFromDocument = async (file: any, stopRegex?: RegExp): Promise<string> => {
    try {
        if (!file || !file.uri) throw new Error("Invalid file");

        // Read the file as Base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Construct the request body for Google Cloud Vision
        const body = {
            requests: [
                {
                    image: { content: base64 },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
                }
            ]
        };

    } catch (error) {
        console.error("OCR Extraction Error:", error);
        return "";
    }
};

export const verifyCIPCDocument = async (file: any) => {
    try {
        // Regex for Registration Number: Matches 19xx or 20xx years (e.g., 1904/002186/06)
        const regExp = /\b((?:19|20)\d{2}\/\d{6}\/\d{2})\b/;

        const text = await extractTextFromDocument(file, regExp);
        const registrationNumber = text.match(regExp);

        // Enhanced Enterprise Name Regex:
        // Captures text immediately following the label, supporting values on the same line or the next line.
        const enterpriseNameMatch = text.match(/(?:Enterprise Name|Name of Enterprise)[\s.:]*\n?\s*([A-Z0-9 .&()-]+)/i);

        let vendorName = enterpriseNameMatch ? enterpriseNameMatch[1].trim() : null;
        if (vendorName && vendorName.length < 3) vendorName = null;

        return {
            registrationNumber: registrationNumber ? registrationNumber[0] : null,
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