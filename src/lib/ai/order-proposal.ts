/**
 * Conversational ordering, as propose-and-confirm.
 *
 * "Order me a chicken gravy tomorrow at 8pm" is understood by the model, but
 * the model only ever produces a *draft*. This module turns a draft into a
 * priced, rule-checked proposal, and the order row is written only after the
 * customer taps Confirm. The AI has no path to `orders` at all — that is what
 * produced the ₹250 empty-order bug it replaces.
 */

import {
  isSlotBookable,
  isValidSlotKind,
  istAddCalendarDays,
  istCalendarYmd,
  slotStartIsoFor,
  DELIVERY_SLOT_DEFS,
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import { WA_CART_MAX } from "@/lib/whatsapp-copy";
import { cartGrandTotal, cartItemsSubtotal, type CartItem } from "@/lib/whatsapp-cart";
import { isCodAllowedForTotal } from "@/lib/cod-policy";
import { unitPriceFor, resolveDishPricing, type PackSize } from "@/lib/menu/dish-pricing";
import type { MenuItem } from "@/lib/ai/agent";

export type ProposalPaymentMethod = "online" | "cod";

/** Stored on the session between the proposal message and the Confirm tap. */
export type OrderProposal = {
  cart: CartItem[];
  itemsSubtotal: number;
  total: number;
  deliveryDate: string;
  slotKind: DeliverySlotKind;
  slotStartIso: string;
  address: string;
  paymentMethod: ProposalPaymentMethod;
  createdAt: string;
};

/** What the model extracted. Every field optional — we ask for what's missing. */
export type ProposalDraft = {
  items?: { dish?: string; size?: string; quantity?: number }[];
  date?: string;
  time?: string;
  slot?: string;
  address?: string;
  payment?: string;
};

export type MissingField = "dish" | "size" | "date" | "slot" | "address" | "payment";

export type ProposalResult =
  | { ok: true; proposal: OrderProposal }
  | { ok: false; kind: "missing"; field: MissingField; dishOptions?: MenuItem[] }
  | { ok: false; kind: "rejected"; reason: string };

// ─── Dish matching ───────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "me", "my", "order", "please", "want", "need", "gm", "kg",
  "500gm", "500g", "1kg", "one", "two", "three", "of", "for", "and", "with",
]);

function tokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Fuzzy dish match by shared words, best score first. Deliberately not a
 * substring test: "chicken gravy" has to be able to surface all five chicken
 * gravies so we can ask which one rather than silently pick.
 */
export function searchMenuDishes(menu: MenuItem[], query: string, limit = 10): MenuItem[] {
  const q = tokens(query);
  if (q.length === 0) return [];

  const scored = menu.map((item) => {
    const words = new Set(tokens(item.name));
    let score = 0;
    for (const t of q) {
      if (words.has(t)) score += 2;
      else if ([...words].some((w) => w.startsWith(t) || t.startsWith(w))) score += 1;
    }
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}

// ─── When → slot ─────────────────────────────────────────────────────────────

/**
 * Slot windows come from DELIVERY_SLOT_DEFS: breakfast 7–9 AM, lunch 12–2 PM,
 * dinner 7–9 PM. 8 PM lands in dinner.
 */
export function slotKindForHour(hour: number): DeliverySlotKind {
  if (!Number.isFinite(hour)) return "lunch";
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

export function parseSlotWord(text: string): DeliverySlotKind | null {
  const t = String(text || "").toLowerCase();
  if (/breakfast|morning|காலை/.test(t)) return "breakfast";
  if (/lunch|noon|afternoon|மதிய/.test(t)) return "lunch";
  if (/dinner|night|evening|இரவ/.test(t)) return "dinner";
  if (isValidSlotKind(t)) return t;
  return null;
}

/** "8pm", "20:00", "8 in the evening" → hour of day, or null. */
export function parseHour(text: string): number | null {
  const t = String(text || "").toLowerCase();

  const ampm = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    if (h < 1 || h > 12) return null;
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return h;
  }

  const h24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return parseInt(h24[1], 10);

  const bare = t.match(/\b(\d{1,2})\s*o'?clock\b/);
  if (bare) {
    const h = parseInt(bare[1], 10);
    if (h >= 1 && h <= 12) return /night|evening/.test(t) && h !== 12 ? h + 12 : h;
  }
  return null;
}

/** "tomorrow", "naalai", "monday", "2026-09-06" → IST calendar date. */
export function parseDateText(text: string): string | null {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return null;

  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const today = istCalendarYmd();
  if (/\b(today|innaiku|inniku)\b/.test(t)) return today;
  if (/\b(tomorrow|tomo|tmr|tmrw|naalai|nalai|naalaiku)\b/.test(t)) return istAddCalendarDays(today, 1);
  if (/\b(day after tomorrow|day after|naalaimarunaal)\b/.test(t)) return istAddCalendarDays(today, 2);

  const days: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6,
  };
  for (const [word, target] of Object.entries(days)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      const current = new Date().getDay();
      let diff = target - current;
      if (diff <= 0) diff += 7;
      return istAddCalendarDays(today, diff);
    }
  }
  return null;
}

export function parsePackSize(text: string): PackSize | null {
  const t = String(text || "").toLowerCase().replace(/\s+/g, "");
  if (/1kg|onekg|1kilo|full/.test(t)) return "1kg";
  if (/500g|500gm|halfkg|½kg|1\/2kg/.test(t)) return "500gm";
  return null;
}

export function parsePaymentMethod(text: string): ProposalPaymentMethod | null {
  const t = String(text || "").toLowerCase();
  if (/\b(cod|cash|kaiyila|door)\b/.test(t)) return "cod";
  if (/\b(online|upi|card|gpay|phonepe|razorpay|net\s*banking)\b/.test(t)) return "online";
  return null;
}

// ─── Building the proposal ───────────────────────────────────────────────────

export type BuildProposalInput = {
  menu: MenuItem[];
  draft: ProposalDraft;
  /** Reused when the draft doesn't name one. */
  lastAddress?: string | null;
  lastSlotKind?: DeliverySlotKind | null;
};

/**
 * Server-side pricing and rule checks. Prices come from dish-pricing, never
 * from the draft, the catalog, or the session — the model is not allowed to
 * influence what anything costs.
 */
export function buildProposal(input: BuildProposalInput): ProposalResult {
  const { menu, draft } = input;

  const rawItems = (draft.items || []).filter((i) => i && String(i.dish || "").trim());
  if (rawItems.length === 0) {
    return { ok: false, kind: "missing", field: "dish" };
  }

  const cart: CartItem[] = [];
  for (const raw of rawItems.slice(0, WA_CART_MAX)) {
    const matches = searchMenuDishes(menu, String(raw.dish));
    if (matches.length === 0) {
      return { ok: false, kind: "missing", field: "dish" };
    }
    // Two plausible dishes is a question, not a guess.
    if (matches.length > 1 && tokens(String(raw.dish)).length < 3) {
      const tight = matches.filter(
        (m) => m.name.toLowerCase() === String(raw.dish).toLowerCase().trim(),
      );
      if (tight.length !== 1) {
        return { ok: false, kind: "missing", field: "dish", dishOptions: matches.slice(0, 8) };
      }
    }
    const item = matches[0];

    const size = parsePackSize(String(raw.size || "")) ?? parsePackSize(String(draft.items?.[0]?.size || ""));
    if (!size) {
      return { ok: false, kind: "missing", field: "size", dishOptions: [item] };
    }

    const quantity = Math.max(1, Math.min(10, Math.floor(Number(raw.quantity) || 1)));
    const unitPrice = unitPriceFor(item, size);
    if (unitPrice <= 0) {
      return { ok: false, kind: "rejected", reason: "We could not price that dish. Please pick it from the menu." };
    }

    const existing = cart.find((c) => c.menu_item_id === item.id && c.variant === size);
    if (existing) existing.quantity = Math.min(10, existing.quantity + quantity);
    else {
      cart.push({
        menu_item_id: item.id,
        name: item.name,
        variant: size,
        quantity,
        unit_price: unitPrice,
      });
    }
  }

  if (cart.length === 0) return { ok: false, kind: "missing", field: "dish" };
  if ((draft.items || []).length > WA_CART_MAX) {
    return {
      ok: false,
      kind: "rejected",
      reason: `WhatsApp orders hold up to ${WA_CART_MAX} dishes. Install the app for a bigger order.`,
    };
  }

  const slotKind =
    parseSlotWord(String(draft.slot || "")) ??
    (() => {
      const hour = parseHour(String(draft.time || ""));
      return hour == null ? null : slotKindForHour(hour);
    })() ??
    input.lastSlotKind ??
    null;
  if (!slotKind) return { ok: false, kind: "missing", field: "slot" };

  const deliveryDate = parseDateText(String(draft.date || "")) ?? parseDateText(String(draft.time || ""));
  if (!deliveryDate) return { ok: false, kind: "missing", field: "date" };

  const slotStartIso = slotStartIsoFor(deliveryDate, slotKind);
  if (!isSlotBookable(slotStartIso)) {
    const def = DELIVERY_SLOT_DEFS[slotKind];
    return {
      ok: false,
      kind: "rejected",
      reason: `${def.label} on that day is inside our 24-hour window. Everything is cooked to order, so pick a later day.`,
    };
  }

  const address = String(draft.address || "").trim() || String(input.lastAddress || "").trim();
  if (address.length < 5) return { ok: false, kind: "missing", field: "address" };

  const itemsSubtotal = cartItemsSubtotal(cart);
  const total = cartGrandTotal(cart);

  const paymentMethod = parsePaymentMethod(String(draft.payment || ""));
  if (!paymentMethod) return { ok: false, kind: "missing", field: "payment" };
  if (paymentMethod === "cod" && !isCodAllowedForTotal(total)) {
    return {
      ok: false,
      kind: "rejected",
      reason: "Cash on delivery stops at ₹2,000. This one needs paying online.",
    };
  }

  return {
    ok: true,
    proposal: {
      cart,
      itemsSubtotal,
      total,
      deliveryDate,
      slotKind,
      slotStartIso,
      address,
      paymentMethod,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * A stored proposal is only good while its slot is still 24 hours out — a
 * customer who taps Confirm the next morning must not slip past the rule.
 */
export function isProposalStillValid(proposal: OrderProposal | null | undefined): boolean {
  if (!proposal?.slotStartIso || !proposal.cart?.length) return false;
  if (!isSlotBookable(proposal.slotStartIso)) return false;
  if (proposal.paymentMethod === "cod" && !isCodAllowedForTotal(proposal.total)) return false;
  return true;
}

/** Re-price a stored proposal before writing it, so a menu change can't slip through. */
export function repriceProposal(proposal: OrderProposal, menu: MenuItem[]): OrderProposal {
  const cart = proposal.cart.map((line) => {
    const item = menu.find((m) => m.id === line.menu_item_id);
    const size: PackSize = line.variant === "1kg" ? "1kg" : "500gm";
    const source = item ?? { id: line.menu_item_id, name: line.name, price: null };
    const resolved = resolveDishPricing(source);
    const unitPrice = resolved ? resolved.dish.prices[size] : unitPriceFor(source, size);
    return { ...line, unit_price: unitPrice > 0 ? unitPrice : line.unit_price };
  });
  return {
    ...proposal,
    cart,
    itemsSubtotal: cartItemsSubtotal(cart),
    total: cartGrandTotal(cart),
  };
}
