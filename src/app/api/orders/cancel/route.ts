import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { transitionOrderStatusInDb } from "@/lib/order-transition";
import { OrderStatus } from "@/lib/order-status";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

/**
 * Customer-initiated cancel: updates `orders.status` to `cancelled` when allowed,
 * then sends WhatsApp via `transitionOrderStatusInDb` (same as kitchen transitions).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof (body as { orderId?: unknown })?.orderId === "string" ? (body as { orderId: string }).orderId : "";
  const phone = typeof (body as { phone?: unknown })?.phone === "string" ? (body as { phone: string }).phone : "";

  if (!isUuid(orderId) || phoneKey(phone).length < 10) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: row, error: fetchErr } = await supabase
      .from("orders")
      .select("id, phone_number, status, cancellation_deadline")
      .eq("id", orderId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (phoneKey(String(row.phone_number || "")) !== phoneKey(phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = Date.now();
    const deadline = row.cancellation_deadline ? new Date(row.cancellation_deadline).getTime() : 0;
    if (deadline > 0 && now >= deadline) {
      return NextResponse.json({ error: "Cancellation window has closed (12 hours before slot)." }, { status: 400 });
    }

    const result = await transitionOrderStatusInDb(supabase, orderId, OrderStatus.CANCELLED);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[orders/cancel]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
