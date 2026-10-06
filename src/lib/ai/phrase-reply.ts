import { getCartSummary } from "../whatsapp-cart";

/** Current free-tier Flash model. gemini-2.0-flash was shut down on 1 June 2026. */
export const REPLY_MODEL = "gemini-3.5-flash-lite";

/**
 * The only instructions the reply model sees. It does not receive chat history.
 */
export const REPLY_SYSTEM = [
  "You are generating a WhatsApp order summary. Use ONLY the data in this JSON. Never add, remove, or infer items not present in the cart JSON. Never invent dish names, prices, discounts, or availability. If the cart is empty, say so plainly — do not suggest or mention any dish not explicitly passed to you.",
  "A dish may be mentioned only if its name appears in cart.items, removed, updated, or matchedDish.",
  "One or two sentences. Plain text. No emojis, no markdown, no bullet list.",
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
    systemInstruction: { parts: [{ text: REPLY_SYSTEM }] },
    contents: [{ role: "user" as const, parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: { maxOutputTokens: 400, temperature: 0 },
  };
}

function allowedBlob(input: ReplyInput): string {
  const payload = buildReplyPayload(input);
  return JSON.stringify({
    cart: payload.cart,
    matchedDish: payload.matchedDish,
    removed: payload.removed,
    updated: payload.updated,
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

function textFromGemini(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return "";
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      return String((part as { text?: string }).text || "");
    })
    .join("")
    .trim();
}

/**
 * Phrase the WhatsApp reply from the current JSON only.
 * Returns "" when the key is missing, the call fails, or the text names a dish the JSON does not.
 */
export async function phraseReply(input: ReplyInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("[phrase] GEMINI_API_KEY is not set");
    return "";
  }
  const request = buildReplyRequest(input);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${REPLY_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: request.systemInstruction,
          contents: request.contents,
          generationConfig: request.generationConfig,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      console.error("[phrase] Gemini reply failed:", response.status, detail.slice(0, 300));
      return "";
    }
    const text = textFromGemini(await response.json());
    if (!text || !replyStaysOnProvidedData(text, input)) {
      console.error("[phrase] reply discarded because it named a dish outside the cart JSON");
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
