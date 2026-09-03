import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { markOrderPaidAndNotify } from "@/lib/order-transition";
import { verifyPaymentLinkCallbackSignature } from "@/lib/razorpay-verify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const paymentLinkId = searchParams.get("razorpay_payment_link_id") ?? "";
  const paymentId = searchParams.get("razorpay_payment_id") ?? "";
  const referenceId = searchParams.get("razorpay_payment_link_reference_id") ?? "";
  const status = searchParams.get("razorpay_payment_link_status") ?? "";
  const signature = searchParams.get("razorpay_signature") ?? "";

  // Only act on the paid callback; a cancelled or failed redirect falls through
  // to the bottom of the function and returns /?status=cancelled.
  if (status === "paid" && paymentLinkId) {
    // ── Signature verification ─────────────────────────────────────────────
    // Razorpay signs payment-link redirects so that anyone who guesses or
    // reuses a payment_link_id cannot mark an order paid for free.
    // Formula: HMAC-SHA256(link_id|reference_id|status|payment_id, key_secret)
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
    if (!keySecret) {
      console.error("[callback] RAZORPAY_KEY_SECRET not set — cannot verify signature");
      return NextResponse.redirect(new URL("/?status=error", request.url));
    }

    const valid = verifyPaymentLinkCallbackSignature(
      paymentLinkId,
      referenceId,
      status,
      paymentId,
      signature,
      keySecret,
    );

    if (!valid) {
      console.error(
        "[callback] Signature verification FAILED",
        { paymentLinkId, paymentId, referenceId, status, signature: signature.slice(0, 8) + "…" },
      );
      // Redirect to an error page rather than showing a raw error. The customer
      // may have been sent a tampered link — bring them back safely.
      return NextResponse.redirect(new URL("/?status=error", request.url));
    }

    // ── Look up the order and transition it ───────────────────────────────
    try {
      const supabase = createServerSupabase();

      const { data: order, error: findError } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_link_id", paymentLinkId)
        .single();

      if (findError || !order) {
        console.error("[callback] Order not found for payment_link_id", paymentLinkId, findError);
        return NextResponse.redirect(new URL("/?status=error", request.url));
      }

      // markOrderPaidAndNotify is idempotent: if the webhook already moved the
      // order to paid (or beyond), it returns { ok: true } without re-notifying.
      const paid = await markOrderPaidAndNotify(supabase, order.id as string, paymentId || null);
      if (!paid.ok) {
        console.error("[callback] markOrderPaidAndNotify:", paid.error);
        return NextResponse.redirect(new URL("/?status=error", request.url));
      }

      return NextResponse.redirect(new URL(`/?status=success&orderId=${order.id}`, request.url));
    } catch (err) {
      console.error("[callback] Unexpected error:", err);
      return NextResponse.redirect(new URL("/?status=error", request.url));
    }
  }

  // Payment was cancelled or failed on the Razorpay side.
  return NextResponse.redirect(new URL("/?status=cancelled", request.url));
}
