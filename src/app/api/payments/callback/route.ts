import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { markOrderPaidAndNotify } from "@/lib/order-transition";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const paymentLinkId = searchParams.get("razorpay_payment_link_id");
  const paymentId = searchParams.get("razorpay_payment_id");
  const status = searchParams.get("razorpay_payment_link_status");

  // In a payment link callback, Razorpay redirects here with these params.
  // We need to identify the order and update it.
  
  if (status === "paid" && paymentLinkId) {
    try {
      const supabase = createServerSupabase();
      // 1. Find the order that exactly matches this payment link ID
      const { data: order, error: findError } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_link_id", paymentLinkId)
        .single();

      if (findError || !order) {
        console.error("Order not found or link ID mismatch:", findError);
        return NextResponse.redirect(new URL("/?status=error", request.url));
      }

      const paid = await markOrderPaidAndNotify(supabase, order.id as string, paymentId);
      if (!paid.ok) {
        console.error("markOrderPaidAndNotify:", paid.error);
        return NextResponse.redirect(new URL("/?status=error", request.url));
      }

      return NextResponse.redirect(new URL(`/?status=success&orderId=${order.id}`, request.url));
      
    } catch (err) {
      console.error("Payment Callback Error:", err);
      return NextResponse.redirect(new URL("/?status=error", request.url));
    }
  }

  // If failed or cancelled
  return NextResponse.redirect(new URL("/?status=cancelled", request.url));
}
