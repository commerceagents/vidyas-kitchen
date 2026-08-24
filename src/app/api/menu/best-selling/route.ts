import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  BEST_SELLING_LIMIT,
  BEST_SELLING_WINDOW_DAYS,
  BILLABLE_ORDER_STATUSES,
  MIN_UNITS_FOR_SALES_RANK,
  fillWithKitchenPicks,
  kitchenPickEntries,
  rankDishesByUnits,
  variantIdToDishIdMap,
  type BestSellingSource,
} from "@/lib/menu/best-selling";

/**
 * Best selling dishes for the home carousel.
 * - Enough recent paid volume → rank by units sold (variant lines rolled up to dish).
 * - Pre-launch / cold start → curated kitchen picks (not invented sales numbers).
 */
export async function GET() {
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - BEST_SELLING_WINDOW_DAYS);
    const sinceIso = since.toISOString();

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        menu_item_id,
        quantity,
        orders!inner (
          id,
          status,
          created_at
        )
      `
      )
      .gte("orders.created_at", sinceIso);

    if (error) {
      console.error("[best-selling]", error);
      return coldStartResponse();
    }

    type OrderNest = {
      id?: string;
      status?: string | null;
      created_at?: string | null;
    };
    type Row = {
      menu_item_id?: string | null;
      quantity?: number | null;
      orders?: OrderNest | OrderNest[] | null;
    };

    const variantToDish = variantIdToDishIdMap();
    const unitsByDish = new Map<string, number>();
    let totalUnits = 0;

    for (const row of (data || []) as Row[]) {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      if (!order?.id) continue;
      const st = String(order.status || "").toLowerCase();
      if (!BILLABLE_ORDER_STATUSES.has(st)) continue;

      const rawId = String(row.menu_item_id || "").trim();
      const dishId = variantToDish.get(rawId);
      if (!dishId) continue;

      const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
      if (qty <= 0) continue;

      unitsByDish.set(dishId, (unitsByDish.get(dishId) || 0) + qty);
      totalUnits += qty;
    }

    if (totalUnits < MIN_UNITS_FOR_SALES_RANK) {
      return coldStartResponse(totalUnits);
    }

    const ranked = fillWithKitchenPicks(rankDishesByUnits(unitsByDish), BEST_SELLING_LIMIT);
    const source: BestSellingSource = "sales";

    return NextResponse.json(
      {
        source,
        windowDays: BEST_SELLING_WINDOW_DAYS,
        totalUnits,
        ids: ranked.map((r) => r.dishId),
        entries: ranked,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    console.error("[best-selling]", e);
    return coldStartResponse();
  }
}

function coldStartResponse(totalUnits = 0) {
  const entries = kitchenPickEntries();
  const source: BestSellingSource = "kitchen_picks";
  return NextResponse.json(
    {
      source,
      windowDays: BEST_SELLING_WINDOW_DAYS,
      totalUnits,
      ids: entries.map((e) => e.dishId),
      entries,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
