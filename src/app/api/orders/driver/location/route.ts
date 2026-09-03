import { NextResponse, after } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { notifyWhatsAppDriverLocation } from "@/lib/whatsapp-order-notify";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Driver app: report GPS while en route (updates customer map). */
export async function POST(request: Request) {
  const auth = await requireDriverSession();
  if (!auth.ok) return auth.response;

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
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: row, error: fe } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const st = normalizeOrderStatus(String(row.status));
  if (st !== OrderStatus.OUT_FOR_DELIVERY && st !== "out") {
    return NextResponse.json({ error: "Order is not out for delivery" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: up } = await supabase
    .from("orders")
    .update({
      driver_last_lat: lat,
      driver_last_lng: lng,
      driver_location_at: now,
      updated_at: now,
    })
    .eq("id", orderId);

  if (up) {
    console.error("[driver/location]", up);
    return NextResponse.json({ error: up.message }, { status: 500 });
  }

  // Best-effort, and heavily throttled inside. The driver app polls often, so
  // this must never slow down or fail a position report.
  after(() => {
    void notifyWhatsAppDriverLocation(supabase, orderId, lat, lng).catch((e) =>
      console.error("[driver/location] pin notify:", e),
    );
  });

  return NextResponse.json({ ok: true });
}
