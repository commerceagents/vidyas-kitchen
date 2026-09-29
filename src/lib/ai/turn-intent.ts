/**
 * Fallback classifier for a sentence the local rules did not recognise.
 * A parsed day, a button, and an obvious cart edit never reach this call.
 */

import OpenAI from "openai";
import type { CartItem } from "../whatsapp-cart";
import type { SessionState } from "../whatsapp-session";
import type { TurnClassification, TurnIntent } from "../whatsapp-turn";

const INTENTS = new Set<TurnIntent>([
  "answer_pending_question",
  "edit_cart",
  "add_item",
  "remove_item",
  "ask_menu",
  "ask_status",
  "cancel_order",
  "complaint",
  "checkout",
  "small_talk",
  "unclear",
]);

export const TURN_CLASSIFIER_PROMPT =
  "You are analyzing a user's WhatsApp message in the context of an ongoing food order conversation. The bot's last message and current pending state are provided. Do NOT assume the user is answering the pending question — evaluate what they actually said. Set matches_pending_state: true ONLY if the message is clearly a direct answer to what was asked (e.g., a day/date when asked 'when would you like it'). If the user is asking to change the cart, asking something else, or expressing a different intent, classify that intent instead, even if a question is still pending.";

export async function classifyTurnWithModel(input: {
  text: string;
  state: SessionState;
  pendingQuestion: string;
  cart: CartItem[];
}): Promise<TurnClassification | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TURN_CLASSIFIER_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              pending_state: input.state,
              pending_question: input.pendingQuestion,
              message: input.text,
              cart: input.cart.map((line) => ({
                name: line.name,
                variant: line.variant,
                quantity: line.quantity,
              })),
              schema: {
                intent:
                  "answer_pending_question|edit_cart|add_item|remove_item|ask_menu|ask_status|cancel_order|complaint|checkout|small_talk|unclear",
                matches_pending_state: "boolean",
                extracted_value: "string|null",
                item_reference: "string|null",
                quantity: "number|null",
              },
            }),
          },
        ],
      },
      { signal: AbortSignal.timeout(2500) },
    );
    return parseTurnClassification(response.choices[0]?.message?.content || "");
  } catch (err) {
    console.error("[turn intent]", err);
    return null;
  }
}

export function parseTurnClassification(raw: string): TurnClassification | null {
  try {
    const data = JSON.parse(raw) as {
      intent?: unknown;
      matches_pending_state?: unknown;
      extracted_value?: unknown;
      item_reference?: unknown;
      quantity?: unknown;
    };
    const intent = typeof data.intent === "string" && INTENTS.has(data.intent as TurnIntent)
      ? (data.intent as TurnIntent)
      : "unclear";
    const quantity =
      typeof data.quantity === "number" && data.quantity >= 1 && data.quantity <= 10
        ? Math.floor(data.quantity)
        : null;
    return {
      intent,
      matches_pending_state: data.matches_pending_state === true && intent === "answer_pending_question",
      extracted_value: typeof data.extracted_value === "string" ? data.extracted_value.slice(0, 80) : null,
      item_reference: typeof data.item_reference === "string" ? data.item_reference.slice(0, 160) : null,
      quantity,
    };
  } catch {
    return null;
  }
}
