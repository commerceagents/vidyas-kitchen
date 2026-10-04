import { roundToDiscountPreset } from "@/lib/menu/discount-presets";
import { PRICING_AGENT_THRESHOLDS } from "@/lib/ai/pricing-agent.config";

/** One applied offer, kept so the next suggestion can see whether it worked. */
export type OfferOutcome = {
  dishId: string;
  festivalId: string | null;
  festivalName: string | null;
  offerPct: number;
  startDate: string;
  endDate: string;
  /** Null until the end date has passed and the nightly run has counted. */
  ordersDuring: number | null;
  /** Orders in the same-length window immediately before the offer. */
  ordersBaseline: number | null;
};

export const OFFER_OUTCOMES_KEY = "offer_outcomes";

export function festivalNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d{4}/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOfferOutcomes(raw: unknown): OfferOutcome[] {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(value)) return [];
  const out: OfferOutcome[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const dishId = String(r.dishId || "");
    const startDate = String(r.startDate || "").slice(0, 10);
    const endDate = String(r.endDate || "").slice(0, 10);
    if (!dishId || !startDate || !endDate) continue;
    out.push({
      dishId,
      festivalId: r.festivalId ? String(r.festivalId) : null,
      festivalName: r.festivalName ? String(r.festivalName) : null,
      offerPct: Number(r.offerPct) || 0,
      startDate,
      endDate,
      ordersDuring: r.ordersDuring == null ? null : Number(r.ordersDuring) || 0,
      ordersBaseline: r.ordersBaseline == null ? null : Number(r.ordersBaseline) || 0,
    });
  }
  return out;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function liftOf(during: number, baseline: number): number | null {
  if (!(baseline > 0)) return null;
  return during / baseline;
}

/** Next % after a measured offer. Weak lift steps up. A strong lift stays put. */
export function pctAfterLift(previousPct: number, lift: number | null): number {
  if (lift != null && lift >= PRICING_AGENT_THRESHOLDS.strongLift) {
    return roundToDiscountPreset(previousPct);
  }
  if (lift != null && lift < PRICING_AGENT_THRESHOLDS.weakLift) {
    return roundToDiscountPreset(previousPct + PRICING_AGENT_THRESHOLDS.liftStepPct);
  }
  return roundToDiscountPreset(previousPct);
}

export function memorySentence(outcome: OfferOutcome, nextPct: number): string | null {
  if (outcome.ordersDuring == null) return null;
  const name = outcome.festivalName || "last time";
  const lift =
    outcome.ordersBaseline != null ? liftOf(outcome.ordersDuring, outcome.ordersBaseline) : null;
  if (lift == null) {
    return `Last ${name}: ${outcome.offerPct}% off · ${outcome.ordersDuring} orders during the offer.`;
  }
  const rounded = Math.round(lift * 10) / 10;
  const moved = lift >= 1 ? `rose ${rounded}x` : `were ${rounded}x the week before`;
  return `Last ${name}: ${outcome.offerPct}% off → orders ${moved}. Suggesting ${nextPct}% again.`;
}

export function historyPerformanceLine(outcome: OfferOutcome): string | null {
  if (outcome.ordersDuring == null) return null;
  const from = shortDay(outcome.startDate);
  const to = shortDay(outcome.endDate);
  return `Ran ${from} – ${to} · ${outcome.offerPct}% off · ${outcome.ordersDuring} orders during offer`;
}

function shortDay(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
}

/** Latest settled festival-level outcome with the same name (Diwali matches last Diwali). */
export function latestFestivalOutcome(name: string, outcomes: OfferOutcome[]): OfferOutcome | null {
  const key = festivalNameKey(name);
  const past = outcomes
    .filter(
      (row) =>
        row.ordersDuring != null &&
        row.dishId.startsWith("festival:") &&
        row.festivalName != null &&
        festivalNameKey(row.festivalName) === key,
    )
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  return past[0] ?? null;
}

export function latestDishOutcome(dishId: string, outcomes: OfferOutcome[]): OfferOutcome | null {
  const past = outcomes
    .filter((row) => row.dishId === dishId && row.ordersDuring != null)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  return past[0] ?? null;
}

export function suggestionFromOutcome(
  outcome: OfferOutcome | null,
  fallbackPct: number,
): { pct: number; note: string | null } {
  if (!outcome || outcome.ordersDuring == null) return { pct: roundToDiscountPreset(fallbackPct), note: null };
  const lift = outcome.ordersBaseline != null ? liftOf(outcome.ordersDuring, outcome.ordersBaseline) : null;
  const pct = pctAfterLift(outcome.offerPct || fallbackPct, lift);
  return { pct, note: memorySentence({ ...outcome, offerPct: outcome.offerPct || fallbackPct }, pct) };
}
