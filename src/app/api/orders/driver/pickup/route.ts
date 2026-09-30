import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { normalizeDriverPhone, requireDriverSession } from "@/lib/driver-auth";
import { transitionOrderStatusInDb } from "@/lib/order-transition";
import { OrderStatus } from "@/lib/order-status";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Driver: READY → OUT_FOR_DELIVERY */
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
  const { data: existing } = await supabase
    .from("orders")
    .select("driver_phone")
    .eq("id", orderId)
    .maybeSingle();
  const assigned = normalizeDriverPhone(String(existing?.driver_phone || ""));
  if (assigned !== normalizeDriverPhone(auth.driver.phone)) {
    return NextResponse.json({ error: "This delivery is not assigned to you." }, { status: 403 });
  }
  const r = await transitionOrderStatusInDb(supabase, orderId, OrderStatus.OUT_FOR_DELIVERY);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
