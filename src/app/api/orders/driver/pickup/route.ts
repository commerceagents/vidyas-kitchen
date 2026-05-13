import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { transitionOrderStatusInDb } from "@/lib/order-transition";
import { OrderStatus } from "@/lib/order-status";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Driver: READY → OUT_FOR_DELIVERY */
export async function POST(request: Request) {
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
  const r = await transitionOrderStatusInDb(supabase, orderId, OrderStatus.OUT_FOR_DELIVERY);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
