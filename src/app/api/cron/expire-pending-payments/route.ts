import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * GET /api/cron/expire-pending-payments
 *
 * Cancels `pending_payment` orders that have been sitting untouched for more
 * than 90 minutes. These are abandoned checkouts: the customer opened the
 * payment page, never paid, and never came back. Without this cleanup, they
 * accumulate in the kitchen board as "Pending Pay" ghosts and the app's
 * in-flight detector latches onto them on the next cold start.
 *
 * Called every hour by Vercel Cron (configured in vercel.json). Vercel attaches
 * `Authorization: Bearer $CRON_SECRET`; verifying it is this route's job.
 *
 * No WhatsApp notification is sent — the customer abandoned the flow and
 * never confirmed an order, so there is nothing meaningful to say to them.
 * Orders past their delivery slot are also expired regardless of age so
 * tomorrow's kitchen board starts clean.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Fails closed when CRON_SECRET is missing: this bulk-cancels orders, so an
  // unset env var must not turn it into an open endpoint.
  if (!cronSecret) {
    console.error("[expire-pending-payments] CRON_SECRET is not set — refusing to run.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServerSupabase();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  const { data: stale, error: fetchErr } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "pending_payment")
    .or(`created_at.lt.${cutoff},delivery_slot.lt.${now.toISOString()}`);

  if (fetchErr) {
    console.error("[expire-pending-payments] fetch error:", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const ids = (stale ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancellable: false,
      updated_at: now.toISOString(),
    })
    .in("id", ids);

  if (upErr) {
    console.error("[expire-pending-payments] update error:", upErr.message);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  console.log(`[expire-pending-payments] expired ${ids.length} stale pending_payment order(s)`);
  return NextResponse.json({ expired: ids.length });
}
