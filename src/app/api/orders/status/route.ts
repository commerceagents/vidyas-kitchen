import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Last 10 digits for India-style numbers stored as +91… or plain. */
function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

/**
 * Lightweight order lookup for the mobile “tracking” card.
 * Caller must supply the same phone number used at checkout (ownership check).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") || "";
  const phone = searchParams.get("phone") || "";

  if (!isUuid(orderId) || phoneKey(phone).length < 10) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: row, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, updated_at, delivery_address, delivery_slot, delivery_slot_kind, phone_number, rating_stars, rating_comment, total_amount,
        delivery_lat, delivery_lng,
        driver_last_lat, driver_last_lng, driver_location_at,
        order_items (
          quantity,
          unit_price,
          menu_items ( name )
        )
      `,
      )
      .eq("id", orderId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (phoneKey(String(row.phone_number || "")) !== phoneKey(phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rawItems = (row as { order_items?: unknown }).order_items;
    const lines: { name: string; quantity: number; unitPrice: number }[] = [];
    if (Array.isArray(rawItems)) {
      for (const it of rawItems as { quantity?: number; unit_price?: number; menu_items?: { name?: string } | null }[]) {
        const name = it.menu_items?.name ? String(it.menu_items.name) : "Item";
        const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const unitPrice = Number(it.unit_price) || 0;
        lines.push({ name, quantity, unitPrice });
      }
    }

    const itemsSubtotal = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
    const breakdown = computeOrderBreakdownFromItemSubtotal(itemsSubtotal);
    const storedTotal = Number((row as { total_amount?: unknown }).total_amount);
    const totalAmount = Number.isFinite(storedTotal) ? storedTotal : breakdown.computedTotal;
    const adjustment = Math.round((totalAmount - breakdown.computedTotal) * 100) / 100;

    return NextResponse.json({
      orderId: row.id,
      status: row.status,
      updatedAt: row.updated_at,
      deliveryAddress: row.delivery_address,
      deliverySlot: row.delivery_slot,
      deliverySlotKind: row.delivery_slot_kind,
      ratingStars: row.rating_stars,
      ratingComment: row.rating_comment,
      totalAmount,
      deliveryLat: (row as { delivery_lat?: number | null }).delivery_lat ?? null,
      deliveryLng: (row as { delivery_lng?: number | null }).delivery_lng ?? null,
      driverLastLat: (row as { driver_last_lat?: number | null }).driver_last_lat ?? null,
      driverLastLng: (row as { driver_last_lng?: number | null }).driver_last_lng ?? null,
      driverLocationAt: (row as { driver_location_at?: string | null }).driver_location_at ?? null,
      lines,
      breakdown: {
        itemsSubtotal: breakdown.itemsSubtotal,
        packaging: breakdown.packaging,
        delivery: breakdown.delivery,
        gst: breakdown.gst,
        computedTotal: breakdown.computedTotal,
        adjustment: Math.abs(adjustment) < 0.01 ? 0 : adjustment,
      },
    });
  } catch (e) {
    console.error("[orders/status]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
