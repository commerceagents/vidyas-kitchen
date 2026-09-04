import { NextResponse, after } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { sendDriverArrivedPush } from "@/lib/push-order-notify";
import { notifyWhatsAppDriverArrived } from "@/lib/whatsapp-order-notify";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Driver: "I've reached the customer".
 *
 * Stamps `driver_arrived_at` instead of moving the order status — the order is
 * still out for delivery until the food actually changes hands. Idempotent, so
 * a double tap doesn't send the customer a second alert.
 */
export async function POST(request: Request) {
  const auth = await requireDriverSession();
  if (!auth.ok) return auth.response;

  let body: { orderId?: string };
  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId || "");
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: row, error: fe } = await supabase
    .from("orders")
    .select("id, status, phone_number, order_number, delivery_slot, payment_method, driver_arrived_at")
    .eq("id", orderId)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const st = normalizeOrderStatus(String(row.status));
  if (st !== OrderStatus.OUT_FOR_DELIVERY) {
    return NextResponse.json({ error: "Order is not out for delivery" }, { status: 400 });
  }

  const arrivedAt = row.driver_arrived_at as string | null;
  if (arrivedAt) {
    return NextResponse.json({ ok: true, arrivedAt, alreadyArrived: true });
  }

  const now = new Date().toISOString();
  const { data: stamped, error: up } = await supabase
    .from("orders")
    .update({ driver_arrived_at: now, updated_at: now })
    .eq("id", orderId)
    .is("driver_arrived_at", null)
    .select("id");

  if (up) {
    console.error("[driver/arrived]", up);
    return NextResponse.json({ error: up.message }, { status: 500 });
  }

  // No row matched: a concurrent tap won the race and has already told the
  // customer. Report success, but don't send a second alert.
  if (!stamped || stamped.length === 0) {
    return NextResponse.json({ ok: true, alreadyArrived: true });
  }

  after(async () => {
    await Promise.allSettled([
      sendDriverArrivedPush(
        supabase,
        row.phone_number as string | null,
        orderId,
        (row.order_number as number | null) ?? null,
        (row.payment_method as string | null) ?? null,
      ),
      notifyWhatsAppDriverArrived(supabase, orderId),
    ]);
  });

  return NextResponse.json({ ok: true, arrivedAt: now });
}
