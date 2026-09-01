/**
 * Cash-on-delivery rules, shared by the checkout UI and the checkout API so the
 * customer never sees an option the server is going to reject.
 */

/** Carts above this total must be paid online. */
export const COD_MAX_ORDER_VALUE = 2000;

export function isCodAllowedForTotal(total: number): boolean {
  return Number.isFinite(total) && total <= COD_MAX_ORDER_VALUE;
}

export function codUnavailableReason(total: number, blocked: boolean): string | null {
  if (blocked) {
    return "Cash on delivery isn't available on this number right now. Please pay online.";
  }
  if (!isCodAllowedForTotal(total)) {
    return `Cash on delivery is available on orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}.`;
  }
  return null;
}
