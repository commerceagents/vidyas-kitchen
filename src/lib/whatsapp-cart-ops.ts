/**
 * Cart edits are decided here, then applied to the session cart.
 * The model may name an action and a phrase the customer used. It does not
 * return a new cart. Matching and the resulting lines live in this file.
 */

import type { CartItem } from "./whatsapp-cart";
import { formatFullDishName } from "./dish-name";

export type CartActionName =
  | "add_item"
  | "remove_item"
  | "update_qty"
  | "clear_cart"
  | "checkout"
  | "ask_menu"
  | "ask_status"
  | "unclear";

export type CartIntent = {
  action: CartActionName;
  item_reference: string;
  quantity: number | null;
};

const ACTIONS = new Set<CartActionName>([
  "add_item",
  "remove_item",
  "update_qty",
  "clear_cart",
  "checkout",
  "ask_menu",
  "ask_status",
  "unclear",
]);

/** Words that describe the edit, not the dish. */
const FILLER = new Set([
  "i", "id", "im", "want", "wanna", "would", "like", "please", "pls", "plz",
  "to", "the", "a", "an", "and", "my", "me", "you", "u", "ur", "can", "just", "only", "alone",
  "remove", "delete", "drop", "take", "off", "out", "from", "cart", "item",
  "dish", "dont", "don", "not", "do", "need", "get", "rid", "of", "that",
  "this", "one", "it", "also", "too", "please", "kindly", "hey", "hi",
]);

/** Shared across many gravies. A match on only these words is not enough to pick one line. */
const SHARED = new Set([
  "chicken", "mutton", "egg", "gravy", "recipe", "curry", "masala", "special", "dry", "fry",
]);

const ALIASES: Record<string, string> = {
  moms: "mom",
  mum: "mom",
  mums: "mom",
  mummy: "mom",
  mother: "mom",
  mothers: "mom",
  mama: "mom",
  amma: "mom",
  sis: "sister",
  sisters: "sister",
  akka: "sister",
};

export type CartMatch = {
  hits: CartItem[];
  ambiguous: boolean;
};

function tokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

function canon(token: string): string {
  if (ALIASES[token]) return ALIASES[token];
  if (token.endsWith("s") && token.length > 4) {
    const stem = token.slice(0, -1);
    return ALIASES[stem] || stem;
  }
  return token;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const upper = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = cost === 0 ? corner : 1 + Math.min(corner, upper, prev[j - 1]);
      corner = upper;
    }
  }
  return prev[b.length];
}

function tokenHit(query: string, nameToken: string): number {
  const q = canon(query);
  const n = canon(nameToken);
  if (!q || !n) return 0;
  if (q === n) return 3;
  const shorter = Math.min(q.length, n.length);
  const longer = Math.max(q.length, n.length);
  if (shorter >= 3 && (q.startsWith(n) || n.startsWith(q)) && shorter / longer >= 0.6) return 2;
  if (q.length >= 4 && n.length >= 4 && levenshtein(q, n) <= 1) return 2;
  return 0;
}

function lineKey(line: CartItem): string {
  return `${line.menu_item_id}::${line.variant}`;
}

export function matchCartLines(cart: CartItem[], reference: string): CartMatch {
  const q = tokens(reference).filter((t) => !FILLER.has(t));
  if (q.length === 0) {
    if (cart.length === 1) return { hits: cart.slice(), ambiguous: false };
    return { hits: cart.slice(), ambiguous: cart.length > 1 };
  }

  const scored = cart.map((line) => {
    const nameTokens = tokens(`${line.name} ${line.variant}`);
    let score = 0;
    let distinctive = 0;
    for (const qt of q) {
      let best = 0;
      for (const nt of nameTokens) best = Math.max(best, tokenHit(qt, nt));
      score += best;
      if (best > 0 && !SHARED.has(canon(qt))) distinctive += best;
    }
    return { line, score, distinctive };
  });

  const distinctiveQuery = q.filter((t) => !SHARED.has(canon(t)));
  const bestDistinctive = Math.max(0, ...scored.map((s) => s.distinctive));
  // "wings" is a real dish word. If nothing in the cart has it, do not fall
  // back to every line that merely shares "chicken".
  if (distinctiveQuery.length > 0 && bestDistinctive === 0) return { hits: [], ambiguous: false };

  const pool =
    bestDistinctive > 0
      ? scored.filter((s) => s.distinctive === bestDistinctive && s.score > 0)
      : scored.filter((s) => s.score > 0 && s.score === Math.max(...scored.map((x) => x.score)));

  if (pool.length === 0) return { hits: [], ambiguous: false };
  if (pool.length === 1) return { hits: [pool[0].line], ambiguous: false };
  return { hits: pool.map((p) => p.line), ambiguous: true };
}

export function removeLines(cart: CartItem[], hits: CartItem[]): CartItem[] {
  const keys = new Set(hits.map(lineKey));
  return cart.filter((line) => !keys.has(lineKey(line)));
}

export function setLineQty(cart: CartItem[], hit: CartItem, quantity: number): CartItem[] {
  const key = lineKey(hit);
  return cart.map((line) => (lineKey(line) === key ? { ...line, quantity } : line));
}

const REMOVE_RE =
  /\b(remov\w*|delet\w*|drop\w*|scratch\w*)\b|\btake\b.+\b(off|out)\b|\b(don'?t|do not) want\b|\bget rid of\b|\bwithout\b|\bno more\b/i;
const CLEAR_RE = /\b(clear cart|empty cart|remove all|delete all|clear everything|start over)\b/i;
const CHECKOUT_RE = /\b(checkout|check out|place the order|place order)\b/i;
const UPDATE_RE = /\b(change|update|make|set)\b/i;
const QTY_RE = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|quantity|qty)\b/i;

function stripReference(text: string): string {
  return text
    .replace(
      /\b(i|want|wanna|would|like|please|pls|to|the|a|an|and|my|me|you|u|ur|can|just|only|alone|remov\w*|delet\w*|drop\w*|scratch\w*|take|off|out|from|cart|item|dish|don'?t|do|not|need|get|rid|of|that|this|one|it|also|too|kindly|change|update|make|set|quantity|qty|without|no|more)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Obvious edits, with no model call. Null when the sentence is not a cart edit. */
export function localCartIntent(text: string): CartIntent | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (CLEAR_RE.test(raw)) return { action: "clear_cart", item_reference: "", quantity: null };
  if (CHECKOUT_RE.test(raw) && !REMOVE_RE.test(raw)) {
    return { action: "checkout", item_reference: "", quantity: null };
  }
  if (REMOVE_RE.test(raw)) {
    return { action: "remove_item", item_reference: stripReference(raw), quantity: null };
  }
  if (UPDATE_RE.test(raw) && QTY_RE.test(raw)) {
    return { action: "update_qty", item_reference: stripReference(raw), quantity: null };
  }
  return null;
}

export function looksLikeCartEdit(text: string): boolean {
  return (
    localCartIntent(text) != null ||
    planScopedCartEdit(text) != null ||
    /\b(minus|without|no more|leave out|hold the)\b/i.test(text)
  );
}

const SIZE_SRC = "1\\s*kg|500\\s*g(?:m|ms|rams?)?|half\\s*kg";

export type ScopedCartEdit = {
  itemReference: string;
  removeSize: "500gm" | "1kg" | null;
  keep: { size: "500gm" | "1kg"; quantity: number } | null;
};

function sizeToken(raw: string): "500gm" | "1kg" | null {
  const t = raw.toLowerCase().replace(/\s+/g, "");
  if (t.includes("500") || t === "halfkg") return "500gm";
  if (t.includes("1kg")) return "1kg";
  return null;
}

/**
 * "Remove the 1kg and keep 3 of the 500gm" is two edits in one sentence.
 * A plain remove leaves both sizes in the match, so this splits them first.
 */
export function planScopedCartEdit(text: string): ScopedCartEdit | null {
  const raw = String(text || "").trim();
  if (!REMOVE_RE.test(raw)) return null;

  const removeMatch = raw.match(
    new RegExp(`\\b(?:remov\\w*|delet\\w*|drop\\w*|take)\\b[\\s\\S]{0,90}?\\b(${SIZE_SRC})\\b`, "i"),
  );
  const keepQtySize = raw.match(new RegExp(`\\bkeep\\b[\\s\\S]{0,40}?\\b(\\d{1,2})\\s*(${SIZE_SRC})\\b`, "i"));
  const keepSizeQty = raw.match(
    new RegExp(`\\bkeep\\b[\\s\\S]{0,40}?\\b(${SIZE_SRC})\\s*(?:x|×)?\\s*(\\d{1,2})\\b`, "i"),
  );

  let keep: ScopedCartEdit["keep"] = null;
  if (keepQtySize) {
    const size = sizeToken(keepQtySize[2]);
    const quantity = parseInt(keepQtySize[1], 10);
    if (size && quantity >= 1 && quantity <= 10) keep = { size, quantity };
  } else if (keepSizeQty) {
    const size = sizeToken(keepSizeQty[1]);
    const quantity = parseInt(keepSizeQty[2], 10);
    if (size && quantity >= 1 && quantity <= 10) keep = { size, quantity };
  }

  const removeSize = removeMatch ? sizeToken(removeMatch[1]) : null;
  if (!removeSize && !keep) return null;

  const itemReference = stripReference(
    raw
      .replace(/\bkeep\b[\s\S]*$/i, " ")
      .replace(new RegExp(`\\b(?:${SIZE_SRC})\\b`, "gi"), " "),
  );
  return { itemReference, removeSize, keep };
}

export function parseModelIntent(raw: unknown): CartIntent {
  const data = typeof raw === "string" ? safeJson(raw) : raw;
  if (!data || typeof data !== "object") return { action: "unclear", item_reference: "", quantity: null };
  const row = data as { action?: unknown; item_reference?: unknown; quantity?: unknown };
  const action = typeof row.action === "string" && ACTIONS.has(row.action as CartActionName)
    ? (row.action as CartActionName)
    : "unclear";
  const item_reference = typeof row.item_reference === "string" ? row.item_reference.slice(0, 160) : "";
  const quantity =
    typeof row.quantity === "number" && row.quantity >= 1 && row.quantity <= 10
      ? Math.floor(row.quantity)
      : null;
  return { action, item_reference, quantity };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True when every dish on a model draft is named in this message. */
export function draftEchoesMessage(text: string, dishes: string[]): boolean {
  const blob = tokens(text);
  const named = dishes.map((d) => d.trim()).filter(Boolean);
  if (named.length === 0) return false;
  return named.every((dish) => {
    const words = tokens(dish).filter((w) => !SHARED.has(canon(w)));
    const check = words.length > 0 ? words : tokens(dish);
    return check.some((w) => blob.some((t) => tokenHit(t, w) > 0 || tokenHit(w, t) > 0));
  });
}

/** Button title, 20 characters, enough to tell Mom's from Sister's. */
export function cartLineButtonTitle(name: string): string {
  const full = formatFullDishName(name);
  if (full.length <= 20) return full;
  const head = full.match(/^(mom's|sister's|sister-in-law's|mother-in-law's|grandma's|chef's)/i);
  if (head) {
    const titled = full.slice(0, head[1].length);
    const withGravy = `${titled} gravy`;
    if (withGravy.length <= 20) return withGravy;
    return titled.slice(0, 20);
  }
  return full.slice(0, 20);
}
