import type { SupabaseClient } from "@supabase/supabase-js";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";

export type CartLineInput = { menuItemId: string; quantity: number };

export function isVariantUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Price per variant id, from the static menu first and Supabase for anything
 * missing. Returns null when an id can't be priced at all — the caller must
 * refuse the order rather than guess.
 *
 * Shared so that the coupon preview and the real checkout can never compute
 * two different subtotals for the same cart.
 */
export async function resolveVariantPrices(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, number> | null> {
  const priceById = new Map<string, number>();
  const allVariants = Object.values(MENU_BY_CATEGORY)
    .flat()
    .flatMap((d) => d.variants || []);

  for (const id of ids) {
    const variant = allVariants.find((v) => v.id === id);
    if (variant) priceById.set(id, variant.price);
  }

  if (priceById.size !== ids.length) {
    const missing = ids.filter((id) => !priceById.has(id));
    const { data: menuRows } = await supabase.from("menu_items").select("id, price").in("id", missing);
    for (const r of menuRows ?? []) {
      const price = Number((r as { price?: unknown }).price);
      if (Number.isFinite(price)) priceById.set(String((r as { id: unknown }).id), price);
    }
  }

  return priceById.size === ids.length ? priceById : null;
}

export type NormalizedCart =
  | { ok: true; lines: CartLineInput[] }
  | { ok: false; error: string };

/** Merge duplicate lines and validate shape. */
export function normalizeCartLines(lines: CartLineInput[]): NormalizedCart {
  const qtyById = new Map<string, number>();
  for (const l of lines) {
    if (!l.menuItemId || !isVariantUuid(l.menuItemId)) {
      return { ok: false, error: "Invalid menu item id." };
    }
    const q = Math.floor(Number(l.quantity));
    if (!Number.isFinite(q) || q < 1 || q > 99) {
      return { ok: false, error: "Invalid quantity." };
    }
    qtyById.set(l.menuItemId, (qtyById.get(l.menuItemId) || 0) + q);
  }
  return {
    ok: true,
    lines: [...qtyById.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
  };
}

export function subtotalFor(lines: CartLineInput[], priceById: Map<string, number>): number {
  return lines.reduce((sum, l) => sum + (priceById.get(l.menuItemId) ?? 0) * l.quantity, 0);
}
