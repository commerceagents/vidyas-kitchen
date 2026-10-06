/**
 * Questions the bot answers itself: help, refunds, cancellation, the kitchen
 * phone, and the other lines from the scenario script. Ordering sentences
 * stay on the cook path.
 */

export type SupportTopic =
  | "help"
  | "refund"
  | "cancel_placed"
  | "cancel_policy"
  | "call"
  | "driver"
  | "offers"
  | "address"
  | "best_seller"
  | "spicy"
  | "bot"
  | "presence"
  | "resubscribe";

export function supportTopic(text: string): SupportTopic | null {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;

  if (/^(help|support|i need assistance|customer care)\b/.test(t) && !/\b(chicken|mutton|egg|gravy)\b/.test(t)) {
    return "help";
  }
  if (/\b(resubscribe|turn (promos|offers|marketing) back on|offers again|get offers again)\b/.test(t)) {
    return "resubscribe";
  }
  if (/\bare you (a )?(bot|ai|human|real)\b|\bwho are you\b/.test(t)) return "bot";
  if (/\b(are you there|you there|is this vidya)\b/.test(t) && t.split(/\s+/).length <= 8) return "presence";
  if (
    /^(call|phone|phone number|call us)\b/.test(t) ||
    (/\b(call|phone|ring)\b/.test(t) && /\b(kitchen|chef|human|someone|team|vidya|number)\b/.test(t)) ||
    /\bkitchen (phone|number)\b/.test(t) ||
    /\b(connect|talk|speak) (me )?(to|with) (the )?(kitchen|chef|a human|someone)\b/.test(t)
  ) {
    return "call";
  }
  if (/\brefunds?\b|\bmoney back\b|\brefund policy\b/.test(t)) return "refund";
  if (/\bcancel\b/.test(t) && /(?:#\s*)?\d{4,6}|\b(my|this|the) order\b|\border\s*#?\s*\d/.test(t)) {
    return "cancel_placed";
  }
  if (/\b(how (do i|to) cancel|can i cancel|cancellation policy|cancellation)\b/.test(t)) return "cancel_policy";
  if (/\b(who is my driver|where is my driver|my driver|driver (stuck|not moving|left)|is my driver)\b/.test(t)) {
    return "driver";
  }
  if (/\b(any offers|offers today|is there a discount|any discount|festival offer|what offers|any offer)\b/.test(t)) {
    return "offers";
  }
  if (/\b(best seller|bestseller|most ordered|what do people order)\b/.test(t)) return "best_seller";
  if (/\b(something spicy|suggest something|surprise me)\b/.test(t)) return "spicy";
  if (
    !/\b(change|update|new)\b/.test(t) &&
    /\b(what address|which address|address do you have|address on file|saved address|my address)\b/.test(t)
  ) {
    return "address";
  }
  return null;
}

/** 4–6 digit order number when they named one. */
export function supportOrderNumber(text: string): number | null {
  const match = String(text || "").match(/#\s*(\d{4,6})\b|\border\s*#?\s*(\d{4,6})\b|\bcancel\s+#?\s*(\d{4,6})\b/i);
  const raw = match?.[1] || match?.[2] || match?.[3];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
