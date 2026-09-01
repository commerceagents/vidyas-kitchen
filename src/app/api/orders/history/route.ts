import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/** Last 10 digits for India-style numbers stored as +91… or plain. */
function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

const MAX_ORDERS = 40;

/**
 * Every order placed from this phone number, newest first — powers the
 * customer's "My Orders" list. Ownership is the phone number itself, matching
 * the existing single-order status endpoint.
 */
export async function GET(request: Request) {
  const phone = new URL(request.url).searchParams.get("phone") || "";
  const key = phoneKey(phone);

  if (key.length < 10) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const BASE_COLUMNS = `
    id, order_number, status, created_at, updated_at, total_amount,
    delivery_slot, delivery_slot_kind, delivery_address,
    payment_method, rating_stars,
    order_items ( quantity, menu_items ( name, image_url ) )
  `;

  try {
    const supabase = createServerSupabase();

    // Numbers are stored inconsistently (+91… vs plain 10 digits), so match on
    // the trailing 10 digits rather than an exact string compare.
    const query = (columns: string) =>
      supabase
        .from("orders")
        .select(columns)
        .like("phone_number", `%${key}`)
        .order("created_at", { ascending: false })
        .limit(MAX_ORDERS);

    let { data, error } = await query(`${BASE_COLUMNS}, payment_status`);

    // payment_status arrives with the COD migration. Until that has been run,
    // fall back rather than showing the customer an error for their whole
    // order history.
    if (error?.code === "42703") {
      console.warn("[orders/history] payment_status missing — run supabase/migrations-cod-flow.sql");
      ({ data, error } = await query(BASE_COLUMNS));
    }

    if (error) {
      console.error("[orders/history]", error.message);
      return NextResponse.json({ error: "Could not load orders" }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const orders = rows.map((row) => {
      const rawItems = row.order_items;
      const items = Array.isArray(rawItems)
        ? (rawItems as { quantity?: number; menu_items?: { name?: string; image_url?: string } | null }[]).map((it) => ({
            name: it.menu_items?.name ? String(it.menu_items.name) : "Item",
            imageUrl: it.menu_items?.image_url ?? null,
            quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          }))
        : [];

      return {
        orderId: String(row.id),
        orderNumber: row.order_number != null ? Number(row.order_number) : null,
        status: String(row.status ?? ""),
        createdAt: (row.created_at as string | null) ?? null,
        totalAmount: row.total_amount != null ? Number(row.total_amount) : null,
        deliverySlot: (row.delivery_slot as string | null) ?? null,
        deliverySlotKind: (row.delivery_slot_kind as string | null) ?? null,
        deliveryAddress: (row.delivery_address as string | null) ?? null,
        paymentMethod: (row.payment_method as string | null) ?? null,
        paymentStatus: (row.payment_status as string | null) ?? null,
        ratingStars: (row.rating_stars as number | null) ?? null,
        items,
      };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[orders/history]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
