/**
 * WhatsApp cart maths.
 *
 * Kept free of any Supabase import on purpose: the copy builders in
 * whatsapp-copy.ts need these numbers and are reachable from client
 * components, while whatsapp-session.ts runs on the service-role key and must
 * never reach the browser bundle.
 */

import { computeOrderBreakdownFromItemSubtotal, type OrderFeeBreakdown } from "./order-pricing";

export type CartItem = {
  menu_item_id: string;
  name: string;
  variant: string;
  quantity: number;
  unit_price: number;
};

/** Line items only — no packaging, delivery, or GST. */
export function cartItemsSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

/** Same fee stack the app's checkout applies, so both channels bill alike. */
export function cartBreakdown(cart: CartItem[]): OrderFeeBreakdown {
  return computeOrderBreakdownFromItemSubtotal(cartItemsSubtotal(cart));
}

/**
 * The only cart the model is allowed to talk about. Built from the session
 * row just read from the database — never from earlier chat turns.
 */
export function getCartSummary(cart: CartItem[]) {
  const fees = cartBreakdown(cart);
  return {
    items: cart.map((item) => ({
      name: item.name,
      variant: item.variant,
      qty: item.quantity,
      unitPrice: item.unit_price,
    })),
    itemsTotal: fees.itemsSubtotal,
    packaging: fees.packaging,
    delivery: fees.delivery,
    gst: fees.gst,
  };
}

/**
 * What the customer is quoted, charged, and what lands in
 * `orders.total_amount`. There is deliberately no bare-sum "cartTotal" export:
 * every caller has to say whether it wants the subtotal or the real total.
 */
export function cartGrandTotal(cart: CartItem[]): number {
  return Math.round(cartBreakdown(cart).computedTotal);
}
