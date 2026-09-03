/**
 * Meta WhatsApp Cloud API Helper
 * Replaces Twilio with native Meta WhatsApp Business API
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

function getConfig(): MetaWhatsAppConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
  }

  return { accessToken, phoneNumberId };
}

/**
 * Convert phone number to E.164 format for Meta API
 * Input: "9941292729" or "919941292729" or "+919941292729"
 * Output: "919941292729"
 */
export function toMetaPhoneNumber(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

/**
 * Extract phone number from Meta webhook format
 */
export function fromMetaWebhook(metaPhone: string): string {
  return metaPhone.replace(/\D/g, "");
}

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message via Meta WhatsApp Cloud API
 */
export async function sendText(to: string, text: string): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta WhatsApp] Send error:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send message",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta WhatsApp] Send exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an interactive button message (up to 3 buttons)
 */
export type SendButtonsOptions = {
  headerImageUrl?: string;
};

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  options?: SendButtonsOptions,
): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);

    // Meta allows max 3 buttons
    const limitedButtons = buttons.slice(0, 3);

    const interactive: Record<string, unknown> = {
      type: "button",
      body: {
        text: bodyText.substring(0, 1024),
      },
      action: {
        buttons: limitedButtons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20), // Max 20 chars
          },
        })),
      },
    };

    if (options?.headerImageUrl) {
      interactive.header = {
        type: "image",
        image: { link: options.headerImageUrl },
      };
    }

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta WhatsApp] Send buttons error:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send buttons",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta WhatsApp] Send buttons exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a CTA URL button message
 */
export async function sendCtaUrl(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string
): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text: bodyText,
          },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonText.substring(0, 20),
              url: url,
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta WhatsApp] Send CTA URL error:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send CTA URL",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta WhatsApp] Send CTA URL exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type ListRow = { id: string; title: string; description?: string };
export type ListSection = { title: string; rows: ListRow[] };

/**
 * Send an interactive list message (menu picker)
 */
export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText.substring(0, 1024) },
          action: {
            button: buttonLabel.substring(0, 20),
            sections: sections.map((sec) => ({
              title: sec.title.substring(0, 24),
              rows: sec.rows.slice(0, 10).map((row) => ({
                id: row.id.substring(0, 200),
                title: row.title.substring(0, 24),
                description: row.description?.substring(0, 72) || undefined,
              })),
            })),
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta WhatsApp] Send list error:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send list",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta WhatsApp] Send list exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type CarouselCard = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  buttonTitle?: string;
};

/**
 * Native image carousel (no Commerce Manager IDs).
 * Meta may reject this on unverified accounts — caller must fall back.
 */
export async function sendCarousel(
  to: string,
  bodyText: string,
  cards: CarouselCard[],
): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);
    const slice = cards.slice(0, 10);
    if (slice.length < 2) {
      return { success: false, error: "Carousel needs at least 2 cards" };
    }

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive: {
          type: "carousel",
          body: { text: bodyText.substring(0, 1024) },
          action: {
            cards: slice.map((card, i) => ({
              card_index: i,
              header: {
                type: "image",
                image: { link: card.imageUrl },
              },
              body: { text: card.body.substring(0, 160) },
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: card.id.substring(0, 200),
                      title: (card.buttonTitle || card.title).substring(0, 20),
                    },
                  },
                ],
              },
            })),
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Meta WhatsApp] Send carousel error:", data);
      return { success: false, error: data.error?.message || "Failed to send carousel" };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error("[Meta WhatsApp] Send carousel exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Commerce Manager product list. Only call with a real catalog_id and
 * retailer IDs that exist in that catalog.
 */
export async function sendProductList(
  to: string,
  catalogId: string,
  headerText: string,
  bodyText: string,
  sections: { title: string; productRetailerIds: string[] }[],
): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const recipient = toMetaPhoneNumber(to);

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive: {
          type: "product_list",
          header: { type: "text", text: headerText.substring(0, 60) },
          body: { text: bodyText.substring(0, 1024) },
          action: {
            catalog_id: catalogId,
            sections: sections.slice(0, 10).map((sec) => ({
              title: sec.title.substring(0, 24),
              product_items: sec.productRetailerIds.slice(0, 30).map((id) => ({
                product_retailer_id: id,
              })),
            })),
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Meta WhatsApp] Send product_list error:", data);
      return { success: false, error: data.error?.message || "Failed to send product list" };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error("[Meta WhatsApp] Send product_list exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId: string): Promise<boolean> {
  try {
    const { accessToken, phoneNumberId } = getConfig();

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Meta WhatsApp] Mark as read error:", error);
    return false;
  }
}
