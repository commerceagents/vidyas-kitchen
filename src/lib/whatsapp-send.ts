/**
 * WhatsApp send layer — Meta Cloud API, and only Meta.
 *
 * There used to be a Twilio WhatsApp fallback here. Two providers meant two
 * sender identities, two sets of logs and two places a missing message could
 * be hiding, which is exactly the wrong shape for debugging "the customer
 * never got it". Twilio remains for SMS only (`src/lib/sms.ts`), as the last
 * resort when WhatsApp cannot reach a gift recipient at all.
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
import { logWhatsAppMessageSoon } from "@/lib/whatsapp-message-log";

function isMetaApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Missing credentials are a deployment fault, not a message-level one. */
function notConfigured(label: string): WaSendOutcome {
  const error = "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set";
  console.error(`[whatsapp-send] ${label} skipped: ${error}`);
  return { ok: false, error };
}

/**
 * Whether the message actually left. Order notifications need this: a customer
 * who has not messaged us in 24 hours has every free-form send rejected, and
 * the caller has to know so it can fall back to an approved template.
 */
export type WaSendOutcome = { ok: boolean; error?: string };

export async function sendText(to: string, text: string): Promise<WaSendOutcome> {
  if (!isMetaApiConfigured()) return notConfigured("text");
  const r = await metaSendText(to, text);
  if (!r.success) {
    console.error("[whatsapp-send] text failed:", r.error);
    return { ok: false, error: r.error };
  }
  logWhatsAppMessageSoon({ phone: to, direction: "out", kind: "text", body: text, provider: "meta", waMessageId: r.messageId });
  return { ok: true };
}

export type { SendButtonsOptions };

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  options?: SendButtonsOptions,
): Promise<WaSendOutcome> {
  if (!isMetaApiConfigured()) return notConfigured("buttons");
  let r = await metaSendButtons(to, bodyText, buttons, options);
  if (!r.success && options?.headerImageUrl) {
    // Nearly always an image Meta could not fetch — the words still matter.
    console.error("[whatsapp-send] buttons with header failed, retrying without image:", r.error);
    r = await metaSendButtons(to, bodyText, buttons);
  }
  if (!r.success) {
    console.error("[whatsapp-send] buttons failed, sending numbered text:", r.error);
    const numbered = buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n");
    return sendText(to, `${bodyText}\n\n${numbered}`);
  }
  logWhatsAppMessageSoon({
    phone: to,
    direction: "out",
    kind: "button",
    body: bodyText,
    payload: { buttons: buttons.map((b) => ({ id: b.id, title: b.title })) },
    provider: "meta",
    waMessageId: r.messageId,
  });
  return { ok: true };
}

/** bodyText, url, button label — consistent across Meta and Twilio. */
export async function sendCtaUrl(
  to: string,
  bodyText: string,
  url: string,
  buttonText: string,
  options?: { headerImageUrl?: string; footer?: string },
): Promise<WaSendOutcome> {
  if (!isMetaApiConfigured()) return notConfigured("cta");
  let r = await metaSendCtaUrl(to, bodyText, buttonText, url, options);
  if (!r.success && options?.headerImageUrl) {
    console.error("[whatsapp-send] CTA with image failed, retrying without:", r.error);
    r = await metaSendCtaUrl(to, bodyText, buttonText, url);
  }
  if (!r.success) {
    console.error("[whatsapp-send] CTA failed, sending link as text:", r.error);
    return sendText(to, `${bodyText}\n\n${url}`);
  }
  logWhatsAppMessageSoon({
    phone: to,
    direction: "out",
    kind: "cta",
    body: bodyText,
    payload: { url, buttonText },
    provider: "meta",
    waMessageId: r.messageId,
  });
  return { ok: true };
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
  if (r.success) {
    logWhatsAppMessageSoon({
      phone: to,
      direction: "out",
      kind: "carousel",
      body: bodyText,
      payload: { cards: cards.map((c) => ({ title: c.title, body: c.body })) },
      provider: "meta",
      waMessageId: r.messageId,
    });
  }
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
  if (r.success) {
    logWhatsAppMessageSoon({
      phone: to,
      direction: "out",
      kind: "product_list",
      body: bodyText,
      payload: { headerText, footerText, sections },
      provider: "meta",
      waMessageId: r.messageId,
    });
  }
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
  if (r.success) {
    logWhatsAppMessageSoon({
      phone: to,
      direction: "out",
      kind: "product",
      body: bodyText,
      payload: { productRetailerId, footerText },
      provider: "meta",
      waMessageId: r.messageId,
    });
  }
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
  if (r.success) {
    logWhatsAppMessageSoon({
      phone: to,
      direction: "out",
      kind: "location",
      body: [name, address].filter(Boolean).join(" — "),
      payload: { latitude, longitude, name, address },
      provider: "meta",
      waMessageId: r.messageId,
    });
  }
  return r.success;
}

/** Interactive list, or a numbered text list when Meta rejects it. */
export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<WaSendOutcome> {
  if (!isMetaApiConfigured()) return notConfigured("list");
  const r = await metaSendList(to, bodyText, buttonLabel, sections);
  if (!r.success) {
    console.error("[whatsapp-send] list failed, sending numbered text:", r.error);
    const rows = sections.flatMap((s) => s.rows);
    const lines = rows.map((row, i) => `${i + 1}. ${row.title}${row.description ? ` — ${row.description}` : ""}`);
    return sendText(to, `${bodyText}\n\n${lines.join("\n")}\n\n_Reply with the number._`);
  }
  logWhatsAppMessageSoon({
    phone: to,
    direction: "out",
    kind: "list",
    body: bodyText,
    payload: { buttonLabel, sections },
    provider: "meta",
    waMessageId: r.messageId,
  });
  return { ok: true };
}
