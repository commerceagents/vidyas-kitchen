import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { dishLineItemIds } from "@/lib/menu/best-selling";

export const revalidate = 60;

const BILLABLE = new Set([
  "paid",
  "confirmed",
  "preparing",
  "prepping",
  "ready",
  "out",
  "out_for_delivery",
  "delivered",
]);

const CACHE_TTL_MS = 60_000;
const socialMemo = new Map<string, { at: number; payload: Record<string, unknown> }>();

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function phoneKey(raw: string | null | undefined) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

function jsonCached(payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}

export type DishReview = {
  id: string;
  name: string;
  stars: number;
  comment: string | null;
  createdAt: string;
};

type OrderRow = {
  id: string;
  phone_number?: string | null;
  status?: string | null;
  rating_stars?: number | null;
  rating_comment?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Genuine social proof for a menu item from real orders.
 * Cached ~60s — “new on menu” dishes skip the users name lookup entirely.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const menuItemId = String(searchParams.get("menuItemId") || "").trim();
    if (!isUuid(menuItemId)) {
      return NextResponse.json({ error: "Invalid menuItemId" }, { status: 400 });
    }

    const hit = socialMemo.get(menuItemId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return jsonCached(hit.payload);
    }

    const lineIds = dishLineItemIds(menuItemId);
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        order_id,
        menu_item_id,
        orders (
          id,
          phone_number,
          status,
          rating_stars,
          rating_comment,
          created_at,
          updated_at
        )
      `,
      )
      .in("menu_item_id", lineIds);

    if (error) {
      console.error("[dish-social]", error);
      return NextResponse.json({ error: "Could not load dish stats." }, { status: 500 });
    }

    const rows = (data || []) as { order_id: string; orders: OrderRow | OrderRow[] | null }[];
    const byOrder = new Map<string, OrderRow>();
    for (const row of rows) {
      const o = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      if (!o?.id) continue;
      const st = String(o.status || "").toLowerCase();
      if (!BILLABLE.has(st)) continue;
      byOrder.set(o.id, o);
    }

    const orders = [...byOrder.values()];

    const byPhone = new Map<string, number>();
    for (const o of orders) {
      const key = phoneKey(o.phone_number);
      if (!key) continue;
      byPhone.set(key, (byPhone.get(key) || 0) + 1);
    }
    const uniqueCustomers = byPhone.size;
    const repeatCustomers = [...byPhone.values()].filter((n) => n >= 2).length;
    const reorderRate = uniqueCustomers > 0 ? repeatCustomers / uniqueCustomers : 0;
    const highlyReordered =
      uniqueCustomers >= 3 && repeatCustomers >= 2 && reorderRate >= 0.3;

    const rated = orders.filter(
      (o) => typeof o.rating_stars === "number" && o.rating_stars >= 1 && o.rating_stars <= 5,
    );
    const ratingCount = rated.length;
    const avgRating =
      ratingCount > 0
        ? Math.round((rated.reduce((s, o) => s + Number(o.rating_stars), 0) / ratingCount) * 10) / 10
        : null;

    const nameByPhone = new Map<string, string>();
    // Only hit users table when there are ratings to label — new dishes stay fast
    if (rated.length > 0) {
      const phones = [...new Set(rated.map((o) => phoneKey(o.phone_number)).filter(Boolean))];
      if (phones.length) {
        const orFilter = phones.map((p) => `phone_number.ilike.%${p}`).join(",");
        const { data: users } = await supabase
          .from("users")
          .select("phone_number, full_name")
          .or(orFilter);
        for (const u of users || []) {
          const k = phoneKey((u as { phone_number?: string }).phone_number);
          const name = String((u as { full_name?: string | null }).full_name || "").trim();
          if (k && name) nameByPhone.set(k, name.split(/\s+/)[0] || name);
        }
      }
    }

    const reviews: DishReview[] = rated
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updated_at || a.created_at || 0).getTime();
        const tb = new Date(b.updated_at || b.created_at || 0).getTime();
        return tb - ta;
      })
      .slice(0, 20)
      .map((o) => {
        const k = phoneKey(o.phone_number);
        return {
          id: o.id,
          name: nameByPhone.get(k) || "Customer",
          stars: Number(o.rating_stars),
          comment: o.rating_comment ? String(o.rating_comment).trim() || null : null,
          createdAt: String(o.updated_at || o.created_at || new Date().toISOString()),
        };
      });

    const payload = {
      orderCount: orders.length,
      uniqueCustomers,
      repeatCustomers,
      highlyReordered,
      avgRating,
      ratingCount,
      reviews,
    };

    socialMemo.set(menuItemId, { at: Date.now(), payload });
    return jsonCached(payload);
  } catch (e) {
    console.error("[dish-social]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
