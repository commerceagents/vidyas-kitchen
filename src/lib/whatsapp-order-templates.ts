/**
 * Utility templates for order notifications.
 *
 * WhatsApp only lets a business send free-form messages inside 24 hours of the
 * customer's last inbound message. Someone who orders in the app and never
 * chats to the bot is outside that window on every single status change, and a
 * gift recipient has never written to us at all — so for them every free-form
 * send is rejected and the thread stays empty. An approved template is the only
 * message Meta will deliver in that state, which is why these exist alongside
 * the richer cards rather than replacing them.
 */

import { publicSiteOrigin } from "@/lib/site-url";
import { sendTemplate, type TemplateComponent } from "@/lib/meta-whatsapp";
import { logWhatsAppMessageSoon } from "@/lib/whatsapp-message-log";

export const ORDER_UPDATE_TEMPLATE_NAME = "order_update";
export const GIFT_ORDER_TEMPLATE_NAME = "gift_order_placed";
export const GIFT_ORDER_SURPRISE_TEMPLATE_NAME = "gift_order_surprise";
export const ORDER_TEMPLATE_LANG = "en";

/** Track links differ only after the origin, so the button takes the tail. */
function urlTail(url: string): string {
  const origin = publicSiteOrigin();
  return url.startsWith(origin) ? url.slice(origin.length).replace(/^\//, "") : url;
}

function trackButton(exampleTail: string): Record<string, unknown> {
  return {
    type: "BUTTONS",
    buttons: [
      {
        type: "URL",
        text: "Track order",
        url: `${publicSiteOrigin()}/{{1}}`,
        example: [`${publicSiteOrigin()}/${exampleTail}`],
      },
    ],
  };
}

/**
 * Meta rejects a body that starts or ends on a variable, so both templates
 * open and close on fixed words.
 */
export function orderUpdateTemplateDefinition(): Record<string, unknown> {
  return {
    name: ORDER_UPDATE_TEMPLATE_NAME,
    language: ORDER_TEMPLATE_LANG,
    category: "UTILITY",
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text:
          "Hi {{1}}, here is an update on your Vidya's Kitchen order #{{2}}.\n\n" +
          "{{3}}\n\n" +
          "Delivery: {{4}}\n" +
          "Tap below to follow it live.",
        example: {
          body_text: [
            ["Priya", "00123", "The kitchen has started cooking your food.", "Today, 1:00 PM - 2:00 PM"],
          ],
        },
      },
      trackButton("?track=7b3f1c2a-0d44-4f1e-9d02-5a6b7c8d9e0f"),
    ],
  };
}

export function giftOrderTemplateDefinition(): Record<string, unknown> {
  return {
    name: GIFT_ORDER_TEMPLATE_NAME,
    language: ORDER_TEMPLATE_LANG,
    category: "UTILITY",
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text:
          "Hi {{1}}, {{2}} has ordered a home-cooked meal for you from Vidya's Kitchen.\n\n" +
          "Order #{{3}}\n" +
          "Items: {{4}}\n" +
          "Delivery: {{5}}\n\n" +
          "{{6}}\n" +
          "Tap below to follow the delivery.",
        example: {
          body_text: [
            [
              "Amma",
              "Simon",
              "00123",
              "Mom's Recipe Chicken Gravy x 1",
              "Today, 1:00 PM - 2:00 PM",
              "Already paid - just receive it at the door.",
            ],
          ],
        },
      },
      trackButton("?track=7b3f1c2a-0d44-4f1e-9d02-5a6b7c8d9e0f&gift=9a1b2c3d4e5f6071"),
    ],
  };
}

/**
 * Surprise-first wording — no two names side-by-side in the opening line.
 * Meta requires the body to start and end on fixed words, not variables.
 * Submit via POST /api/whatsapp/order-templates after deploy.
 */
export function giftOrderSurpriseTemplateDefinition(): Record<string, unknown> {
  return {
    name: GIFT_ORDER_SURPRISE_TEMPLATE_NAME,
    language: ORDER_TEMPLATE_LANG,
    category: "UTILITY",
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text:
          "A meal is on its way to you! 🍛\n\n" +
          "{{1}} ordered it from Vidya's Kitchen — you just open the door.\n\n" +
          "Order #{{2}}\n" +
          "Items: {{3}}\n" +
          "Delivery: {{4}}\n\n" +
          "{{5}}\n" +
          "Tap below to follow it live.",
        example: {
          body_text: [
            [
              "Simon",
              "00123",
              "Mom's Recipe Chicken Gravy x 1",
              "Today, 1:00 PM - 2:00 PM",
              "Already paid - just receive it at the door.",
            ],
          ],
        },
      },
      trackButton("?track=7b3f1c2a-0d44-4f1e-9d02-5a6b7c8d9e0f&gift=9a1b2c3d4e5f6071"),
    ],
  };
}

function body(values: string[]): TemplateComponent {
  return {
    type: "body",
    parameters: values.map((text) => ({ type: "text", text: text.slice(0, 900) || "-" })),
  };
}

function button(url: string): TemplateComponent {
  return {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: urlTail(url) }],
  };
}

async function send(
  to: string,
  templateName: string,
  components: TemplateComponent[],
  logBody: string,
): Promise<boolean> {
  const r = await sendTemplate(to, templateName, ORDER_TEMPLATE_LANG, components);
  if (!r.success) {
    console.error(`[whatsapp-template] ${templateName} failed:`, r.error);
    return false;
  }
  logWhatsAppMessageSoon({
    phone: to,
    direction: "out",
    kind: "template",
    body: logBody,
    payload: { template: templateName },
    provider: "meta",
    waMessageId: r.messageId,
  });
  return true;
}

export async function sendOrderUpdateTemplate(
  to: string,
  input: { name: string; ref: string; line: string; slot: string; url: string },
): Promise<boolean> {
  return send(
    to,
    ORDER_UPDATE_TEMPLATE_NAME,
    [body([input.name, input.ref, input.line, input.slot]), button(input.url)],
    `${input.ref}: ${input.line}`,
  );
}

export async function sendGiftOrderTemplate(
  to: string,
  input: {
    name: string;
    sender: string;
    ref: string;
    itemsLine: string;
    slot: string;
    payLine: string;
    url: string;
  },
): Promise<boolean> {
  // Try the new surprise template first (better wording, no two names in a row).
  // Falls back to the original if it's not approved yet.
  const sent = await send(
    to,
    GIFT_ORDER_SURPRISE_TEMPLATE_NAME,
    [body([input.sender, input.ref, input.itemsLine, input.slot, input.payLine]), button(input.url)],
    `${input.sender} sent an order to ${input.name}`,
  );
  if (sent) return true;

  return send(
    to,
    GIFT_ORDER_TEMPLATE_NAME,
    [
      body([input.name, input.sender, input.ref, input.itemsLine, input.slot, input.payLine]),
      button(input.url),
    ],
    `${input.sender} sent an order to ${input.name}`,
  );
}
