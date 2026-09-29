/**
 * Checkout suggestion. Pairs come from paid orders. The percent comes from a
 * discount the kitchen already turned on. This does not invent either one.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { variantIdToDishIdMap } from "@/lib/menu/best-selling";
import { orderCountsAsSale } from "@/lib/ai/dish-analytics";
import { buildItemPairs, pickUpsell, type ItemPair } from "@/lib/ai/item-pairs";
import { buildUpsellMessage } from "@/lib/whatsapp-copy";
import type { CartItem } from "@/lib/whatsapp-cart";

function readPairs(raw: unknown): ItemPair[] {
  const parsed = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const pair = row as { item_a?: unknown; item_b?: unknown; co_order_count?: unknown };
    if (typeof pair.item_a !== "string" || typeof pair.item_b !== "string") return [];
    const count = Number(pair.co_order_count);
    if (!Number.isFinite(count) || count < 1) return [];
    return [{ item_a: pair.item_a, item_b: pair.item_b, co_order_count: count }];
  });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function dishName(id: string): string {
  for (const items of Object.values(MENU_BY_CATEGORY)) {
    const found = items.find((item) => item.id === id);
    if (found) return found.name;
  }
  return id;
}

async function loadPairs(db: ReturnType<typeof createServerSupabase>): Promise<ItemPair[]> {
  const stored = await db.from("ai_pricing_config").select("value").eq("key", "item_pairs").maybeSingle();
  const pairs = readPairs(stored.data?.value);
  if (pairs.length > 0) return pairs;

  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("orders")
    .select("status, order_items(menu_item_id)")
    .gte("created_at", cutoff);
  if (error || !data) return [];

  const variantToDish = variantIdToDishIdMap();
  const built = buildItemPairs(
    (data as { status?: string; order_items?: { menu_item_id?: string | null }[] | null }[])
      .filter((order) => orderCountsAsSale({ status: String(order.status ?? "") }))
      .map((order) => ({
        dishIds: (order.order_items ?? [])
          .map((item) => {
            const id = item.menu_item_id ?? null;
            if (!id) return null;
            return variantToDish.get(id) ?? id;
          })
          .filter((id): id is string => Boolean(id)),
      })),
  );
  if (built.length > 0) {
    await db.from("ai_pricing_config").upsert(
      {
        key: "item_pairs",
        value: JSON.stringify(built.slice(0, 200)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  }
  return built;
}

export async function cartUpsellMessage(cart: CartItem[]): Promise<string | null> {
  if (cart.length === 0) return null;
  const db = createServerSupabase();
  const [pairs, discounts] = await Promise.all([
    loadPairs(db),
    db.from("dish_discount_settings").select("dish_id, show_discount, discount_type, discount_value"),
  ]);
  const live = (discounts.data ?? []).flatMap((row) => {
    const pct = Number(row.discount_value);
    if (!row.show_discount || row.discount_type !== "percentage" || !(pct > 0)) return [];
    return [{ dishId: String(row.dish_id), name: dishName(String(row.dish_id)), pct }];
  });
  const pick = pickUpsell({
    cart: cart.map((line) => ({ dishId: line.menu_item_id, name: line.name })),
    pairs,
    liveDiscounts: live,
  });
  if (!pick) return null;
  return buildUpsellMessage(pick.favoriteName, pick.suggestedName, pick.discount);
}
