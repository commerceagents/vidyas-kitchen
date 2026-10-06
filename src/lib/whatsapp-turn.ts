/**
 * Every free-text message is classified before the pending question is allowed
 * to swallow it. The conversation state is a hint, not a filter.
 *
 * After an interruption is handled, the still-pending question is asked again
 * in the caller's own words. A clarification names what was just said. It does
 * not pretend the customer answered the old question.
 *
 * The same pending question, interrupted 3 times without an answer, stops
 * looping and hands the chat to a person.
 */

import type { SessionState } from "./whatsapp-session";
import { parseDateText, parsePackQuantities, parsePackSize } from "./ai/order-proposal";
import { localCartIntent, planScopedCartEdit } from "./whatsapp-cart-ops";

export const INTERRUPT_ESCALATE_AT = 3;

export const VK_INTERRUPT_PREFIX = "__vk_interrupt__:";

export type TurnIntent =
  | "answer_pending_question"
  | "edit_cart"
  | "add_item"
  | "remove_item"
  | "ask_menu"
  | "ask_status"
  | "cancel_order"
  | "complaint"
  | "checkout"
  | "small_talk"
  | "unclear";

export type TurnClassification = {
  intent: TurnIntent;
  matches_pending_state: boolean;
  extracted_value: string | null;
  item_reference: string | null;
  quantity: number | null;
};

export type RouteAction =
  | "accept_answer"
  | "mutate_cart_then_reask"
  | "answer_menu_then_reask"
  | "answer_status_then_reask"
  | "cancel"
  | "complaint"
  | "clarify"
  | "escalate"
  | "reask";

export type RouteDecision = {
  action: RouteAction;
  nextInterruptCount: number;
};

type Turn = { role: "user" | "assistant"; content: string };

/** States that are waiting on one specific reply. */
export const PENDING_STATES: SessionState[] = [
  "picking_date",
  "picking_slot",
  "picking_address",
  "picking_pay_method",
  "awaiting_payment",
  "confirming_last",
  "confirming_proposal",
  "picking_variant",
  "picking_qty",
  "picking_item",
];

export function isPendingState(state: SessionState): boolean {
  return PENDING_STATES.includes(state);
}

const COMPLAINT_RE =
  /\b(complaint|complain|cheated|disgusting|spoiled|spoilt|stale|worst|terrible|food poisoning)\b/i;
const CANCEL_RE = /^(please\s+)?(cancel|cancel (this |the |my )?order|stop this order)\b/i;
const MENU_RE = /\b(menu|what do you (have|sell)|what's available|what is available|show (me )?(the )?dishes)\b/i;

/**
 * A question about an order already placed. "I want to order chicken" is a
 * new order and must not match — the word "order" alone is not enough.
 */
export function asksAboutExistingOrder(text: string): boolean {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;
  if (/\b(where is my order|order status|track( my)? order|did it (ship|leave))\b/.test(t)) return true;
  if (/\b(pending|existing|active|current|previous|last|earlier|unpaid)\b[\s\S]{0,40}\borders?\b/.test(t)) return true;
  if (/\borders?\b[\s\S]{0,40}\b(pending|status|update|updates)\b/.test(t)) return true;
  if (/\b(any|do i have|have i|did i|is there|check my)\b[\s\S]{0,48}\borders?\b/.test(t)) return true;
  if (/\bwhere\b[\s\S]{0,24}\borders?\b/.test(t)) return true;
  return false;
}
const ADD_RE = /\b(add|also (get|want|add)|one more|i want|i need|get me)\b/i;
const SMALL_TALK_RE = /^(thanks|thank you|ok+|okay|hmm+|cool|great|super|nice)[.! ]*$/i;

function blank(intent: TurnIntent, extra?: Partial<TurnClassification>): TurnClassification {
  return {
    intent,
    matches_pending_state: false,
    extracted_value: null,
    item_reference: null,
    quantity: null,
    ...extra,
  };
}

function directAnswer(state: SessionState, text: string): string | null {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;

  if (state === "picking_date") {
    const named = parseDateText(raw);
    if (named && !/\b(remov|delet|keep|add|menu|cancel|complain)\b/i.test(raw)) return named;
    if (/^[1-5]$/.test(raw)) return raw;
  }
  if (state === "picking_slot") {
    if (/^[123]$/.test(raw)) return raw;
    if (/\b(breakfast|lunch|dinner)\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
      const hit = lower.match(/\b(breakfast|lunch|dinner)\b/);
      return hit?.[1] ?? raw;
    }
  }
  if (state === "picking_address" && raw.length >= 8 && !raw.includes("?")) return raw;
  if (state === "picking_pay_method" && /\b(cash|cod|upi|online|gpay|phonepe|paytm)\b/i.test(lower)) return lower;
  if (state === "awaiting_payment" && /^(pay|paid|done|yes|confirm)\b/i.test(lower)) return lower;
  if (state === "confirming_last" && /^(same|yes|ok|okay|change|edit|no)\b/i.test(lower)) return lower;
  if (state === "confirming_proposal" && /^(yes|confirm|ok|okay|no|correct|sari|seri)\b/i.test(lower)) return lower;
  // "500gm", "1", "1 500gm", and "500gm 2" all answer the size list.
  // A bare \b500\b misses "500gm" because the g stays attached to the number.
  if (state === "picking_variant" && !REMOVE_WORD.test(raw)) {
    if (/^[12]$/.test(lower)) return raw;
    if (parsePackQuantities(raw).length > 0 || parsePackSize(raw)) return raw;
  }
  if (state === "picking_qty" && /^([1-9]|10)$/.test(raw)) return raw;
  // A numbered tap answers "which dish?". A day or a meal does not — that
  // corrects the noted slot and the dish question is asked again.
  if (state === "picking_item" && /^([1-9]|10)$/.test(raw)) return raw;
  return null;
}

const REMOVE_WORD = /\b(remov\w*|delet\w*|drop\w*)\b/i;

/**
 * Local classification. A direct answer to the pending question is the only
 * path that sets matches_pending_state. Anything else is the intent they
 * actually expressed.
 */
export function classifyTurn(text: string, state: SessionState): TurnClassification {
  const raw = String(text || "").trim();
  if (!raw) return blank("unclear");

  if (COMPLAINT_RE.test(raw)) return blank("complaint");
  if (CANCEL_RE.test(raw) && !REMOVE_WORD.test(raw)) return blank("cancel_order");

  const scoped = planScopedCartEdit(raw);
  if (scoped) {
    return blank("remove_item", {
      item_reference: scoped.itemReference || null,
      quantity: scoped.keep?.quantity ?? null,
    });
  }

  const local = localCartIntent(raw);
  if (local?.action === "remove_item" || local?.action === "update_qty" || local?.action === "clear_cart") {
    const intent: TurnIntent = local.action === "clear_cart" ? "edit_cart" : local.action === "update_qty" ? "edit_cart" : "remove_item";
    return blank(intent, { item_reference: local.item_reference || null, quantity: local.quantity });
  }
  if (local?.action === "checkout") return blank("checkout");

  if (MENU_RE.test(raw)) return blank("ask_menu");
  if (asksAboutExistingOrder(raw)) return blank("ask_status");
  if (ADD_RE.test(raw) && !REMOVE_WORD.test(raw)) return blank("add_item");

  const answered = isPendingState(state) ? directAnswer(state, raw) : null;
  if (answered) {
    return blank("answer_pending_question", {
      matches_pending_state: true,
      extracted_value: answered,
    });
  }

  if (SMALL_TALK_RE.test(raw)) return blank("small_talk");
  return blank("unclear");
}

/**
 * Complaint always wins. A real answer resets the interrupt count. Anything
 * else counts, and the third one escalates instead of asking again.
 */
export function routeTurn(
  _state: SessionState,
  classification: TurnClassification,
  interruptedCount: number,
): RouteDecision {
  if (classification.intent === "complaint") {
    return { action: "complaint", nextInterruptCount: 0 };
  }
  if (classification.intent === "cancel_order") {
    return { action: "cancel", nextInterruptCount: 0 };
  }
  if (classification.matches_pending_state || classification.intent === "answer_pending_question") {
    return { action: "accept_answer", nextInterruptCount: 0 };
  }

  const next = interruptedCount + 1;
  if (next >= INTERRUPT_ESCALATE_AT) {
    return { action: "escalate", nextInterruptCount: next };
  }

  switch (classification.intent) {
    case "edit_cart":
    case "remove_item":
    case "add_item":
      return { action: "mutate_cart_then_reask", nextInterruptCount: next };
    case "ask_menu":
      return { action: "answer_menu_then_reask", nextInterruptCount: next };
    case "ask_status":
      return { action: "answer_status_then_reask", nextInterruptCount: next };
    case "checkout":
    case "small_talk":
      return { action: "reask", nextInterruptCount: next };
    case "unclear":
    default:
      return { action: "clarify", nextInterruptCount: next };
  }
}

export function readInterrupt(turns: Turn[] | null | undefined, state: SessionState): number {
  const raw = (turns || []).find((turn) => turn.content.startsWith(VK_INTERRUPT_PREFIX))?.content;
  if (!raw) return 0;
  const body = raw.slice(VK_INTERRUPT_PREFIX.length);
  const [saved, count] = body.split(":");
  if (saved !== state) return 0;
  const n = Number(count);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function pendingResume(turns: Turn[] | null | undefined): SessionState | null {
  const raw = (turns || []).find((turn) => turn.content.startsWith(VK_INTERRUPT_PREFIX))?.content;
  if (!raw) return null;
  const saved = raw.slice(VK_INTERRUPT_PREFIX.length).split(":")[0] as SessionState;
  return isPendingState(saved) ? saved : null;
}

export function withInterrupt<T extends Turn>(turns: T[] | null | undefined, state: SessionState, count: number): T[] {
  const kept = (turns || []).filter((turn) => !turn.content.startsWith(VK_INTERRUPT_PREFIX));
  if (count <= 0) return kept;
  const marker = {
    role: "assistant" as const,
    content: `${VK_INTERRUPT_PREFIX}${state}:${count}`,
  } as T;
  return [...kept, marker];
}
