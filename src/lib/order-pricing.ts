/** Must stay in sync with checkout fee logic (orders/checkout). */
export const ORDER_PACKAGING_INR = 20;
export const ORDER_DELIVERY_INR = 35;
export const ORDER_GST_RATE = 0.05;

export type OrderFeeBreakdown = {
  itemsSubtotal: number;
  packaging: number;
  delivery: number;
  gst: number;
  /** Sum of items + fees (may differ slightly from `orders.total_amount` for legacy rows). */
  computedTotal: number;
};

export type OrderLineItem = { quantity: number; unit_price?: number | null };

export function orderItemsSubtotal(items: OrderLineItem[]): number {
  return items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);
}

export function computeOrderBreakdownFromItemSubtotal(itemsSubtotal: number): OrderFeeBreakdown {
  const gst = Math.round(itemsSubtotal * ORDER_GST_RATE);
  const computedTotal =
    Math.round((itemsSubtotal + ORDER_PACKAGING_INR + ORDER_DELIVERY_INR + gst) * 100) / 100;
  return {
    itemsSubtotal,
    packaging: ORDER_PACKAGING_INR,
    delivery: ORDER_DELIVERY_INR,
    gst,
    computedTotal,
  };
}

/** Card / bill total — prefers stored `total_amount` (what the customer paid). */
export function getOrderDisplayTotal(order: {
  total_amount?: number | null;
  items?: OrderLineItem[];
}): number {
  const stored = order.total_amount != null ? Number(order.total_amount) : null;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return Math.round(stored);
  }
  const subtotal = orderItemsSubtotal(order.items ?? []);
  return Math.round(computeOrderBreakdownFromItemSubtotal(subtotal).computedTotal);
}

/** Revenue stat — same as display total; returns 0 when nothing billable is stored. */
export function getOrderRevenueAmount(order: {
  total_amount?: number | null;
  items?: OrderLineItem[];
}): number {
  return getOrderDisplayTotal(order);
}
