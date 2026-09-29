/**
 * Promotional WhatsApp sends. Meta only delivers these outside a chat when
 * the template is already approved, so a missing or pending template sends
 * nothing and leaves whatsapp_sent false.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { fetchTemplateStatus, sendTemplate, type TemplateStatus } from "@/lib/meta-whatsapp";
import { campaignAudience } from "@/lib/whatsapp-marketing";
import { logWhatsAppMessageSoon } from "@/lib/whatsapp-message-log";
import { WHATSAPP_BOT_E164 } from "@/lib/whatsapp-copy";
import { bannerLiveStatus, parseBannerRow, type BannerRow } from "@/lib/banners";

export const FESTIVAL_OFFER_TEMPLATE_NAME = "festival_offer";
export const FESTIVAL_OFFER_TEMPLATE_LANG = "en";

export function festivalOfferTemplateDefinition(): Record<string, unknown> {
  const digits = WHATSAPP_BOT_E164.replace(/\D/g, "");
  return {
    name: FESTIVAL_OFFER_TEMPLATE_NAME,
    language: FESTIVAL_OFFER_TEMPLATE_LANG,
    category: "MARKETING",
    allow_category_change: true,
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: ["REPLACE_WITH_BANNER_MEDIA_HANDLE"] },
      },
      {
        type: "BODY",
        text: "Vidya's Kitchen: {{1}}\n\n{{2}}\n\nReply STOP to opt out.",
        example: {
          body_text: [["Diwali Special", "Diwali Special — 30% off, 8 Nov–10 Nov."]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Order now",
            url: `https://wa.me/${digits}?text=ORDER`,
          },
        ],
      },
    ],
  };
}

function templateComponents(banner: BannerRow): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];
  if (banner.image_url) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: banner.image_url } }],
    });
  }
  components.push({
    type: "body",
    parameters: [
      { type: "text", text: banner.title.slice(0, 60) },
      { type: "text", text: banner.message_text.slice(0, 200) },
    ],
  });
  return components;
}

export type BannerSendResult = {
  status: TemplateStatus;
  bannerId: string | null;
  attempted: number;
  sent: number;
  failed: number;
  skippedReason?: string;
};

async function claim(id: string): Promise<boolean> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("banners")
    .update({ whatsapp_sent: true })
    .eq("id", id)
    .eq("whatsapp_sent", false)
    .select("id");
  if (error) {
    console.error("[banner broadcast claim]", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

async function unclaim(id: string): Promise<void> {
  await createServerSupabase().from("banners").update({ whatsapp_sent: false }).eq("id", id);
}

export async function sendBannerBroadcast(banner: BannerRow): Promise<BannerSendResult> {
  if (bannerLiveStatus(banner) !== "active") {
    return {
      status: "UNKNOWN",
      bannerId: banner.id,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: "This banner is not inside its dates yet.",
    };
  }
  if (!banner.image_url) {
    return {
      status: "UNKNOWN",
      bannerId: banner.id,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: "No picture yet, so the WhatsApp template cannot go out.",
    };
  }
  const status = await fetchTemplateStatus(FESTIVAL_OFFER_TEMPLATE_NAME);
  if (status !== "APPROVED") {
    return {
      status,
      bannerId: banner.id,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason:
        status === "PENDING"
          ? "The festival_offer template is still in review with Meta. Nothing sent."
          : `The festival_offer template is ${status}. Submit it for approval before a broadcast.`,
    };
  }

  const claimed = await claim(banner.id);
  if (!claimed) {
    return {
      status,
      bannerId: banner.id,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: "Already sent.",
    };
  }

  const audience = await campaignAudience();
  const components = templateComponents(banner);
  let sent = 0;
  let failed = 0;
  for (const recipient of audience) {
    const result = await sendTemplate(
      recipient.phone,
      FESTIVAL_OFFER_TEMPLATE_NAME,
      FESTIVAL_OFFER_TEMPLATE_LANG,
      components,
    );
    if (result.success) {
      sent += 1;
      logWhatsAppMessageSoon({
        phone: recipient.phone,
        direction: "out",
        kind: "template",
        body: `${banner.title} — ${banner.message_text}`,
        payload: { template: FESTIVAL_OFFER_TEMPLATE_NAME, bannerId: banner.id },
        provider: "meta",
        waMessageId: result.messageId,
      });
    } else failed += 1;
  }

  if (sent === 0) await unclaim(banner.id);
  return { status, bannerId: banner.id, attempted: audience.length, sent, failed };
}

/** Approved banners whose dates are live and which have not been broadcast. */
export async function broadcastDueBanners(): Promise<BannerSendResult[]> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("banners")
    .select("*")
    .eq("approval", "approved")
    .eq("whatsapp_sent", false);
  if (error) {
    console.error("[banner broadcast]", error.message);
    return [];
  }
  const due = (data ?? [])
    .map((row) => parseBannerRow(row as Record<string, unknown>))
    .filter((row): row is BannerRow => row != null && bannerLiveStatus(row) === "active");
  const results: BannerSendResult[] = [];
  for (const banner of due) results.push(await sendBannerBroadcast(banner));
  return results;
}
