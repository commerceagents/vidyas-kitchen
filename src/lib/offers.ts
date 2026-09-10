/**
 * Money-off offers — the rules that decide what a customer actually saves.
 *
 * Deliberately separate from `menu/discount-pricing.ts`. That file only decides
 * the struck-through "was" price on a card; nothing there changes the bill.
 * Everything here does change the bill, so it must run server-side before an
 * order is written.
 */

export type OfferKind = "auto" | "code";
export type OfferValueType = "percent" | "flat";

export type OfferRow = {
  id: string;
  name: string;
  kind: OfferKind;
  code: string | null;
  value_type: OfferValueType;
  value: number;
  min_order: number;
  max_discount: number | null;
  starts_on: string | null;
  ends_on: string | null;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number | null;
  active: boolean;
};

/** What gets applied to one order. */
export type AppliedOffer = {
  offerId: string;
  /** Uppercased code, or null for auto offers. */
  code: string | null;
  /** Customer-facing label, e.g. "Diwali Special". */
  label: string;
  /** Whole rupees off the item subtotal. */
  amount: number;
};

export function normalizeOfferCode(raw: string | null | undefined): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

function parseYmd(ymd: string | null | undefined): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.slice(0, 10))) return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

/** Inclusive on both ends; a null bound means "open on that side". */
export function isOfferInWindow(offer: OfferRow, now = new Date()): boolean {
  const t = now.getTime();
  const start = parseYmd(offer.starts_on);
  const end = parseYmd(offer.ends_on);
  if (start != null && t < start) return false;
  if (end != null && t > end + 86400000 - 1) return false;
  return true;
}

export function isOfferExhausted(offer: OfferRow): boolean {
  return offer.usage_limit != null && offer.used_count >= offer.usage_limit;
}

/** Live = switched on, inside its dates, and not used up. Ignores the cart. */
export function isOfferLive(offer: OfferRow, now = new Date()): boolean {
  return offer.active && isOfferInWindow(offer, now) && !isOfferExhausted(offer);
}

/**
 * Rupees off `subtotal`. Never exceeds the subtotal — fees and GST are charged
 * on top and an offer must not eat into those.
 */
export function offerDiscountFor(offer: OfferRow, subtotal: number): number {
  if (!(subtotal > 0)) return 0;
  if (subtotal < Number(offer.min_order || 0)) return 0;

  let off =
    offer.value_type === "percent"
      ? Math.round((subtotal * Number(offer.value)) / 100)
      : Math.round(Number(offer.value));

  if (offer.max_discount != null) off = Math.min(off, Math.round(Number(offer.max_discount)));
  return Math.max(0, Math.min(off, Math.round(subtotal)));
}

/** Short line for the customer, e.g. "10% off up to ₹150 on orders over ₹500". */
export function offerTerms(offer: OfferRow): string {
  const base =
    offer.value_type === "percent"
      ? `${Math.round(offer.value)}% off`
      : `₹${Math.round(offer.value)} off`;
  const parts = [base];
  if (offer.value_type === "percent" && offer.max_discount != null) {
    parts.push(`up to ₹${Math.round(offer.max_discount)}`);
  }
  if (Number(offer.min_order) > 0) {
    parts.push(`on orders over ₹${Math.round(offer.min_order)}`);
  }
  return parts.join(" ");
}

/**
 * Why a code the customer typed cannot be used, in words they can act on.
 * `null` means it applies.
 */
export function offerRejectionReason(
  offer: OfferRow | null,
  subtotal: number,
  now = new Date(),
): string | null {
  if (!offer) return "That code isn't valid.";
  if (!offer.active) return "That code is no longer active.";
  if (isOfferExhausted(offer)) return "That code has been fully claimed.";
  if (!isOfferInWindow(offer, now)) {
    const start = parseYmd(offer.starts_on);
    if (start != null && now.getTime() < start) return "That code isn't active yet.";
    return "That code has expired.";
  }
  const min = Number(offer.min_order || 0);
  if (min > 0 && subtotal < min) {
    return `Add ₹${Math.round(min - subtotal)} more to use this code.`;
  }
  if (offerDiscountFor(offer, subtotal) <= 0) return "That code doesn't apply to this cart.";
  return null;
}

/** Best auto offer for a cart, or null. Highest saving wins when windows overlap. */
export function bestAutoOffer(
  offers: OfferRow[],
  subtotal: number,
  now = new Date(),
): { offer: OfferRow; amount: number } | null {
  let best: { offer: OfferRow; amount: number } | null = null;
  for (const o of offers) {
    if (o.kind !== "auto" || !isOfferLive(o, now)) continue;
    const amount = offerDiscountFor(o, subtotal);
    if (amount <= 0) continue;
    if (!best || amount > best.amount) best = { offer: o, amount };
  }
  return best;
}

export function toAppliedOffer(offer: OfferRow, amount: number): AppliedOffer {
  return {
    offerId: offer.id,
    code: offer.code ? normalizeOfferCode(offer.code) : null,
    label: offer.name,
    amount,
  };
}

/**
 * One discount per order — whichever saves more. Stacking a festival offer on
 * top of a promo code is how a small kitchen accidentally sells at a loss, and
 * "why did my code do nothing?" is easier to explain than a stacked total.
 */
export function pickBestOffer(
  auto: { offer: OfferRow; amount: number } | null,
  coded: { offer: OfferRow; amount: number } | null,
): AppliedOffer | null {
  const winner =
    coded && auto ? (coded.amount >= auto.amount ? coded : auto) : (coded ?? auto);
  if (!winner || winner.amount <= 0) return null;
  return toAppliedOffer(winner.offer, winner.amount);
}

/** Shape returned by the API/DB with unknown-ish values coerced. */
export function parseOfferRow(r: Record<string, unknown>): OfferRow {
  const kind: OfferKind = r.kind === "code" ? "code" : "auto";
  const valueType: OfferValueType = r.value_type === "flat" ? "flat" : "percent";
  return {
    id: String(r.id),
    name: String(r.name ?? "Offer"),
    kind,
    code: r.code ? normalizeOfferCode(String(r.code)) : null,
    value_type: valueType,
    value: Number(r.value ?? 0),
    min_order: Number(r.min_order ?? 0),
    max_discount: r.max_discount == null ? null : Number(r.max_discount),
    starts_on: r.starts_on ? String(r.starts_on).slice(0, 10) : null,
    ends_on: r.ends_on ? String(r.ends_on).slice(0, 10) : null,
    usage_limit: r.usage_limit == null ? null : Number(r.usage_limit),
    used_count: Number(r.used_count ?? 0),
    per_customer_limit: r.per_customer_limit == null ? null : Number(r.per_customer_limit),
    active: Boolean(r.active),
  };
}
