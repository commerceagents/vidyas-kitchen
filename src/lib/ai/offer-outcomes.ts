import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardOrder } from "@/lib/dashboard/orders";
import { countOrdersForDishes, kitchenDateKey } from "@/lib/ai/dish-analytics";
import { OFFER_OUTCOMES_KEY, parseOfferOutcomes, type OfferOutcome } from "@/lib/ai/offer-memory";
import { loadFestivalDishMap } from "@/lib/menu/festival-dishes";

type FestivalWindow = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  discount_override: number;
  active: boolean;
};

function shiftYmd(ymd: string, days: number): string {
  const t = Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function inclusiveDays(start: string, end: string): number {
  const a = Date.parse(`${start.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${end.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export async function loadOfferOutcomes(supabase: SupabaseClient): Promise<OfferOutcome[]> {
  const { data } = await supabase.from("ai_pricing_config").select("value").eq("key", OFFER_OUTCOMES_KEY).maybeSingle();
  return parseOfferOutcomes(data?.value);
}

export async function saveOfferOutcomes(supabase: SupabaseClient, rows: OfferOutcome[]): Promise<void> {
  await supabase.from("ai_pricing_config").upsert(
    { key: OFFER_OUTCOMES_KEY, value: rows, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

export function settleOutcomes(rows: OfferOutcome[], orders: DashboardOrder[], now = new Date()): OfferOutcome[] {
  const today = kitchenDateKey(now);
  return rows.map((row) => {
    if (row.ordersDuring != null && row.ordersBaseline != null) return row;
    const next = { ...row };
    const length = inclusiveDays(row.startDate, row.endDate);
    const dishIds = row.dishId.startsWith("festival:")
      ? rows
          .filter(
            (other) =>
              other.festivalId === row.festivalId &&
              other.startDate === row.startDate &&
              other.dishId !== row.dishId &&
              !other.dishId.startsWith("festival:"),
          )
          .map((other) => other.dishId)
      : [row.dishId];
    if (next.ordersBaseline == null && today >= row.startDate) {
      next.ordersBaseline = countOrdersForDishes(orders, dishIds, shiftYmd(row.startDate, -length), shiftYmd(row.startDate, -1));
    }
    if (next.ordersDuring == null && today > row.endDate) {
      next.ordersDuring = countOrdersForDishes(orders, dishIds, row.startDate, row.endDate);
    }
    return next;
  });
}

function sameWindow(row: OfferOutcome, festivalId: string, start: string): boolean {
  return row.festivalId === festivalId && row.startDate === start;
}

/** Remember a festival the kitchen just approved, one row per dish plus a festival rollup. */
export function outcomesForApproval(
  existing: OfferOutcome[],
  input: {
    festivalId: string;
    festivalName: string;
    startDate: string;
    endDate: string;
    defaultPct: number;
    dishIds: string[];
    overrides: Record<string, number>;
  },
): OfferOutcome[] {
  const start = input.startDate.slice(0, 10);
  const end = input.endDate.slice(0, 10);
  const kept = existing.filter((row) => !sameWindow(row, input.festivalId, start));
  const rollup: OfferOutcome = {
    dishId: `festival:${input.festivalId}`,
    festivalId: input.festivalId,
    festivalName: input.festivalName,
    offerPct: input.defaultPct,
    startDate: start,
    endDate: end,
    ordersDuring: null,
    ordersBaseline: null,
  };
  const dishes: OfferOutcome[] = input.dishIds.map((dishId) => ({
    dishId,
    festivalId: input.festivalId,
    festivalName: input.festivalName,
    offerPct: input.overrides[dishId] ?? input.defaultPct,
    startDate: start,
    endDate: end,
    ordersDuring: null,
    ordersBaseline: null,
  }));
  return [...kept, rollup, ...dishes];
}

/**
 * Make sure every live (or already-ticked) festival has outcome rows, then
 * fill baseline and during-offer counts once those dates are in the past.
 */
export async function syncAndSettleOfferOutcomes(
  supabase: SupabaseClient,
  orders: DashboardOrder[],
  festivals: FestivalWindow[],
  now = new Date(),
): Promise<OfferOutcome[]> {
  const [existing, dishMap] = await Promise.all([loadOfferOutcomes(supabase), loadFestivalDishMap(supabase)]);
  let rows = existing.slice();
  for (const festival of festivals) {
    const dishes = dishMap[festival.id] ?? [];
    if (dishes.length === 0) continue;
    const start = festival.date_start.slice(0, 10);
    const already = rows.some((row) => row.dishId === `festival:${festival.id}` && row.startDate === start);
    if (already) continue;
    rows = outcomesForApproval(rows, {
      festivalId: festival.id,
      festivalName: festival.name,
      startDate: start,
      endDate: festival.date_end.slice(0, 10),
      defaultPct: Number(festival.discount_override) || 20,
      dishIds: dishes,
      overrides: {},
    });
  }
  const settled = settleOutcomes(rows, orders, now);
  const changed = JSON.stringify(settled) !== JSON.stringify(existing);
  if (changed) await saveOfferOutcomes(supabase, settled);
  return settled;
}
