import { getCartSummary } from "../whatsapp-cart";

export const REPLY_MODEL = "claude-sonnet-5-5";

/**
 * The only instructions the reply model sees. It does not receive chat history.
 */
export const REPLY_SYSTEM = [
  "You write one short WhatsApp reply for Vidya, who runs Vidya's Kitchen in Sivakasi.",
  "Only use the data provided in this JSON. Never add, remove, or infer items not present in the cart JSON. Never invent dish names, prices, or availability.",
  "A dish may be mentioned only if its name appears in cart.items, removed, updated, or matchedDish.",
  "If cart.items is empty, the cart is empty. Do not fill it from the customer's words.",
  "One or two sentences. Plain text. No emojis, no markdown, no bullet list.",
  "Do not quote a total unless that number is in the JSON.",
].join("\n");

export type CartSummary = ReturnType<typeof getCartSummary>;

export type ReplyDish = {
  name: string;
  variant?: string | null;
  qty?: number | null;
};

export type ReplyInput = {
  cart: CartSummary;
  matchedDish: { name: string; variant?: string | null } | null;
  conversationState: string;
  customerMessage: string;
  removed?: ReplyDish[];
  updated?: ReplyDish[];
  lookup?: unknown;
};

export type ReplyPayload = {
  cart: CartSummary;
  matchedDish: { name: string; variant?: string | null } | null;
  conversationState: string;
  customerMessage: string;
  removed: ReplyDish[];
  updated: ReplyDish[];
  lookup: unknown;
};

/** Groups of phrases that name a real dish. A reply may use one only when the JSON already contains it. */
const DISH_NEEDLES: string[][] = [
  ["chicken wings", "wings"],
  ["black pepper", "pepper chicken"],
  ["chilly chicken", "chilli chicken"],
  ["mom's", "moms"],
  ["sister's recipe", "sisters recipe"],
  ["sister-in-law", "sister in law"],
  ["idli special"],
  ["egg chalna", "chalna"],
  ["egg curry"],
  ["cream mutton", "fresh cream"],
  ["grandma"],
  ["keema", "kheema", "qeema"],
  ["mutton curry"],
  ["mutton stew"],
  ["spicy mutton"],
  ["mutton chukka", "chukka"],
];

/** Structured state for this turn. No conversation history is included. */
export function buildReplyPayload(input: ReplyInput): ReplyPayload {
  return {
    cart: input.cart,
    matchedDish: input.matchedDish,
    conversationState: input.conversationState,
    customerMessage: input.customerMessage,
    removed: input.removed ?? [],
    updated: input.updated ?? [],
    lookup: input.lookup ?? null,
  };
}

export function buildReplyRequest(input: ReplyInput) {
  const payload = buildReplyPayload(input);
  return {
    model: REPLY_MODEL,
    max_tokens: 400,
    thinking: { type: "between_tools" as const },
    output_config: { effort: "low" as const },
    system: REPLY_SYSTEM,
    messages: [{ role: "user" as const, content: JSON.stringify(payload) }],
  };
}

function allowedBlob(input: ReplyInput): string {
  const payload = buildReplyPayload(input);
  return JSON.stringify({
    cart: payload.cart,
    matchedDish: payload.matchedDish,
    removed: payload.removed,
    updated: payload.updated,
    lookup: payload.lookup,
  }).toLowerCase();
}

/** True when every dish and rupee in the reply is already in the JSON. */
export function replyStaysOnProvidedData(reply: string, input: ReplyInput): boolean {
  const text = reply.toLowerCase();
  const allowed = allowedBlob(input);
  for (const group of DISH_NEEDLES) {
    if (!group.some((needle) => text.includes(needle))) continue;
    if (!group.some((needle) => allowed.includes(needle))) return false;
  }
  const amounts = reply.match(/₹\s*[\d,]+/g) || [];
  for (const amount of amounts) {
    const digits = amount.replace(/[^\d]/g, "");
    if (digits && !allowed.includes(digits)) return false;
  }
  return true;
}

function textFromAnthropic(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const row = block as { type?: string; text?: string };
      return row.type === "text" ? String(row.text || "") : "";
    })
    .join("")
    .trim();
}

/**
 * Phrase the WhatsApp reply from the current JSON only.
 * Returns "" when the key is missing, the call fails, or the text names a dish the JSON does not.
 */
export async function phraseReply(input: ReplyInput): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[phrase] ANTHROPIC_API_KEY is not set");
    return "";
  }
  const request = buildReplyRequest(input);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("[phrase] Claude reply failed:", response.status, detail.slice(0, 300));
      return "";
    }
    const text = textFromAnthropic(await response.json());
    if (!text || !replyStaysOnProvidedData(text, input)) {
      console.error("[phrase] reply discarded because it left the provided JSON");
      return "";
    }
    return text;
  } catch (err) {
    console.error("[phrase]", err instanceof Error ? err.message : "reply failed");
    return "";
  }
}

export function parseCartSummary(raw: string | undefined): CartSummary {
  try {
    const parsed = JSON.parse(raw || "") as CartSummary;
    if (parsed && Array.isArray(parsed.items)) return parsed;
  } catch {
    /* The caller passes a fresh summary. A bad string is an empty cart. */
  }
  return getCartSummary([]);
}

/** Dish names and quantities copied from the cart JSON, so a fallback cannot invent one. */
export function cartLinesFallback(cart: CartSummary): string {
  if (cart.items.length === 0) return "Your cart is empty.";
  return cart.items.map((item) => `${item.name} (${item.variant}) × ${item.qty}`).join(", ");
}
