import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { markOrderUndelivered } from "@/lib/order-transition";
import { COD_FAILURE_REASONS, type CodFailureReason } from "@/lib/order-status";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Driver: the order couldn't be handed over (cash refused, nobody home, bad
 * address). Parks the order in `undelivered` for the kitchen to chase and, for
 * COD, bars the number from paying with cash next time.
 */
export async function POST(request: Request) {
  const auth = await requireDriverSession();
  if (!auth.ok) return auth.response;

  let body: { orderId?: string; reason?: string };
  try {
    body = (await request.json()) as { orderId?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId || "");
  const reason = String(body.reason || "other") as CodFailureReason;

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  if (!(reason in COD_FAILURE_REASONS)) {
    return NextResponse.json({ error: "Pick a valid reason" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const result = await markOrderUndelivered(supabase, orderId, reason);
    if (!result.ok) {
      console.error("[driver/undelivered]", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[driver/undelivered]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
