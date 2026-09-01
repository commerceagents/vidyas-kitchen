import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { transitionOrderStatusInDb, markCodCollected } from "@/lib/order-transition";
import { normalizeOrderStatus, OrderStatus, PaymentStatus } from "@/lib/order-status";
import { haversineMeters } from "@/lib/geo";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

const MAX_METRES = 120; // ~100m + GPS jitter

/** Driver: complete delivery (proximity-checked when drop-off pin exists). */
export async function POST(request: Request) {
  let body: { orderId?: string; lat?: number; lng?: number; codCollected?: boolean };
  try {
    body = (await request.json()) as {
      orderId?: string;
      lat?: number;
      lng?: number;
      codCollected?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId || "");
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isUuid(orderId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: row, error: fe } = await supabase
    .from("orders")
    .select("id, status, delivery_lat, delivery_lng, payment_method, payment_status")
    .eq("id", orderId)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const st = normalizeOrderStatus(String(row.status));
  if (st !== OrderStatus.OUT_FOR_DELIVERY && st !== "out") {
    return NextResponse.json({ error: "Order is not out for delivery" }, { status: 400 });
  }

  // A COD order can only be closed once the driver states the cash is in hand —
  // that's the whole point of the separate payment_status.
  const isCod = String(row.payment_method || "").toLowerCase() === "cod";
  const alreadySettled = String(row.payment_status || "") === PaymentStatus.PAID;
  if (isCod && !alreadySettled && body.codCollected !== true) {
    return NextResponse.json(
      { error: "Confirm the cash was collected before completing this delivery." },
      { status: 400 },
    );
  }

  const dlat = row.delivery_lat as number | null | undefined;
  const dlng = row.delivery_lng as number | null | undefined;
  if (dlat != null && dlng != null && Number.isFinite(Number(dlat)) && Number.isFinite(Number(dlng))) {
    const m = haversineMeters(lat, lng, Number(dlat), Number(dlng));
    // Skip proximity check in development
    if (m > MAX_METRES && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: `Too far from drop-off (~${Math.round(m)}m). Move within about 100m to complete.` },
        { status: 400 },
      );
    }
  }

  // Settle the cash first: if the delivery transition then fails we'd rather
  // have the money recorded than lose it.
  if (isCod && !alreadySettled) {
    const collected = await markCodCollected(supabase, orderId);
    if (!collected.ok) {
      console.error("[driver/complete] markCodCollected", collected.error);
      return NextResponse.json({ error: collected.error }, { status: 400 });
    }
  }

  const r = await transitionOrderStatusInDb(supabase, orderId, OrderStatus.DELIVERED);
  if (!r.ok) {
    console.error("[driver/complete] transition", r.error);
    return NextResponse.json({ error: r.error }, { status: 400 });
  }

  // The run is over, so the last GPS fix is now just the driver's home address
  // sitting in our database. Drop it.
  await supabase
    .from("orders")
    .update({ driver_last_lat: null, driver_last_lng: null, driver_location_at: null })
    .eq("id", orderId);

  return NextResponse.json({ ok: true });
}
