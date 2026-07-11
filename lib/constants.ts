export const CREDENTIAL_MAPPING: Record<string, { label: string; field: string; docField: string }> = {
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

export const resolveCredentialMapping = (categoryInput: string) => {
    if (!categoryInput) return null;
    if (CREDENTIAL_MAPPING[categoryInput]) return CREDENTIAL_MAPPING[categoryInput];

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

export const SUGGESTED_CREDENTIALS = [
    "IOPSA Membership",
    "BEE Level 2 Certificate",
    "Tax Clearance Certificate",
    "Liability Insurance",
    "OHS Act Compliance",
    "Workman's Compensation (COIDA)",
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

export const LOCATION_MAPPING: Record<string, string[]> = {
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

export const CATEGORIES = [
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
