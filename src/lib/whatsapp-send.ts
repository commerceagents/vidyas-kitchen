/**
 * Unified WhatsApp send layer — Meta Cloud API (primary) with Twilio fallback.
 */

import {
  sendText as metaSendText,
  sendButtons as metaSendButtons,
  sendCtaUrl as metaSendCtaUrl,
  sendList as metaSendList,
  type ListSection,
  type SendButtonsOptions,
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

export type { ListSection };

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
