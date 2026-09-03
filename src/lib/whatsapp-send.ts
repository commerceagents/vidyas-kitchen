/**
 * Unified WhatsApp send layer — Meta Cloud API (primary) with Twilio fallback.
 *
 * The rich formats (product_list, carousel) return a boolean rather than
 * throwing, because the menu deliberately degrades: catalog cards → photo
 * carousel → interactive list → numbered text. Whatever Meta rejects, the
 * customer still gets a reply, and the real reason lands in the Vercel log.
 */

import {
  sendText as metaSendText,
  sendButtons as metaSendButtons,
  sendCtaUrl as metaSendCtaUrl,
  sendList as metaSendList,
  sendCarousel as metaSendCarousel,
  sendProductList as metaSendProductList,
  sendSingleProduct as metaSendSingleProduct,
  sendLocation as metaSendLocation,
  type ListSection,
  type SendButtonsOptions,
  type CarouselCard,
  type ProductSection,
} from "@/lib/meta-whatsapp";
import {
  sendText as twilioSendText,
  sendButtons as twilioSendButtons,
  sendCtaUrl as twilioSendCtaUrl,
} from "@/lib/twilio-whatsapp";

function isMetaApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendText(to: string, text: string): Promise<void> {
  if (isMetaApiConfigured()) {
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
  if (isMetaApiConfigured()) {
    let r = await metaSendButtons(to, bodyText, buttons, options);
    if (!r.success && options?.headerImageUrl) {
      // Nearly always an image Meta could not fetch — the words still matter.
      console.error("[whatsapp-send] buttons with header failed, retrying without image:", r.error);
      r = await metaSendButtons(to, bodyText, buttons);
    }
    if (!r.success) {
      console.error("[whatsapp-send] buttons failed, sending numbered text:", r.error);
      const numbered = buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n");
      await metaSendText(to, `${bodyText}\n\n${numbered}`);
    }
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
  if (isMetaApiConfigured()) {
    const r = await metaSendCtaUrl(to, bodyText, buttonText, url);
    if (r.success) return;
    console.error("[whatsapp-send] CTA failed, sending link as text:", r.error);
    await metaSendText(to, `${bodyText}\n\n${url}`);
    return;
  }
  const r = await twilioSendCtaUrl(to, bodyText, url, buttonText);
  if (r.error) console.error("[whatsapp-send] Twilio CTA failed:", r.error);
}

export type { ListSection, CarouselCard, ProductSection };

/** Photo carousel. False when Meta rejects it, so the caller can drop to a list. */
export async function sendCarousel(
  to: string,
  bodyText: string,
  cards: CarouselCard[],
): Promise<boolean> {
  if (!isMetaApiConfigured() || cards.length < 2) return false;
  const r = await metaSendCarousel(to, bodyText, cards);
  return r.success;
}

/**
 * Commerce Manager product list. False when the catalog isn't configured or
 * Meta rejects it — never invent retailer IDs to fill it out.
 */
export async function sendProductList(
  to: string,
  catalogId: string,
  headerText: string,
  bodyText: string,
  sections: ProductSection[],
  footerText?: string,
): Promise<boolean> {
  if (!isMetaApiConfigured() || !catalogId) return false;
  if (!sections.some((s) => s.productRetailerIds.length)) return false;
  const r = await metaSendProductList(to, catalogId, headerText, bodyText, sections, footerText);
  return r.success;
}

export async function sendSingleProduct(
  to: string,
  catalogId: string,
  productRetailerId: string,
  bodyText: string,
  footerText?: string,
): Promise<boolean> {
  if (!isMetaApiConfigured() || !catalogId || !productRetailerId) return false;
  const r = await metaSendSingleProduct(to, catalogId, productRetailerId, bodyText, footerText);
  return r.success;
}

/** Static pin. False on rejection — callers pair it with the app link anyway. */
export async function sendLocation(
  to: string,
  latitude: number,
  longitude: number,
  name: string,
  address: string,
): Promise<boolean> {
  if (!isMetaApiConfigured()) return false;
  const r = await metaSendLocation(to, latitude, longitude, name, address);
  return r.success;
}

/** Interactive list (Meta) or numbered fallback (Twilio / on rejection). */
export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<void> {
  if (isMetaApiConfigured()) {
    const r = await metaSendList(to, bodyText, buttonLabel, sections);
    if (!r.success) {
      console.error("[whatsapp-send] list failed, sending numbered text:", r.error);
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
