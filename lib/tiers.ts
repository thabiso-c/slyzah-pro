export type TierType = "Basic" | "One Region" | "Three Regions" | "Provincial" | "Multi-Province";

export const TIER_LIMITS: Record<TierType, { provinces: number; regions: number }> = {
  Basic: { provinces: 1, regions: 3 },
  "One Region": { provinces: 1, regions: 1 },
  "Three Regions": { provinces: 1, regions: 3 },
  Provincial: { provinces: 1, regions: Number.MAX_SAFE_INTEGER },
  "Multi-Province": { provinces: Number.MAX_SAFE_INTEGER, regions: Number.MAX_SAFE_INTEGER },
};

export function isTierType(value: string): value is TierType {
  return value in TIER_LIMITS;
}
