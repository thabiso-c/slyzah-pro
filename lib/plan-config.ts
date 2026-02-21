export const PLANS = [
    {
        id: "basic",
        name: "Basic",
        price: "free",
        regionalLimit: "three", // 1 Hub only
        features: ["3 Service Region", "Marketplace Access", "Basic Profile"],
        live: true
    },
    {
        id: "one-region",
        name: "One Region",
        price: "R 199",
        regionalLimit: "single", // 1 Hub only
        features: ["1 Service Region", "Priority Listing", "Insights Tab"],
        live: true
    },
    {
        id: "three-regions",
        name: "Three Regions",
        price: "R 399",
        regionalLimit: "three", // 1 Hub only
        features: ["3 Service Region", "Priority Listing", "Insights Tab"],
        live: true
    },
    {
        id: "provincial",
        name: "Provincial",
        price: "R 599",
        regionalLimit: "province", // All Hubs in 1 Province
        features: ["Whole Province", "Analytics", "Unlimited Chat"],
        live: true
    },
    {
        id: "multi-province",
        name: "Multi-Province",
        price: "R 1499",
        regionalLimit: "national", // No limits
        features: ["All Provinces", "Verified Badge", "Direct Support"],
        live: true
    }
];

export const getTierDetails = (tierName: string) => {
    return PLANS.find(p => p.name.toLowerCase() === tierName.toLowerCase()) || PLANS[0];
};

export const getTierBySlug = (slug: string) => {
    return PLANS.find(p => p.id === slug);
};