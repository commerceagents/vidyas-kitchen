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
  istWeekdayIndex,
  slotStartIsoFor,
  DELIVERY_SLOT_DEFS,
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import { nextBookableDateForKind } from "@/lib/whatsapp-last-order";
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
  | {
      ok: false;
      kind: "rejected";
      reason: string;
      code?: "too_soon";
      tooSoon?: { label: string; when: string; range: string };
    };

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
const CATEGORY_WORDS = new Set(["chicken", "mutton", "egg"]);
/** Words that mean the family, not a dish we failed to find. */
const FAMILY_WORDS = new Set([
  "gravy",
  "gravies",
  "curry",
  "curries",
  "dish",
  "dishes",
  "food",
  "meal",
  "meals",
]);

/**
 * "1 mutton gravy, 500gm, tomorrow dinner" is an order for a family we cook.
 * "mutton tandoori" is a dish we don't, and stays a missing-dish reply.
 */
export function bareCategoryOrder(menu: MenuItem[], query: string): "chicken" | "mutton" | "egg" | null {
  const category = dishQueryCategory(query);
  if (!category || mentionsKnownDish(menu, query)) return null;
  const filler = new Set(["to", "it", "on", "at", "in", "is", "be", "do", "so", "up", "we", "us"]);
  const extra = tokens(query).filter(
    (w) => !CATEGORY_WORDS.has(w) && !FAMILY_WORDS.has(w) && !filler.has(w),
  );
  const specific = extra.filter(
    (w) => !/^(tomorrow|today|tonight|dinner|lunch|breakfast|night|evening|morning|noon)$/.test(w),
  );
  if (specific.length === 0) return category;
  const pool = menu.filter((item) => (item.category || "").toLowerCase() === category);
  const named = specific.every((w) =>
    pool.some((item) => tokens(item.name).some((n) => n.startsWith(w) || w.startsWith(n))),
  );
  return named ? category : null;
}

export function dishQueryCategory(query: string): "chicken" | "mutton" | "egg" | null {
  const t = String(query || "").toLowerCase();
  if (/\bchicken\b/.test(t)) return "chicken";
  if (/\bmutton\b/.test(t)) return "mutton";
  if (/\begg\b/.test(t)) return "egg";
  return null;
}

/**
 * The phrase we match on. The model is told to store the family as "chicken",
 * which drops "gravy" and then ranks wings. The customer's own words win.
 */
function stylePhrase(family: "chicken" | "mutton" | "egg", text: string): string | null {
  const style = text.match(/\b(gravy|gravies|curry|curries|wings?|dry|chukka)\b/i);
  if (!style) return null;
  const word = style[1].toLowerCase();
  if (word.startsWith("grav")) return `${family} gravy`;
  if (word.startsWith("curr")) return `${family} curry`;
  if (word.startsWith("wing")) return `${family} wings`;
  return `${family} ${word}`;
}

const ORDER_FILLER = new Set([
  "to", "it", "on", "at", "in", "is", "be", "do", "so", "up", "we", "us",
  "like", "would", "can", "get", "send", "book", "place", "start", "make",
  "tomorrow", "today", "tonight", "tomo", "tmr", "tmrw", "naalai", "nalai",
  "dinner", "lunch", "breakfast", "night", "evening", "morning", "noon",
  "cash", "cod", "online", "upi", "card",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
]);

/** Words that pick one dish out of a family: "black pepper", not just "chicken gravy". */
function identifyingWords(text: string): string[] {
  return tokens(text).filter((word) => {
    if (CATEGORY_WORDS.has(word) || FAMILY_WORDS.has(word) || ORDER_FILLER.has(word)) return false;
    if (/^\d/.test(word)) return false;
    return true;
  });
}

function withIdentifyingWords(
  spoken: string,
  draftDish: string,
  family: "chicken" | "mutton" | "egg",
  style: string,
): string {
  const spokenIds = identifyingWords(spoken);
  const ids = spokenIds.length > 0 ? spokenIds : identifyingWords(draftDish);
  if (ids.length === 0) return `${family} ${style}`;
  return `${ids.join(" ")} ${family} ${style}`.replace(/\s+/g, " ").trim();
}

export function dishChoiceQuery(draftDish: string, source?: string | null): string {
  const spoken = String(source || "").trim();
  const spokenFamily = dishQueryCategory(spoken);
  const draftFamily = dishQueryCategory(draftDish);
  // "mutton dish" must not inherit "gravy" or "chicken" from the previous draft.
  if (spokenFamily && draftFamily && spokenFamily !== draftFamily) {
    return stylePhrase(spokenFamily, spoken) || spokenFamily;
  }
  const blob = `${spoken} ${draftDish}`.replace(/\s+/g, " ").trim();
  const family = spokenFamily || draftFamily;
  if (family && /\b(gravy|gravies)\b/i.test(blob)) return withIdentifyingWords(spoken, draftDish, family, "gravy");
  if (family && /\b(curry|curries)\b/i.test(blob)) return withIdentifyingWords(spoken, draftDish, family, "curry");
  if (family && /\bwings?\b/i.test(blob)) return withIdentifyingWords(spoken, draftDish, family, "wings");
  if (family && /\bdry\b/i.test(blob)) return withIdentifyingWords(spoken, draftDish, family, "dry");
  if (spokenFamily && !String(draftDish || "").trim()) return spokenFamily;
  return String(draftDish || spoken).trim();
}

/** A new family in this message replaces the leftover dish. "mutton dish" drops chicken gravy. */
export function applySpokenFamily(draft: ProposalDraft, source?: string | null): ProposalDraft {
  const spokenFamily = dishQueryCategory(String(source || ""));
  if (!spokenFamily) return draft;
  const items = draft.items?.length ? draft.items : [{ dish: spokenFamily }];
  const draftDish = items.map((item) => item.dish).filter(Boolean).join(" ");
  if (dishQueryCategory(draftDish) === spokenFamily && dishChoiceQuery(draftDish, source) === draftDish.trim()) {
    return draft;
  }
  const nextDish = dishChoiceQuery(draftDish, source);
  if (!nextDish || nextDish === draftDish.trim()) return draft;
  return {
    ...draft,
    items: items.map((item, index) => (index === 0 ? { ...item, dish: nextDish } : item)),
  };
}

/**
 * True when the words that are not just a category actually appear on a dish.
 * "chicken wings" is known. "chicken tandoori" and "biryani" are not.
 */
/** A real menu dish is named in the sentence, even if a day or a quantity is there too. */
export function mentionsKnownDish(menu: MenuItem[], query: string): boolean {
  const q = tokens(query);
  if (q.length === 0) return false;
  return searchMenuDishes(menu, query).some((item) => {
    const nameWords = tokens(item.name).filter((w) => !CATEGORY_WORDS.has(w));
    return nameWords.length > 0 && nameWords.every((w) => q.some((t) => t.startsWith(w) || w.startsWith(t)));
  });
}

export function isKnownDishQuery(menu: MenuItem[], query: string): boolean {
  const words = tokens(query).filter((w) => !CATEGORY_WORDS.has(w));
  if (words.length === 0) return dishQueryCategory(query) != null;
  return searchMenuDishes(menu, words.join(" ")).some((item) => {
    const name = tokens(item.name);
    return words.every((w) => name.some((n) => n.startsWith(w) || w.startsWith(n)));
  });
}

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

  const monthNames =
    "january|february|march|april|june|july|august|september|october|november|december|sept|sep|oct|nov|dec|jan|feb|mar|apr|jun|jul|aug|may";
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
    jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const dayMonth = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${monthNames})\\b`));
  const monthDay = t.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const day = dayMonth ? Number(dayMonth[1]) : monthDay ? Number(monthDay[2]) : NaN;
  const monthWord = dayMonth ? dayMonth[2] : monthDay ? monthDay[1] : "";
  const month = months[monthWord];
  if (month && day >= 1 && day <= 31) {
    const year = Number(today.slice(0, 4));
    const pad = (n: number) => String(n).padStart(2, "0");
    let ymd = `${year}-${pad(month)}-${pad(day)}`;
    const stamped = new Date(`${ymd}T12:00:00+05:30`);
    if (stamped.getUTCDate() !== day) return null;
    if (isPastIstDate(ymd, today)) ymd = `${year + 1}-${pad(month)}-${pad(day)}`;
    return ymd;
  }

  const days: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6,
  };
  for (const [word, target] of Object.entries(days)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      const current = istWeekdayIndex();
      let diff = target - current;
      if (diff <= 0) diff += 7;
      return istAddCalendarDays(today, diff);
    }
  }
  return null;
}

/** A calendar day before today in IST. Lexicographic compare works for YYYY-MM-DD. */
export function isPastIstDate(ymd: string, today = istCalendarYmd()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd < today;
}

/**
 * The day named in this message wins. A stored date from an older session
 * (for example 11 June, still sitting on the draft) is ignored once the
 * customer has said tomorrow, and a past date is never "already noted".
 */
export function notedDeliveryDate(
  draft: ProposalDraft,
  source?: string | null,
  today = istCalendarYmd(),
): string | null {
  const spoken = source ? parseDateText(source) : null;
  if (spoken && !isPastIstDate(spoken, today)) return spoken;
  const stored = parseDateText(String(draft.date || "")) || parseDateText(String(draft.time || ""));
  if (stored && !isPastIstDate(stored, today)) return stored;
  return null;
}

/**
 * A size in this message wins. A new dish sentence that never names 500gm or
 * 1kg drops a size left over from an earlier turn, so we ask again.
 */
export function applySpokenSize(draft: ProposalDraft, source?: string | null): ProposalDraft {
  const spoken = source ? parsePackSize(source) : null;
  if (spoken) {
    return {
      ...draft,
      items: (draft.items || []).map((item) => ({ ...item, size: spoken })),
    };
  }
  const freshDish = dishQueryCategory(String(source || "")) != null || /\b(gravy|gravies|curry|curries|wings?|dry)\b/i.test(String(source || ""));
  if (!freshDish) return draft;
  return {
    ...draft,
    items: (draft.items || []).map((item) => {
      const next = { ...item };
      delete next.size;
      return next;
    }),
  };
}

/**
 * Date, size, slot, and payment named in this sentence overwrite leftovers.
 * "8th oct lunch, cash" must not keep yesterday's dinner slot.
 */
export function applySpokenCheckout(draft: ProposalDraft, source?: string | null): ProposalDraft {
  const text = String(source || "");
  let next = applySpokenSize(applySpokenDate(draft, text), text);
  const slot = parseSlotWord(text);
  if (slot) next = { ...next, slot };
  const pay = parsePaymentMethod(text);
  if (pay) next = { ...next, payment: pay === "cod" ? "cash" : "online" };
  return next;
}

/** Write the noted day onto the draft, and drop a leftover past date. */
export function applySpokenDate(draft: ProposalDraft, source?: string | null): ProposalDraft {
  const date = notedDeliveryDate(draft, source);
  if (!date) {
    const stored = parseDateText(String(draft.date || ""));
    if (stored && isPastIstDate(stored)) {
      const next = { ...draft };
      delete next.date;
      return next;
    }
    return draft;
  }
  if (draft.date === date) return draft;
  return { ...draft, date };
}

/**
 * Fill sensible defaults so a returning customer can reach Confirm after
 * picking a dish and size — last slot/address/payment, else lunch tomorrow COD.
 */
export function applyFastLaneDefaults(
  draft: ProposalDraft,
  hints: {
    lastAddress?: string | null;
    lastSlotKind?: DeliverySlotKind | null;
    lastPayment?: "online" | "cod" | null;
  },
): ProposalDraft {
  const next: ProposalDraft = {
    ...draft,
    items: (draft.items || []).map((item) => ({ ...item })),
  };

  const slotKind =
    parseSlotWord(String(next.slot || "")) ||
    (() => {
      const hour = parseHour(String(next.time || ""));
      return hour == null ? null : slotKindForHour(hour);
    })() ||
    hints.lastSlotKind ||
    "lunch";

  if (!parseSlotWord(String(next.slot || "")) && parseHour(String(next.time || "")) == null) {
    next.slot = slotKind;
  }

  if (!notedDeliveryDate(next)) {
    const bookable = nextBookableDateForKind(slotKind);
    if (bookable) next.date = bookable.ymd;
  }

  if (String(next.address || "").trim().length < 5 && hints.lastAddress && hints.lastAddress.trim().length >= 5) {
    next.address = hints.lastAddress.trim();
  }

  if (!parsePaymentMethod(String(next.payment || ""))) {
    if (hints.lastPayment === "online") next.payment = "online";
    else next.payment = "cash";
  }

  return next;
}

export function parsePackSize(text: string): PackSize | null {
  const t = String(text || "").toLowerCase();
  // Keep the quantity digit separate from the size: "1 500gm" is 500gm, not 1500g.
  if (/\b(?:1\s*(?:kg|kgs|kilo|kilograms?)|one\s*kg|full)\b/.test(t)) return "1kg";
  if (/\b(?:500\s*(?:g|gm|gms|grams?)|half\s*kg|½\s*kg|1\s*\/\s*2\s*kg)\b/.test(t)) return "500gm";
  return null;
}

const QTY_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const QTY_TOKEN = "one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2}";
const PACK_TOKEN = "500\\s*(?:g|gm|gms|grams?)?|half\\s*kg|1\\s*(?:kg|kgs|kilo|kilogram)";
/** Words that can sit between a size and a count: "500gm in two quantities". */
const PACK_GAP =
  "(?:\\s+|[-–—:x×]|\\b(?:in|of|for|a|an|the|qty|quantity|quantities|packs?)\\b)*";

function quantityToken(raw: string): number | null {
  const t = String(raw || "").toLowerCase().trim();
  if (/^\d{1,2}$/.test(t)) return parseInt(t, 10);
  return QTY_WORDS[t] ?? null;
}

function packToken(raw: string): PackSize | null {
  const t = String(raw || "").toLowerCase().replace(/\s+/g, "");
  if (/^1(?:kg|kgs|kilo|kilogram)$/.test(t)) return "1kg";
  if (/^500(?:g|gm|gms|grams?)?$/.test(t) || t === "halfkg") return "500gm";
  return null;
}

/** "4", "four", "I need four quantity" — pack sizes are not quantities. */
export function parseSpokenQuantity(text: string): number | null {
  const stripped = String(text || "")
    .toLowerCase()
    .replace(new RegExp(`\\b(?:${PACK_TOKEN})\\b`, "g"), " ");
  const digit = stripped.match(/\b(\d{1,2})\b/);
  if (digit) return parseInt(digit[1], 10);
  for (const [word, n] of Object.entries(QTY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(stripped)) return n;
  }
  return null;
}

export type PackQuantity = { size: PackSize; quantity: number };

/**
 * "500gm 2 and 1kg 1", "2 of 500gm and 1 of 1kg", "500 - 2 quantity and 1kg - 1".
 * Empty when the line names no pack.
 */
export function parsePackQuantities(text: string): PackQuantity[] {
  const clauses = String(text || "")
    .toLowerCase()
    .split(/\band\b|,|&/i);
  const found: PackQuantity[] = [];
  const sizeThenQty = new RegExp(`\\b(${PACK_TOKEN})${PACK_GAP}(${QTY_TOKEN})\\b`, "i");
  const qtyThenSize = new RegExp(`\\b(${QTY_TOKEN})${PACK_GAP}(${PACK_TOKEN})\\b`, "i");
  for (const clause of clauses) {
    const sizeFirst = clause.match(sizeThenQty);
    const qtyFirst = clause.match(qtyThenSize);
    const hit = sizeFirst
      ? { size: packToken(sizeFirst[1]), quantity: quantityToken(sizeFirst[2]) }
      : qtyFirst
        ? { size: packToken(qtyFirst[2]), quantity: quantityToken(qtyFirst[1]) }
        : null;
    if (hit?.size && hit.quantity != null && hit.quantity >= 1) found.push({ size: hit.size, quantity: hit.quantity });
  }
  const merged = new Map<PackSize, number>();
  for (const row of found) merged.set(row.size, (merged.get(row.size) || 0) + row.quantity);
  return [...merged.entries()].map(([size, quantity]) => ({ size, quantity }));
}

export function parsePaymentMethod(text: string): ProposalPaymentMethod | null {
  const t = String(text || "").toLowerCase();
  if (/\b(cod|cash|kaiyila|door)\b/.test(t)) return "cod";
  if (/\b(online|upi|card|gpay|phonepe|razorpay|net\s*banking)\b/.test(t)) return "online";
  return null;
}

function draftHasSlot(draft: ProposalDraft, lastSlotKind?: DeliverySlotKind | null): boolean {
  if (parseSlotWord(String(draft.slot || ""))) return true;
  if (parseHour(String(draft.time || "")) != null) return true;
  if (parseSlotWord(String(draft.time || ""))) return true;
  return Boolean(lastSlotKind && isValidSlotKind(lastSlotKind));
}

function draftHasDate(draft: ProposalDraft): boolean {
  return Boolean(notedDeliveryDate(draft));
}

function itemHasSize(item: { dish?: string; size?: string }): boolean {
  return Boolean(parsePackSize(String(item.size || "")) || parsePackSize(String(item.dish || "")));
}

/** Every gap still open on a draft, in the order we would have asked them. */
export function listDraftGaps(
  draft: ProposalDraft,
  hints?: { lastAddress?: string | null; lastSlotKind?: DeliverySlotKind | null },
): MissingField[] {
  const items = (draft.items || []).filter((i) => String(i?.dish || "").trim());
  if (items.length === 0) return ["dish"];

  const gaps: MissingField[] = [];
  if (items.some((item) => !itemHasSize(item))) gaps.push("size");
  if (!draftHasSlot(draft, hints?.lastSlotKind)) gaps.push("slot");
  if (!draftHasDate(draft)) gaps.push("date");
  const address = String(draft.address || "").trim() || String(hints?.lastAddress || "").trim();
  if (address.length < 5) gaps.push("address");
  if (!parsePaymentMethod(String(draft.payment || ""))) gaps.push("payment");
  return gaps;
}

function addressClause(text: string): string | null {
  const parts = text.split(/,|\band\b/i).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (parsePackSize(part) || parsePaymentMethod(part) || parseDateText(part)) continue;
    if (parseSlotWord(part) || parseHour(part) != null) continue;
    if (/\b(same|usual)\b/i.test(part)) continue;
    if (part.length >= 8 && /[0-9]|\broad\b|\bstreet\b|\bnagar\b|\blane\b|\bflat\b|\bapartment\b/i.test(part)) {
      return part;
    }
  }
  return null;
}

/**
 * One reply can fill every open gap: "1kg, same, cash".
 * Returns the same draft when the line didn't add anything.
 */
export function fillDraftFromReply(
  draft: ProposalDraft,
  text: string,
  lastAddress?: string | null,
): { draft: ProposalDraft; changed: boolean } {
  const next: ProposalDraft = {
    ...draft,
    items: (draft.items || []).map((item) => ({ ...item })),
  };
  let changed = false;

  const size = parsePackSize(text);
  if (size && (next.items || []).some((item) => !itemHasSize(item))) {
    next.items = (next.items || []).map((item) => (itemHasSize(item) ? item : { ...item, size }));
    changed = true;
  }

  const pay = parsePaymentMethod(text);
  if (pay && !parsePaymentMethod(String(next.payment || ""))) {
    next.payment = pay;
    changed = true;
  }

  const date = parseDateText(text);
  if (date && !isPastIstDate(date) && next.date !== date) {
    next.date = date;
    changed = true;
  }

  if (!draftHasSlot(next)) {
    const slot = parseSlotWord(text);
    const hour = parseHour(text);
    if (slot) {
      next.slot = slot;
      changed = true;
    } else if (hour != null) {
      next.time = text;
      changed = true;
    }
  }

  if (String(next.address || "").trim().length < 5) {
    if (/\b(same|usual|last address|same address|same place)\b/i.test(text) && lastAddress && lastAddress.trim().length >= 5) {
      next.address = lastAddress.trim();
      changed = true;
    } else {
      const addr = addressClause(text);
      if (addr) {
        next.address = addr;
        changed = true;
      }
    }
  }

  return { draft: next, changed };
}

// ─── Building the proposal ───────────────────────────────────────────────────

export type BuildProposalInput = {
  menu: MenuItem[];
  draft: ProposalDraft;
  /** Full user line — size is often here even when the model left `size` empty. */
  sourceText?: string | null;
  /** Reused when the draft doesn't name one. */
  lastAddress?: string | null;
  lastSlotKind?: DeliverySlotKind | null;
};

/** Extra words beyond a bare dish name — send the whole line through AI. */
export function looksLikeCompoundOrder(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  if (parsePackSize(t) || parseDateText(t) || parseHour(t) || parseSlotWord(t)) return true;
  if (/\b(\d+)\s*(x|qty|packs?|plates?)\b/i.test(t)) return true;
  return t.split(/\s+/).filter(Boolean).length >= 5;
}

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
    const named = identifyingWords(String(raw.dish));
    let covering = named.length
      ? matches.filter((item) => {
          const name = tokens(item.name);
          return named.every((word) => name.some((part) => part.startsWith(word) || word.startsWith(part)));
        })
      : matches;
    const tight = matches.filter((m) => m.name.toLowerCase() === String(raw.dish).toLowerCase().trim());
    if (tight.length === 1) covering = tight;
    // "black pepper" is one dish. "chicken gravy" is the whole family.
    if (covering.length !== 1) {
      const bareFamily = named.length === 0 && matches.length > 1 && tokens(String(raw.dish)).length < 3;
      const namedButUnclear = named.length > 0;
      if (bareFamily || namedButUnclear) {
        return {
          ok: false,
          kind: "missing",
          field: "dish",
          dishOptions: (covering.length > 0 ? covering : matches).slice(0, 8),
        };
      }
    }
    const item = covering[0] || matches[0];

    const size =
      parsePackSize(String(raw.size || "")) ??
      parsePackSize(String(raw.dish || "")) ??
      parsePackSize(String(input.sourceText || ""));
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

  const deliveryDate = notedDeliveryDate(draft, input.sourceText);
  if (!deliveryDate) return { ok: false, kind: "missing", field: "date" };

  const slotStartIso = slotStartIsoFor(deliveryDate, slotKind);
  if (!isSlotBookable(slotStartIso)) {
    const def = DELIVERY_SLOT_DEFS[slotKind];
    const when = new Date(`${deliveryDate}T12:00:00+05:30`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
    return {
      ok: false,
      kind: "rejected",
      code: "too_soon",
      reason: `${def.label} on ${when} (${def.rangeLabel}) is too soon.`,
      tooSoon: { label: def.label, when, range: def.rangeLabel },
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
