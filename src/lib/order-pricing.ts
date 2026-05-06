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
