import { MENU_BY_CATEGORY, type MenuItem } from "@/components/ui/mobile/mobileMenuData";

export const BEST_SELLING_LIMIT = 5;
export const BEST_SELLING_WINDOW_DAYS = 30;

/**
 * Until real order volume exists, don't invent "best sellers".
 * Below this many billable units in the window → use kitchen picks.
 */
export const MIN_UNITS_FOR_SALES_RANK = 8;

export type BestSellingSource = "sales" | "kitchen_picks";

export type BestSellingEntry = {
  dishId: string;
  unitsSold: number;
};

/**
 * Curated house favourites for cold start (pre-launch / low volume).
 * Order = display priority. Not fake sales — kitchen-chosen signatures.
 */
export const KITCHEN_PICK_DISH_IDS: string[] = [
  "37c30dfd-3be1-46a1-9780-8f65e6112259", // Mom's Recipe - Chicken Gravy
  "dcf3fee3-f1cd-4bd8-bded-e575587dd86b", // Sister's Recipe - Chicken Gravy
  "56fbbb0a-d446-426b-8bf9-ec1d0deaa345", // Sister-in-law's Recipe - Pepper Chicken
  "9a6acd6d-b56c-41f1-85ad-3c2631f00cfb", // Idli Special Chicken Gravy
  "231d0270-ed4e-40c2-b3d2-ad677bccc92f", // Egg Curry
];

export const BILLABLE_ORDER_STATUSES = new Set([
  "paid",
  "confirmed",
  "preparing",
  "prepping",
  "ready",
  "out",
  "out_for_delivery",
  "delivered",
]);

export function allMenuDishes(): MenuItem[] {
  return Object.values(MENU_BY_CATEGORY).flat();
}

/** order_items.menu_item_id is usually a variant UUID — map to parent dish id. */
export function variantIdToDishIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const dish of allMenuDishes()) {
    map.set(dish.id, dish.id);
    for (const v of dish.variants) {
      map.set(v.id, dish.id);
    }
  }
  return map;
}

/** All IDs that can appear on order lines for a dish (parent + variants). */
export function dishLineItemIds(menuItemIdOrDishId: string): string[] {
  const map = variantIdToDishIdMap();
  const dishId = map.get(menuItemIdOrDishId) || menuItemIdOrDishId;
  const dish = allMenuDishes().find((d) => d.id === dishId);
  if (!dish) return [menuItemIdOrDishId];
  const ids = new Set<string>([dish.id, ...dish.variants.map((v) => v.id)]);
  return [...ids];
}

export function kitchenPickEntries(limit = BEST_SELLING_LIMIT): BestSellingEntry[] {
  return KITCHEN_PICK_DISH_IDS.slice(0, limit).map((dishId) => ({
    dishId,
    unitsSold: 0,
  }));
}

/** Fill ranked list up to `limit` using kitchen picks for missing slots. */
export function fillWithKitchenPicks(
  ranked: BestSellingEntry[],
  limit = BEST_SELLING_LIMIT
): BestSellingEntry[] {
  const seen = new Set(ranked.map((r) => r.dishId));
  const out = ranked.slice(0, limit);
  for (const id of KITCHEN_PICK_DISH_IDS) {
    if (out.length >= limit) break;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ dishId: id, unitsSold: 0 });
  }
  return out;
}

export function rankDishesByUnits(
  unitsByDish: Map<string, number>,
  limit = BEST_SELLING_LIMIT
): BestSellingEntry[] {
  return [...unitsByDish.entries()]
    .map(([dishId, unitsSold]) => ({ dishId, unitsSold }))
    .filter((e) => e.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || a.dishId.localeCompare(b.dishId))
    .slice(0, limit);
}
