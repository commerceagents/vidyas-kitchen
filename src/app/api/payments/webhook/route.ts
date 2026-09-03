import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { markOrderPaidAndNotify } from "@/lib/order-transition";
import { verifyWebhookSignature } from "@/lib/razorpay-verify";

/**
 * POST /api/payments/webhook
 *
 * Razorpay delivers signed webhook events here whenever a payment succeeds,
 * even if the customer's browser never makes it back to the callback URL.
 * This makes order activation reliable regardless of browser / network state.
 *
 * Configure in the Razorpay Dashboard:
 *   Webhooks → Add new webhook
 *     URL:    https://vidyaskitchenhome.com/api/payments/webhook
 *     Events: payment_link.paid   (primary)
 *             payment.captured    (belt-and-suspenders for direct payment flows)
 *   Copy the "Webhook Secret" into RAZORPAY_WEBHOOK_SECRET in Vercel.
 *
 * Both this endpoint and the browser callback call markOrderPaidAndNotify.
 * That function is idempotent — if the order is already past pending_payment,
 * it returns { ok: true } without sending a second notification.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not configured — refusing all requests");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error("[webhook] Signature mismatch — possible replay or wrong secret");
    return new NextResponse("Signature mismatch", { status: 400 });
  }

  let event: { event?: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const eventType = event?.event;

  if (eventType === "payment_link.paid") {
    const plEntity = (
      event.payload as
        | { payment_link?: { entity?: Record<string, unknown> } }
        | undefined
    )?.payment_link?.entity;

    const payEntity = (
      event.payload as
        | { payment?: { entity?: Record<string, unknown> } }
        | undefined
    )?.payment?.entity;

    const paymentLinkId = String(plEntity?.id ?? "");
    const paymentId = String(payEntity?.id ?? "");

    if (!paymentLinkId) {
      console.error("[webhook] payment_link.paid missing payment_link.entity.id");
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const supabase = createServerSupabase();
    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_link_id", paymentLinkId)
      .single();

    if (findError || !order) {
      // Could be a test event, a link created outside our flow, or an order we
      // already cleaned up. Log and 200 so Razorpay stops retrying.
      console.warn("[webhook] No order found for payment_link_id", paymentLinkId);
      return NextResponse.json({ ok: true, note: "order not found" }, { status: 200 });
    }

    const result = await markOrderPaidAndNotify(
      supabase,
      order.id as string,
      paymentId || null,
    );
    if (!result.ok) {
      console.error("[webhook] markOrderPaidAndNotify failed:", result.error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (eventType === "payment.captured") {
    const payEntity = (
      event.payload as
        | { payment?: { entity?: Record<string, unknown> } }
        | undefined
    )?.payment?.entity;

    const notes = (payEntity?.notes as Record<string, string> | undefined) ?? {};
    const orderId = String(notes?.order_id ?? "");
    const paymentId = String(payEntity?.id ?? "");

    if (!orderId) {
      // No order_id in notes means this capture didn't come through our
      // checkout flow (e.g. a manual test payment in the dashboard). Acknowledge.
      return NextResponse.json({ ok: true, note: "no order_id in notes" }, { status: 200 });
    }

    const supabase = createServerSupabase();
    const result = await markOrderPaidAndNotify(supabase, orderId, paymentId || null);
    if (!result.ok) {
      console.error("[webhook] payment.captured markOrderPaidAndNotify failed:", result.error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Unhandled event types: return 200 immediately so Razorpay does not
  // retry indefinitely. A 4xx here would trigger retries for every event we
  // choose not to handle, flooding our logs.
  return NextResponse.json({ ok: true, note: "unhandled event" }, { status: 200 });
}
