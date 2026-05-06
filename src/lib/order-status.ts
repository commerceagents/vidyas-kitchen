/**
 * Single order status vocabulary (DB `orders.status`). Lowercase snake_case.
 */

export const OrderStatus = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PREPARING: "preparing",
  READY: "ready",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Allowed monotonic transitions (kitchen / driver / payment). */
const EDGES: Record<string, string[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Legacy DB values → normalize for transition checks. */
export function normalizeOrderStatus(raw: string): string {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "confirmed") return OrderStatus.PREPARING;
  if (s === "prepping") return OrderStatus.PREPARING;
  if (s === "out") return OrderStatus.OUT_FOR_DELIVERY;
  if (s === "completed") return OrderStatus.DELIVERED;
  return s;
}

export function canTransitionOrderStatus(from: string, to: string): boolean {
  const f = normalizeOrderStatus(from);
  const t = normalizeOrderStatus(to);
  const next = EDGES[f];
  return Array.isArray(next) && next.includes(t);
}

/** Human label for kitchen dashboard badge. */
export function kitchenLabelForStatus(status: string): string {
  const s = normalizeOrderStatus(status);
  switch (s) {
    case OrderStatus.PENDING_PAYMENT:
      return "Pending pay";
    case OrderStatus.PAID:
      return "New";
    case OrderStatus.PREPARING:
      return "Accepted";
    case OrderStatus.READY:
      return "Ready";
    case OrderStatus.OUT_FOR_DELIVERY:
      return "Dispatched";
    case OrderStatus.DELIVERED:
      return "Delivered";
    case OrderStatus.CANCELLED:
      return "Cancelled";
    default:
      return s.replace(/_/g, " ");
  }
}
