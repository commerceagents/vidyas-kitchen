import type { SupabaseClient } from "@supabase/supabase-js";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import {
  payPriceForDish,
  pickActiveFestival,
  type FestivalRow,
} from "@/lib/menu/discount-pricing";

export const FESTIVAL_DISHES_KEY = "festival_included_dishes";

const KNOWN_DISH_IDS = new Set(
  Object.values(MENU_BY_CATEGORY)
    .flat()
    .map((dish) => dish.id),
);

export function dishIdForVariant(variantId: string): string | null {
  for (const dishes of Object.values(MENU_BY_CATEGORY)) {
    for (const dish of dishes) {
      if (dish.variants.some((variant) => variant.id === variantId)) return dish.id;
    }
  }
  return null;
}

export function sanitizeDishIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const id of raw) {
    const value = String(id || "");
    if (KNOWN_DISH_IDS.has(value)) seen.add(value);
  }
  return [...seen];
}

export function parseFestivalDishMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [festivalId, ids] of Object.entries(raw as Record<string, unknown>)) {
    out[festivalId] = sanitizeDishIds(ids);
  }
  return out;
}

export async function loadFestivalDishMap(
  supabase: SupabaseClient,
): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("ai_pricing_config")
    .select("value")
    .eq("key", FESTIVAL_DISHES_KEY)
    .maybeSingle();
  return parseFestivalDishMap(data?.value);
}

export function attachFestivalDishes(rows: FestivalRow[], map: Record<string, string[]>): FestivalRow[] {
  return rows.map((row) => ({ ...row, included_dish_ids: map[row.id] ?? [] }));
}

export async function loadActiveFestival(supabase: SupabaseClient): Promise<FestivalRow | null> {
  const [{ data }, map] = await Promise.all([
    supabase.from("festivals").select("*").order("date_start", { ascending: true }),
    loadFestivalDishMap(supabase),
  ]);
  const rows: FestivalRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    date_start: String(r.date_start ?? "").slice(0, 10),
    date_end: String(r.date_end ?? "").slice(0, 10),
    discount_override: Number(r.discount_override ?? 0),
    chip_label: String(r.chip_label ?? ""),
    active: Boolean(r.active),
    included_dish_ids: map[String(r.id)] ?? [],
  }));
  return pickActiveFestival(rows);
}

/** Menu price after the live festival cut, for one variant id. */
export function festivalUnitPrice(
  menuPrice: number,
  variantId: string,
  festival: FestivalRow | null,
): number {
  const dishId = dishIdForVariant(variantId);
  if (!dishId) return menuPrice;
  return payPriceForDish(menuPrice, dishId, festival);
}

let quotedFestival: FestivalRow | null = null;

/** Last festival loaded on this server instance. WhatsApp prices read it. */
export function peekFestivalQuote(): FestivalRow | null {
  return quotedFestival;
}

export async function primeFestivalQuote(supabase: SupabaseClient): Promise<FestivalRow | null> {
  try {
    quotedFestival = await loadActiveFestival(supabase);
  } catch {
    quotedFestival = null;
  }
  return quotedFestival;
}

export async function saveFestivalDishes(
  supabase: SupabaseClient,
  festivalId: string,
  dishIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const map = await loadFestivalDishMap(supabase);
  map[festivalId] = sanitizeDishIds(dishIds);
  const { error } = await supabase.from("ai_pricing_config").upsert(
    {
      key: FESTIVAL_DISHES_KEY,
      value: map,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
