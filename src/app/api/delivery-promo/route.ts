import { NextResponse } from "next/server";
import { loadDeliveryPromoSettings } from "@/lib/delivery-promo";
import { computeOrderBreakdownFromItemSubtotal, ORDER_DELIVERY_INR } from "@/lib/order-pricing";

export const dynamic = "force-dynamic";

/** Public read: current delivery fee for a cart subtotal (after any store-wide promo). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subtotal = Math.max(0, Math.round(Number(url.searchParams.get("subtotal") || 0)));
  const promo = await loadDeliveryPromoSettings();
  const breakdown = computeOrderBreakdownFromItemSubtotal(subtotal, { deliveryPromo: promo });
  const applies = promo.active && subtotal >= promo.minOrderInr && breakdown.delivery < ORDER_DELIVERY_INR;

  return NextResponse.json({
    active: promo.active,
    discountInr: promo.discountInr,
    minOrderInr: promo.minOrderInr,
    deliveryFee: breakdown.delivery,
    baseDeliveryFee: ORDER_DELIVERY_INR,
    applies,
  });
}
