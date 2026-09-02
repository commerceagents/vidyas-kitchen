import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/**
 * The address may only move while the order is still sitting with the kitchen.
 * Once it has been cooked or handed to a driver the destination is baked into
 * a printed ticket and a route, and changing it silently would send the driver
 * to the wrong door.
 */
const EDITABLE: string[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.CONFIRMED];

/**
 * Move a placed order to a new delivery address.
 *
 * Without this the app's "edit address" pencil only repointed the pin stored on
 * the device: the customer saw their new address echoed back locally while the
 * kitchen and driver still held the original one.
 */
export async function POST(request: Request) {
  let body: {
    orderId?: unknown;
    phone?: unknown;
    address?: unknown;
    lat?: unknown;
    lng?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  if (!isUuid(orderId) || phoneKey(phone).length < 10 || address.length < 5) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: row, error: fetchErr } = await supabase
      .from("orders")
      .select("id, phone_number, status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Same ownership rule as cancel: the phone the order was placed with.
    // A mismatch is reported as "not found" so this can't be used to probe
    // which order ids exist.
    if (phoneKey(String(row.phone_number || "")) !== phoneKey(phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!EDITABLE.includes(normalizeOrderStatus(String(row.status)))) {
      return NextResponse.json(
        { error: "This order is already being prepared — message us on WhatsApp to change the address." },
        { status: 409 },
      );
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        delivery_address: address.slice(0, 500),
        ...(hasPin ? { delivery_lat: lat, delivery_lng: lng } : {}),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("[orders/address]", updateErr.message);
      return NextResponse.json({ error: "Could not update the address" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, address, ...(hasPin ? { lat, lng } : {}) });
  } catch (e) {
    console.error("[orders/address]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
