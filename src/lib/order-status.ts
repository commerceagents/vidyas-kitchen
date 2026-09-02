/**
 * Single order status vocabulary (DB `orders.status`). Lowercase snake_case.
 */

export const OrderStatus = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  /** Driver reached the door but couldn't hand the order over (COD refused, nobody there). */
  UNDELIVERED: "undelivered",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
} as const;

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

/**
 * Where the money is. Deliberately separate from `OrderStatus`, which tracks
 * where the food is — a COD order is cooked and dispatched while its payment
 * is still `pending`.
 */
export const PaymentStatus = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
} as const;

export type PaymentStatusValue = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Allowed monotonic transitions (kitchen / driver / payment). */
const EDGES: Record<string, string[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.UNDELIVERED],
  [OrderStatus.DELIVERED]: [],
  // Kitchen can still settle an undelivered order afterwards (customer paid
  // later, or the food came back and the order is written off).
  [OrderStatus.UNDELIVERED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

/**
 * The one reference a customer, the kitchen and the driver all quote at each
 * other. It has to be identical everywhere or support can't match a phone call
 * to an order, so every surface formats it through here rather than slicing the
 * UUID or padding `order_number` its own way.
 */
export function formatOrderRef(orderNumber: number | null | undefined, orderId: string): string {
  if (orderNumber != null && Number.isFinite(Number(orderNumber))) {
    return `#${String(Math.trunc(Number(orderNumber))).padStart(5, "0")}`;
  }
  // Pre-`order_number` rows still need something stable to point at.
  return `#${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Is this order still going somewhere?
 *
 * "In flight" means the customer has a reason to watch it: it hasn't arrived,
 * and it hasn't been called off. Used to decide whether an order belongs in the
 * Live tab or is simply history.
 */
export function isOrderInFlight(status: string): boolean {
  const s = normalizeOrderStatus(status);
  return (
    s !== OrderStatus.DELIVERED &&
    s !== OrderStatus.CANCELLED &&
    s !== OrderStatus.REJECTED &&
    s !== OrderStatus.UNDELIVERED
  );
}

/** Legacy DB values → normalize for transition checks. */
export function normalizeOrderStatus(raw: string): string {
  const s = String(raw || "").toLowerCase().trim();
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

/** Title-case a snake_case or space-separated status fragment for display. */
function titleizeWords(s: string): string {
  return s
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Human label for kitchen dashboard badge. */
export function kitchenLabelForStatus(status: string): string {
  const s = normalizeOrderStatus(status);
  switch (s) {
    case OrderStatus.PENDING_PAYMENT:
      return "Pending Pay";
    case OrderStatus.PAID:
      return "New";
    case OrderStatus.CONFIRMED:
      return "Confirmed";
    case OrderStatus.PREPARING:
      return "Cooking";
    case OrderStatus.READY:
      return "Ready";
    case OrderStatus.OUT_FOR_DELIVERY:
      return "Dispatched";
    case OrderStatus.DELIVERED:
      return "Delivered";
    case OrderStatus.UNDELIVERED:
      return "Not Delivered";
    case OrderStatus.CANCELLED:
      return "Cancelled";
    case OrderStatus.REJECTED:
      return "Rejected";
    default:
      return titleizeWords(s);
  }
}

/** Reasons a driver can give when an order can't be handed over. */
export const COD_FAILURE_REASONS = {
  refused: "Customer refused to pay",
  unreachable: "Customer not reachable",
  wrong_address: "Wrong or unreachable address",
  other: "Other reason",
} as const;

export type CodFailureReason = keyof typeof COD_FAILURE_REASONS;

export function codFailureLabel(reason: string | null | undefined): string {
  if (!reason) return "Not delivered";
  return COD_FAILURE_REASONS[reason as CodFailureReason] ?? titleizeWords(reason);
}

/** True when the order still owes money (COD that hasn't been collected). */
export function isPaymentOutstanding(
  paymentStatus: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (normalizeOrderStatus(String(status ?? "")) === OrderStatus.CANCELLED) return false;
  const p = String(paymentStatus ?? "").toLowerCase();
  return p === PaymentStatus.PENDING || p === PaymentStatus.FAILED;
}
