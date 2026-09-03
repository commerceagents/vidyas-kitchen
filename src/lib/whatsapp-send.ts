/**
 * Unified WhatsApp send layer — Meta Cloud API (primary) with Twilio fallback.
 */

import {
  sendText as metaSendText,
  sendButtons as metaSendButtons,
  sendCtaUrl as metaSendCtaUrl,
  sendList as metaSendList,
  sendCarousel as metaSendCarousel,
  sendProductList as metaSendProductList,
  type ListSection,
  type SendButtonsOptions,
  type CarouselCard,
} from "@/lib/meta-whatsapp";
import {
  sendText as twilioSendText,
  sendButtons as twilioSendButtons,
  sendCtaUrl as twilioSendCtaUrl,
} from "@/lib/twilio-whatsapp";

function useMetaApi(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendText(to: string, text: string): Promise<void> {
  if (useMetaApi()) {
    const r = await metaSendText(to, text);
    if (!r.success) console.error("[whatsapp-send] Meta text failed:", r.error);
    return;
  }
  const r = await twilioSendText(to, text);
  if (r.error) console.error("[whatsapp-send] Twilio text failed:", r.error);
}

export type { SendButtonsOptions };

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  options?: SendButtonsOptions,
): Promise<void> {
  if (useMetaApi()) {
    const r = await metaSendButtons(to, bodyText, buttons, options);
    if (!r.success) console.error("[whatsapp-send] Meta buttons failed:", r.error);
    return;
  }
  const r = await twilioSendButtons(to, bodyText, buttons);
  if (r.error) console.error("[whatsapp-send] Twilio buttons failed:", r.error);
}

/** bodyText, url, button label — consistent across Meta and Twilio. */
export async function sendCtaUrl(
  to: string,
  bodyText: string,
  url: string,
  buttonText: string,
): Promise<void> {
  if (useMetaApi()) {
    const r = await metaSendCtaUrl(to, bodyText, buttonText, url);
    if (!r.success) console.error("[whatsapp-send] Meta CTA failed:", r.error);
    return;
  }
  const r = await twilioSendCtaUrl(to, bodyText, url, buttonText);
  if (r.error) console.error("[whatsapp-send] Twilio CTA failed:", r.error);
}

export type { ListSection, CarouselCard };

/** Image carousel. Returns false if Meta rejects so caller can use a list. */
export async function sendCarousel(
  to: string,
  bodyText: string,
  cards: CarouselCard[],
): Promise<boolean> {
  if (!useMetaApi() || cards.length < 2) return false;
  const r = await metaSendCarousel(to, bodyText, cards);
  if (!r.success) {
    console.error("[whatsapp-send] Meta carousel failed:", r.error);
    return false;
  }
  return true;
}

/**
 * Commerce Manager product list. Returns false if catalog isn't configured
 * or Meta rejects (do not invent retailer IDs).
 */
export async function sendProductList(
  to: string,
  catalogId: string,
  headerText: string,
  bodyText: string,
  sections: { title: string; productRetailerIds: string[] }[],
): Promise<boolean> {
  if (!useMetaApi() || !catalogId || !sections.some((s) => s.productRetailerIds.length)) return false;
  const r = await metaSendProductList(to, catalogId, headerText, bodyText, sections);
  if (!r.success) {
    console.error("[whatsapp-send] Meta product_list failed:", r.error);
    return false;
  }
  return true;
}

/** Interactive list (Meta) or numbered fallback (Twilio). */
export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<void> {
  if (useMetaApi()) {
    const r = await metaSendList(to, bodyText, buttonLabel, sections);
    if (!r.success) {
      console.error("[whatsapp-send] Meta list failed:", r.error);
      await sendListFallback(to, bodyText, sections);
    }
    return;
  }
  await sendListFallback(to, bodyText, sections);
}

async function sendListFallback(to: string, bodyText: string, sections: ListSection[]): Promise<void> {
  const rows = sections.flatMap((s) => s.rows);
  const lines = rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`);
  await sendText(to, `${bodyText}\n\n${lines.join("\n")}\n\n_Reply with the number._`);
}
