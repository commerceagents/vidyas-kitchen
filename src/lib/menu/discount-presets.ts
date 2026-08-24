/** Clean round discount presets for kitchen + AI suggestions. */
export const DISCOUNT_PCT_PRESETS = [10, 15, 20, 25, 30] as const;

export type DiscountPctPreset = (typeof DISCOUNT_PCT_PRESETS)[number];

/** Snap any % to the nearest preset (default 20). */
export function roundToDiscountPreset(pct: number | null | undefined): DiscountPctPreset {
  const n = Number(pct);
  if (!Number.isFinite(n) || n <= 0) return 20;
  let best: DiscountPctPreset = DISCOUNT_PCT_PRESETS[0];
  let bestDist = Math.abs(n - best);
  for (const p of DISCOUNT_PCT_PRESETS) {
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Suggest a festival offer % from the stored override (or a sensible default).
 * Always returns a clean preset — never odd values like 22/24.
 */
export function suggestFestivalDiscountPct(
  currentOverride: number | null | undefined,
  festivalName?: string,
): DiscountPctPreset {
  const name = (festivalName || "").toLowerCase();
  // Bigger national / New Year windows → slightly stronger default when unset
  if (currentOverride == null || currentOverride <= 0) {
    if (name.includes("diwali") || name.includes("new year") || name.includes("eid") || name.includes("ramzan")) {
      return 30;
    }
    if (name.includes("pongal") || name.includes("puthandu") || name.includes("christmas")) {
      return 25;
    }
    return 20;
  }
  return roundToDiscountPreset(currentOverride);
}
