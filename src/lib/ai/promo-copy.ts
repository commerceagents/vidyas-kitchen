/**
 * One sentence for a discount card. The percent is already chosen by the
 * rule. This only rewrites the sentence, and a reply that names a different
 * percent is thrown away.
 */

import OpenAI from "openai";

export function quietDishReason(input: {
  item: string;
  orders7d: number;
  orders30d: number;
  rating: number | null;
  reviewCount: number;
  discount: number;
  windowDays?: number;
}): string {
  const days = input.windowDays ?? 7;
  const rating =
    input.reviewCount > 0 && input.rating != null
      ? ` Rating ${input.rating}/5 from ${input.reviewCount} review${input.reviewCount === 1 ? "" : "s"}.`
      : "";
  if (input.orders7d === 0) {
    return `Nobody ordered ${input.item} in the last ${days} days.${rating} ${input.orders30d} orders in the last 30 days. Suggest ${input.discount}% off.`;
  }
  return `${input.item} had ${input.orders7d} order${input.orders7d === 1 ? "" : "s"} in the last ${days} days, ${input.orders30d} in the last 30.${rating} Suggest ${input.discount}% off.`;
}

export function percentsIn(text: string): number[] {
  return [...String(text).matchAll(/(\d+)\s*%/g)].map((match) => Number(match[1]));
}

/** True when the sentence keeps the rule's percent and invents no other one. */
export function reasonKeepsDiscount(text: string, discount: number): boolean {
  const found = percentsIn(text);
  return found.length === 1 && found[0] === discount && text.trim().length >= 20 && text.trim().length <= 280;
}

export async function phraseQuietDishReason(input: {
  item: string;
  orders7d: number;
  orders30d: number;
  rating: number | null;
  reviewCount: number;
  discount: number;
}): Promise<string> {
  const fallback = quietDishReason(input);
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content: [
              "Write one short sentence for a kitchen dashboard card.",
              `The discount is already ${input.discount}%. Repeat that exact percent once.`,
              "Do not pick a different percent. Do not add a second dish. No emoji.",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      },
      { signal: AbortSignal.timeout(2500) },
    );
    const text = (response.choices[0]?.message?.content || "").replace(/^["']|["']$/g, "").trim();
    return reasonKeepsDiscount(text, input.discount) ? text : fallback;
  } catch (err) {
    console.error("[promo copy]", err);
    return fallback;
  }
}
