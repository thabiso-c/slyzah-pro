export type TierType = "Basic" | "One Region" | "Three Regions" | "Provincial" | "Multi-Province";

export const TIER_LIMITS: Record<TierType, { provinces: number; regions: number }> = {
  "Basic": { provinces: 1, regions: 3 },
  "One Region": { provinces: 1, regions: 1 },
  "Three Regions": { provinces: 1, regions: 3 },
  "Provincial": { provinces: 1, regions: Number.MAX_SAFE_INTEGER },
  "Multi-Province": { provinces: Number.MAX_SAFE_INTEGER, regions: Number.MAX_SAFE_INTEGER },
};

export function isTierType(value: string): value is TierType {
  return value in TIER_LIMITS;
}

export function normalizeTierName(tier: string): string {
  if (!tier) return "Basic";
  const lower = tier.toLowerCase().replace(/[-_]/g, " ").trim();
    const map: Record<string, TierType> = {
    "basic": "Basic",
    "one region": "One Region",
    "three regions": "Three Regions",
    "provincial": "Provincial",
    "multi province": "Multi-Province",
    "pending payment": "Basic",
  };
  return map[lower] || "Basic";
}

export function getTierLimits(tier: string): { provinces: number; regions: number } {
  const normalized = normalizeTierName(tier);
  return TIER_LIMITS[normalized] || TIER_LIMITS["Basic"];
}
