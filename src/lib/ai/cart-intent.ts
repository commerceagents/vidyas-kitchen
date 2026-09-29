/**
 * Intent only. The model returns an action and the words the customer used
 * for the dish. Item ids are resolved afterwards by matchCartLines.
 */

import OpenAI from "openai";
import type { CartItem } from "../whatsapp-cart";
import {
  localCartIntent,
  looksLikeCartEdit,
  parseModelIntent,
  type CartIntent,
} from "../whatsapp-cart-ops";

const UNCLEAR: CartIntent = { action: "unclear", item_reference: "", quantity: null };

export async function resolveCartIntent(text: string, cart: CartItem[]): Promise<CartIntent> {
  const local = localCartIntent(text);
  if (local) return local;
  if (!looksLikeCartEdit(text) || cart.length === 0) return UNCLEAR;
  if (!process.env.OPENAI_API_KEY) return UNCLEAR;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are an intent parser for a food-order cart.",
              "Given the user's message and the current cart, output ONLY a JSON object.",
              'Shape: {"action":"add_item|remove_item|update_qty|clear_cart|checkout|ask_menu|ask_status|unclear","item_reference":"string","quantity":number|null}',
              "item_reference is the raw words they used for the dish, copied from their message. Never invent a dish.",
              "Never output a new cart, prices, or item ids.",
              "If the dish they mean is not clearly in the cart or the message, action is unclear.",
              "quantity is null unless they asked to change how many.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              message: text,
              cart: cart.map((line) => ({
                name: line.name,
                variant: line.variant,
                quantity: line.quantity,
              })),
            }),
          },
        ],
      },
      { signal: AbortSignal.timeout(2500) },
    );
    return parseModelIntent(response.choices[0]?.message?.content || "");
  } catch (err) {
    console.error("[cart intent]", err);
    return UNCLEAR;
  }
}
