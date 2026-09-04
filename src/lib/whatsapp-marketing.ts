/**
 * "Best selling today" — the outbound carousel campaign.
 *
 * This is marketing, not a reply, so it is bound by rules the rest of the bot
 * is not:
 *
 *  - It must be an approved template with category MARKETING. A free-form
 *    carousel can only be sent inside the 24-hour customer service window,
 *    which by definition a campaign is not.
 *  - Meta reviews the template, not each send. Cards therefore carry variables
 *    ({{1}} dish name, {{2}} price) and fixed structure; the dishes can change
 *    daily without re-approval, the layout cannot.
 *  - Every card image must be uploaded once as a header handle at template
 *    creation. Sends reference the same media by URL per card.
 *  - Marketing needs an opt-out, and Meta requires that honouring it is
 *    reliable rather than best effort.
 *
 * Nothing here fires on its own. `sendBestSellerCampaign` is called by
 * /api/whatsapp/best-sellers, which an admin or a scheduled job triggers.
 * Approval steps are in docs/whatsapp-best-seller-template.md.
 */

import { createServerSupabase } from "./supabase-server";
import {
  fetchTemplateStatus,
  sendTemplate,
  uploadMediaFromUrl,
  type TemplateStatus,
} from "./meta-whatsapp";
import { publicSiteOrigin } from "./site-url";
import { logWhatsAppMessageSoon } from "./whatsapp-message-log";
import { allDishPricing, formatInr, type DishPricing } from "./menu/dish-pricing";
import { KITCHEN_PICK_DISH_IDS } from "./menu/best-selling";
import { whatsappBotLink } from "./whatsapp-copy";

export const BEST_SELLER_TEMPLATE_NAME = "best_selling_today";
export const BEST_SELLER_TEMPLATE_LANG = "en";

/** Meta allows up to 10 carousel cards; 3 reads best on a phone. */
export const BEST_SELLER_CARD_COUNT = 3;

export type CampaignDish = {
  dish: DishPricing;
  imageUrl: string;
};

/**
 * The template definition to submit for review.
 *
 * Exported rather than inlined into a script so the approval doc, the send
 * path and the submit endpoint all describe the same template. Every card has
 * the same component shape — Meta rejects carousels whose cards differ.
 */
export function bestSellerTemplateDefinition(): Record<string, unknown> {
  const card = (index: number) => ({
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: [`REPLACE_WITH_MEDIA_HANDLE_${index + 1}`],
        },
      },
      {
        type: "BODY",
        text: "{{1}}\nFrom {{2}} — cooked to order.",
        example: { body_text: [["Mom's Recipe Chicken Gravy", "₹349"]] },
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "QUICK_REPLY", text: "Order this" }],
      },
    ],
  });

  return {
    name: BEST_SELLER_TEMPLATE_NAME,
    language: BEST_SELLER_TEMPLATE_LANG,
    category: "MARKETING",
    // Lets Meta re-file the template instead of rejecting it outright if it
    // reads the wording as a different category.
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text: "Selling fastest at Vidya's Kitchen this week. Everything is cooked to order, so we need 24 hours' notice.",
      },
      {
        type: "CAROUSEL",
        cards: Array.from({ length: BEST_SELLER_CARD_COUNT }, (_, i) => card(i)),
      },
    ],
  };
}

/** Components for one send, filling the variables the template declared. */
/**
 * Fill the approved template for today's dishes.
 *
 * Card images are passed as Meta media IDs, not links — a carousel card header
 * is the one template header that will not accept a URL. `mediaIds` comes from
 * uploading each image once per campaign.
 */
export function bestSellerTemplateComponents(
  dishes: CampaignDish[],
  mediaIds: string[],
): Record<string, unknown>[] {
  return [
    {
      type: "carousel",
      cards: dishes.slice(0, BEST_SELLER_CARD_COUNT).map((entry, index) => ({
        card_index: index,
        components: [
          {
            type: "header",
            parameters: [{ type: "image", image: { id: mediaIds[index] } }],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: entry.dish.name },
              { type: "text", text: formatInr(entry.dish.prices["500gm"]) },
            ],
          },
          {
            type: "button",
            sub_type: "quick_reply",
            index: "0",
            parameters: [{ type: "payload", payload: `order_${entry.dish.retailerId}` }],
          },
        ],
      })),
    },
  ];
}

/** Today's line-up, from real sales when there are enough, else kitchen picks. */
export async function bestSellingDishes(limit = BEST_SELLER_CARD_COUNT): Promise<CampaignDish[]> {
  const byDishId = new Map(allDishPricing().map((d) => [d.dishId, d]));
  const origin = publicSiteOrigin();
  const toCampaign = (dish: DishPricing): CampaignDish => ({
    dish,
    imageUrl: `${origin}/menu-images/${dish.retailerId}.jpg`,
  });

  try {
    const res = await fetch(`${origin}/api/menu/best-selling`, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { ids?: string[] };
      const ranked = (body.ids || []).map((id) => byDishId.get(id)).filter((d): d is DishPricing => Boolean(d));
      if (ranked.length >= limit) return ranked.slice(0, limit).map(toCampaign);
    }
  } catch (e) {
    console.error("[WA marketing] best-selling lookup failed, using kitchen picks:", e);
  }

  // Same cold-start answer the app's home carousel gives, rather than an
  // invented ranking.
  const picks = KITCHEN_PICK_DISH_IDS.map((id) => byDishId.get(id)).filter((d): d is DishPricing => Boolean(d));
  return picks.slice(0, limit).map(toCampaign);
}

export type CampaignRecipient = { phone: string };

/**
 * Everyone who has ordered before and has not opted out.
 *
 * Deliberately not "everyone who ever messaged": a marketing template to
 * someone who only ever asked a question is the fastest way to lose the
 * number's quality rating.
 */
export async function campaignAudience(limit = 500): Promise<CampaignRecipient[]> {
  const db = createServerSupabase();

  const { data: optOuts } = await db.from("users").select("phone_number, marketing_opt_out");
  const blocked = new Set(
    ((optOuts || []) as { phone_number?: string; marketing_opt_out?: boolean }[])
      .filter((u) => u.marketing_opt_out)
      .map((u) => String(u.phone_number || "").replace(/\D/g, "").slice(-10)),
  );

  const { data, error } = await db
    .from("orders")
    .select("phone_number")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[WA marketing] audience query failed:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const out: CampaignRecipient[] = [];
  for (const row of (data || []) as { phone_number?: string | null }[]) {
    const digits = String(row.phone_number || "").replace(/\D/g, "");
    const key = digits.slice(-10);
    if (key.length !== 10 || seen.has(key) || blocked.has(key)) continue;
    seen.add(key);
    out.push({ phone: digits });
    if (out.length >= limit) break;
  }
  return out;
}

export type CampaignResult = {
  status: TemplateStatus;
  attempted: number;
  sent: number;
  failed: number;
  skippedReason?: string;
};

/**
 * Send the campaign, or explain why it did not go.
 *
 * While the template is still in review this returns cleanly with its status
 * instead of throwing — the founder can wire up the trigger and the schedule
 * before Meta has approved anything, and it starts working on approval.
 */
export async function sendBestSellerCampaign(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<CampaignResult> {
  const status = await fetchTemplateStatus(BEST_SELLER_TEMPLATE_NAME);

  if (status !== "APPROVED") {
    return {
      status,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason:
        status === "PENDING"
          ? "Template is still in review with Meta. Nothing sent."
          : `Template status is ${status}. See docs/whatsapp-best-seller-template.md.`,
    };
  }

  const dishes = await bestSellingDishes();
  if (dishes.length < BEST_SELLER_CARD_COUNT) {
    return { status, attempted: 0, sent: 0, failed: 0, skippedReason: "Not enough dishes to fill the carousel." };
  }

  const audience = await campaignAudience(opts?.limit ?? 500);
  if (opts?.dryRun) {
    return { status, attempted: audience.length, sent: 0, failed: 0, skippedReason: "Dry run — nothing sent." };
  }

  // Upload the three card images once, not once per recipient.
  const cards = dishes.slice(0, BEST_SELLER_CARD_COUNT);
  const mediaIds: string[] = [];
  for (const entry of cards) {
    const id = await uploadMediaFromUrl(entry.imageUrl);
    if (!id) {
      return {
        status,
        attempted: 0,
        sent: 0,
        failed: 0,
        skippedReason: `Could not upload the card image for ${entry.dish.name}. Nothing sent.`,
      };
    }
    mediaIds.push(id);
  }

  const components = bestSellerTemplateComponents(cards, mediaIds);
  let sent = 0;
  let failed = 0;

  for (const recipient of audience) {
    const r = await sendTemplate(
      recipient.phone,
      BEST_SELLER_TEMPLATE_NAME,
      BEST_SELLER_TEMPLATE_LANG,
      components,
    );
    if (r.success) {
      sent += 1;
      logWhatsAppMessageSoon({
        phone: recipient.phone,
        direction: "out",
        kind: "template",
        body: BEST_SELLER_TEMPLATE_NAME,
        payload: { template: BEST_SELLER_TEMPLATE_NAME, language: BEST_SELLER_TEMPLATE_LANG },
        provider: "meta",
        waMessageId: r.messageId,
      });
    } else failed += 1;
  }

  return { status, attempted: audience.length, sent, failed };
}

/** Link a customer can tap to stop campaigns. Referenced by the approval doc. */
export function marketingOptOutLink(): string {
  return whatsappBotLink("Stop marketing messages");
}
