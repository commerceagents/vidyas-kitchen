/**
 * Meta WhatsApp Cloud API.
 *
 * Pinned to v23.0, which is what Meta's own carousel examples use and is GA
 * until October 2027. Meta documents no minimum version for the free-form
 * carousel, so this is the lowest version the payload is known good on rather
 * than the lowest that works. The carousels we sent on v21 came back 400 and
 * fell through to a plain text list, which is why the menu had no photos.
 *
 * Every send funnels through `postMessage` so a rejection is logged with Meta's
 * own error code and payload path. Richer message types fail for boring
 * reasons (an image URL Meta can't fetch, a retailer ID missing from the
 * catalog) and without the real error in the Vercel log there is nothing to
 * debug.
 */

const GRAPH_API_VERSION = "v23.0";
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
 * Convert phone number to E.164 digits for Meta API.
 * Input: "9941292729" | "919941292729" | "+919941292729" → "919941292729"
 */
export function toMetaPhoneNumber(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

export function fromMetaWebhook(metaPhone: string): string {
  return metaPhone.replace(/\D/g, "");
}

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

type MetaErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
    error_user_title?: string;
    error_user_msg?: string;
  };
};

function describeMetaError(label: string, status: number, body: MetaErrorBody): string {
  const e = body.error || {};
  const parts = [
    e.message,
    e.error_data?.details,
    e.error_user_title,
    e.error_user_msg,
    e.code != null ? `code=${e.code}` : null,
    e.error_subcode != null ? `subcode=${e.error_subcode}` : null,
    `http=${status}`,
  ].filter(Boolean);
  const described = parts.join(" | ") || "Unknown Meta error";
  console.error(`[Meta WhatsApp] ${label} rejected (${GRAPH_API_VERSION}): ${described}`);
  return described;
}

/** Single exit point to Meta so failures are always logged the same way. */
async function postMessage(label: string, payload: Record<string, unknown>): Promise<MetaSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: describeMetaError(label, response.status, data as MetaErrorBody) };
    }
    return { success: true, messageId: (data as { messages?: { id?: string }[] }).messages?.[0]?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Meta WhatsApp] ${label} threw:`, message);
    return { success: false, error: message };
  }
}

function envelope(to: string, body: Record<string, unknown>): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toMetaPhoneNumber(to),
    ...body,
  };
}

export async function sendText(to: string, text: string): Promise<MetaSendResult> {
  return postMessage(
    "text",
    envelope(to, { type: "text", text: { preview_url: false, body: text } }),
  );
}

export type SendButtonsOptions = {
  headerImageUrl?: string;
};

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  options?: SendButtonsOptions,
): Promise<MetaSendResult> {
  const interactive: Record<string, unknown> = {
    type: "button",
    body: { text: bodyText.substring(0, 1024) },
    action: {
      // Meta allows max 3 reply buttons, 20 chars each.
      buttons: buttons.slice(0, 3).map((btn) => ({
        type: "reply",
        reply: { id: btn.id.substring(0, 256), title: btn.title.substring(0, 20) },
      })),
    },
  };

  if (options?.headerImageUrl) {
    interactive.header = { type: "image", image: { link: options.headerImageUrl } };
  }

  return postMessage("buttons", envelope(to, { type: "interactive", interactive }));
}

export async function sendCtaUrl(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  options?: { headerImageUrl?: string; footer?: string },
): Promise<MetaSendResult> {
  const interactive: Record<string, unknown> = {
    type: "cta_url",
    body: { text: bodyText.substring(0, 1024) },
    action: {
      name: "cta_url",
      parameters: { display_text: buttonText.substring(0, 20), url },
    },
  };
  if (options?.headerImageUrl) {
    interactive.header = { type: "image", image: { link: options.headerImageUrl } };
  }
  if (options?.footer) {
    interactive.footer = { text: options.footer.substring(0, 60) };
  }
  return postMessage("cta_url", envelope(to, { type: "interactive", interactive }));
}

export type ListRow = { id: string; title: string; description?: string };
export type ListSection = { title: string; rows: ListRow[] };

export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<MetaSendResult> {
  return postMessage(
    "list",
    envelope(to, {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText.substring(0, 1024) },
        action: {
          button: buttonLabel.substring(0, 20),
          sections: sections.slice(0, 10).map((sec) => ({
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
  );
}

export type CarouselCard = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  buttonTitle?: string;
  /** Set to turn the card's button into a link instead of a quick reply. */
  url?: string;
};

/**
 * Free-form interactive carousel (no Commerce Manager IDs, no template).
 *
 * The payload that kept 400-ing had two faults besides the API version: cards
 * carried no `type`, and their buttons used the `reply` shape that plain button
 * messages use. Carousel cards are typed — `quick_reply` or `cta_url` — and
 * their buttons must match that type.
 */
export async function sendCarousel(
  to: string,
  bodyText: string,
  cards: CarouselCard[],
): Promise<MetaSendResult> {
  const slice = cards.slice(0, 10);
  if (slice.length < 2) {
    return { success: false, error: "Carousel needs at least 2 cards" };
  }

  // "Button types and numbers must match across all cards." One stray card
  // with a url would otherwise invalidate the whole message, so the first
  // card decides the shape and the rest follow it.
  const asLinks = Boolean(slice[0].url);

  return postMessage(
    "carousel",
    envelope(to, {
      type: "interactive",
      interactive: {
        type: "carousel",
        // Main header, footer and buttons are not supported on a carousel.
        body: { text: bodyText.substring(0, 1024) },
        action: {
          cards: slice.map((card, i) => ({
            card_index: i,
            // Always cta_url, even for quick-reply cards. Meta's docs show
            // this literal value in both worked examples and document no
            // quick_reply card type at all.
            type: "cta_url",
            header: { type: "image", image: { link: card.imageUrl } },
            body: { text: card.body.substring(0, 160) },
            action: asLinks
              ? {
                  // A url card puts its single button here, not in buttons[].
                  name: "cta_url",
                  parameters: {
                    display_text: (card.buttonTitle || card.title).substring(0, 20),
                    url: card.url,
                  },
                }
              : {
                  buttons: [
                    {
                      type: "quick_reply",
                      quick_reply: {
                        id: card.id.substring(0, 256),
                        title: (card.buttonTitle || card.title).substring(0, 20),
                      },
                    },
                  ],
                },
          })),
        },
      },
    }),
  );
}

export type ProductSection = { title: string; productRetailerIds: string[] };

/**
 * Multi-Product Message. Meta renders the photo, name and price straight from
 * the connected catalog, so retailer IDs must exist there exactly — an invented
 * ID takes the whole message down with it.
 *
 * Limits: 10 sections, 30 products total.
 */
export async function sendProductList(
  to: string,
  catalogId: string,
  headerText: string,
  bodyText: string,
  sections: ProductSection[],
  footerText?: string,
): Promise<MetaSendResult> {
  let remaining = 30;
  const trimmed: { title: string; product_items: { product_retailer_id: string }[] }[] = [];
  for (const section of sections.slice(0, 10)) {
    if (remaining <= 0) break;
    const ids = section.productRetailerIds.slice(0, remaining);
    if (ids.length === 0) continue;
    remaining -= ids.length;
    trimmed.push({
      title: section.title.substring(0, 24),
      product_items: ids.map((id) => ({ product_retailer_id: id })),
    });
  }

  if (trimmed.length === 0) {
    return { success: false, error: "No catalog products to send" };
  }

  const interactive: Record<string, unknown> = {
    type: "product_list",
    header: { type: "text", text: headerText.substring(0, 60) },
    body: { text: bodyText.substring(0, 1024) },
    action: { catalog_id: catalogId, sections: trimmed },
  };
  if (footerText) interactive.footer = { text: footerText.substring(0, 60) };

  return postMessage("product_list", envelope(to, { type: "interactive", interactive }));
}

/** Single Product Message — one catalog card, used when only one dish matched. */
export async function sendSingleProduct(
  to: string,
  catalogId: string,
  productRetailerId: string,
  bodyText: string,
  footerText?: string,
): Promise<MetaSendResult> {
  const interactive: Record<string, unknown> = {
    type: "product",
    body: { text: bodyText.substring(0, 1024) },
    action: { catalog_id: catalogId, product_retailer_id: productRetailerId },
  };
  if (footerText) interactive.footer = { text: footerText.substring(0, 60) };

  return postMessage("product", envelope(to, { type: "interactive", interactive }));
}

/**
 * Static location pin. Business accounts have no live-location API, so an
 * out-for-delivery ping is an honest snapshot of where the driver was, not a
 * moving dot we cannot actually provide.
 */
export async function sendLocation(
  to: string,
  latitude: number,
  longitude: number,
  name: string,
  address: string,
): Promise<MetaSendResult> {
  return postMessage(
    "location",
    envelope(to, {
      type: "location",
      location: {
        latitude,
        longitude,
        name: name.substring(0, 60),
        address: address.substring(0, 120),
      },
    }),
  );
}

export type TemplateComponent = Record<string, unknown>;

/** Approved template send — the only way to reach someone outside 24 hours. */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[],
): Promise<MetaSendResult> {
  return postMessage(
    `template:${templateName}`,
    envelope(to, {
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  );
}

/**
 * Upload an image to Meta and get back a media asset ID.
 *
 * Carousel template cards are the one place a media header will not take a
 * public URL: Meta documents `id` only, unlike every other template header
 * where `link` works. So each card image has to be pushed through here first.
 *
 * IDs are reusable for 30 days, and a campaign send hits every recipient with
 * the same three images, so results are cached well inside that window rather
 * than re-uploading per recipient.
 */
const mediaIdCache = new Map<string, { id: string; expires: number }>();
const MEDIA_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function uploadMediaFromUrl(imageUrl: string): Promise<string | null> {
  const cached = mediaIdCache.get(imageUrl);
  if (cached && cached.expires > Date.now()) return cached.id;

  let config: MetaWhatsAppConfig;
  try {
    config = getConfig();
  } catch {
    return null;
  }

  try {
    const source = await fetch(imageUrl);
    if (!source.ok) {
      console.error(`[Meta WhatsApp] media upload: could not fetch ${imageUrl} (http=${source.status})`);
      return null;
    }
    const contentType = source.headers.get("content-type") || "image/jpeg";
    const blob = await source.blob();

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", contentType);
    form.append("file", blob, imageUrl.split("/").pop() || "image.jpg");

    const res = await fetch(`${GRAPH_API_URL}/${config.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(describeMetaError("media_upload", res.status, data as MetaErrorBody));
      return null;
    }

    const id = (data as { id?: string }).id;
    if (!id) return null;
    mediaIdCache.set(imageUrl, { id, expires: Date.now() + MEDIA_ID_TTL_MS });
    return id;
  } catch (e) {
    console.error("[Meta WhatsApp] media upload threw:", e);
    return null;
  }
}

export async function markAsRead(messageId: string): Promise<boolean> {
  const r = await postMessage("read_receipt", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
  return r.success;
}

// ─── Template management (WABA-level, not the messages endpoint) ──────────────

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "UNKNOWN";

function wabaId(): string | null {
  return (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim() || null;
}

async function graphGet(path: string): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, data: null, error: "Missing WHATSAPP_ACCESS_TOKEN" };
  try {
    const res = await fetch(`${GRAPH_API_URL}/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, data, error: describeMetaError(`GET ${path}`, res.status, data as MetaErrorBody) };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Approval status for a template, so a send path can degrade instead of erroring. */
export async function fetchTemplateStatus(templateName: string): Promise<TemplateStatus> {
  const waba = wabaId();
  if (!waba) return "UNKNOWN";
  const r = await graphGet(
    `${waba}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,status,category`,
  );
  if (!r.ok) return "UNKNOWN";
  const rows = (r.data as { data?: { name?: string; status?: string }[] }).data || [];
  const match = rows.find((row) => row.name === templateName);
  const status = String(match?.status || "").toUpperCase();
  const known: TemplateStatus[] = ["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"];
  return (known as string[]).includes(status) ? (status as TemplateStatus) : "UNKNOWN";
}

/** Submit a template definition for review. Returns Meta's message on failure. */
export async function createMessageTemplate(
  definition: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  const waba = wabaId();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!waba) return { ok: false, error: "Missing WHATSAPP_BUSINESS_ACCOUNT_ID" };
  if (!accessToken) return { ok: false, error: "Missing WHATSAPP_ACCESS_TOKEN" };

  try {
    const res = await fetch(`${GRAPH_API_URL}/${waba}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(definition),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: describeMetaError("create_template", res.status, data as MetaErrorBody),
      };
    }
    const d = data as { id?: string; status?: string };
    return { ok: true, id: d.id, status: d.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
