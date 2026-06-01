import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { transitionOrderStatusInDb } from "@/lib/order-transition";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { haversineMeters } from "@/lib/geo";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

const MAX_METRES = 120; // ~100m + GPS jitter

/** Driver: complete delivery (proximity-checked when drop-off pin exists). */
export async function POST(request: Request) {
  let body: { orderId?: string; lat?: number; lng?: number };
  try {
    body = (await request.json()) as { orderId?: string; lat?: number; lng?: number };
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
    .select("id, status, delivery_lat, delivery_lng")
    .eq("id", orderId)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const st = normalizeOrderStatus(String(row.status));
  if (st !== OrderStatus.OUT_FOR_DELIVERY && st !== "out") {
    return NextResponse.json({ error: "Order is not out for delivery" }, { status: 400 });
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

  const r = await transitionOrderStatusInDb(supabase, orderId, OrderStatus.DELIVERED);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
