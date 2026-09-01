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

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, order_number, status, created_at, updated_at, total_amount,
        delivery_slot, delivery_slot_kind, delivery_address,
        payment_method, payment_status, rating_stars,
        order_items ( quantity, menu_items ( name, image_url ) )
      `,
      )
      // Numbers are stored inconsistently (+91… vs plain 10 digits), so match on
      // the trailing 10 digits rather than an exact string compare.
      .like("phone_number", `%${key}`)
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS);

    if (error) {
      console.error("[orders/history]", error.message);
      return NextResponse.json({ error: "Could not load orders" }, { status: 500 });
    }

    const orders = (data ?? []).map((row) => {
      const rawItems = (row as { order_items?: unknown }).order_items;
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
        createdAt: row.created_at ?? null,
        totalAmount: row.total_amount != null ? Number(row.total_amount) : null,
        deliverySlot: row.delivery_slot ?? null,
        deliverySlotKind: row.delivery_slot_kind ?? null,
        deliveryAddress: row.delivery_address ?? null,
        paymentMethod: (row as { payment_method?: string | null }).payment_method ?? null,
        paymentStatus: (row as { payment_status?: string | null }).payment_status ?? null,
        ratingStars: (row as { rating_stars?: number | null }).rating_stars ?? null,
        items,
      };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[orders/history]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
