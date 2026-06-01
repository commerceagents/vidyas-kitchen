import { publicSiteOrigin } from "@/lib/site-url";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { OrderStatus } from "@/lib/order-status";
import type { SupabaseClient } from "@supabase/supabase-js";

function logGraph(data: unknown) {
  const err = (data as { error?: { message?: string; code?: number } })?.error;
  if (err?.message) console.error("[whatsapp-order-notify]", err.message);
  else console.log("[whatsapp-order-notify]", JSON.stringify(data));
}

/** WhatsApp Cloud API: digits only, country code without + */
function toWhatsAppRecipient(phoneRaw: string): string | null {
  const d = phoneRaw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10).length === 10 ? `91${d.slice(-10)}` : d;
  return null;
}

async function postWhatsApp(payload: object) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    console.warn("[whatsapp-order-notify] Skipped: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN");
    return;
  }
  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  logGraph(data);
}

async function sendCtaUrl(to: string, body: string, url: string, displayText: string) {
  await postWhatsApp({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body.slice(0, 1024) },
      action: {
        name: "cta_url",
        parameters: {
          display_text: displayText.slice(0, 20),
          url,
        },
      },
    },
  });
}

async function sendButtons(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
) {
  await postWhatsApp({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 200), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** WhatsApp reply id: rate + star (1–5) + 32-char hex uuid (no dashes). Meta: [a-zA-Z0-9_-] */
export function encodeOrderRatingButtonId(stars: number, orderId: string): string {
  const hex = orderId.replace(/-/g, "");
  return `rate${stars}${hex}`.slice(0, 200);
}

export function decodeOrderRatingButtonId(id: string): { stars: number; orderId: string } | null {
  const m = id.match(/^rate([1-5])([0-9a-f]{32})$/i);
  if (!m) return null;
  const hex = m[2];
  const orderId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { stars: Number(m[1]), orderId };
}

type NotifyOrderRow = {
  id: string;
  status: string;
  phone_number?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  total_amount?: number | null;
};

export async function notifyWhatsAppOrderEvent(order: NotifyOrderRow): Promise<void> {
  const to = order.phone_number ? toWhatsAppRecipient(order.phone_number) : null;
  if (!to) return;

  const trackUrl = `${publicSiteOrigin()}/?track=${order.id}`;
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);

  switch (order.status) {
    case OrderStatus.PAID: {
      const body =
        `✅ *Order confirmed!* (#${order.id.slice(0, 8).toUpperCase()}…)\n\n` +
        (slotLine ? `📅 *Slot:* ${slotLine}\n\n` : "") +
        `We’ve received your payment. The kitchen will start soon.`;
      await sendCtaUrl(to, body, trackUrl, "Track order");
      break;
    }
    case OrderStatus.CONFIRMED: {
      const short = order.id.slice(0, 8).toUpperCase();
      const cancelUrl = `${publicSiteOrigin()}/?cancelOrder=${order.id}&phone=${encodeURIComponent(order.phone_number || "")}`;
      const body =
        `\u{1F389} *Order accepted!* (#${short}\u2026)\n\n` +
        (slotLine ? `\u{1F4C5} *Slot:* ${slotLine}\n\n` : "") +
        `Your order is confirmed. You can cancel up to 12 hours before your delivery slot.`;
      await sendCtaUrl(to, body, cancelUrl, "Cancel Order");
      break;
    }
    case OrderStatus.PREPARING: {
      await sendButtons(
        to,
        "👩‍🍳 Your meal is being prepared! We'll notify you when it's out for delivery.",
        [
          { id: "track_order", title: "Track order" },
        ],
      );
      break;
    }
    case OrderStatus.OUT_FOR_DELIVERY: {
      await sendButtons(
        to,
        "🛵 Your driver has picked up your order! They’re on the way to you.",
        [
          { id: "track_order", title: "Track order" },
        ],
      );
      break;
    }
    case OrderStatus.DELIVERED: {
      await sendButtons(
        to,
        "🍽️ *Your order has been delivered!*\n\nHow was everything? Tap a rating below.",
        [
          { id: encodeOrderRatingButtonId(5, order.id), title: "⭐ 5" },
          { id: encodeOrderRatingButtonId(4, order.id), title: "⭐ 4" },
          { id: encodeOrderRatingButtonId(3, order.id), title: "⭐ 3" },
        ],
      );
      await sendButtons(to, "More ratings:", [
        { id: encodeOrderRatingButtonId(2, order.id), title: "⭐ 2" },
        { id: encodeOrderRatingButtonId(1, order.id), title: "⭐ 1" },
      ]);
      break;
    }
    case OrderStatus.CANCELLED: {
      const short = order.id.slice(0, 8).toUpperCase();
      await postWhatsApp({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body:
            `Your order *#${short}…* has been *cancelled* as you requested.\n\n` +
            `If anything looks wrong or you were charged in error, reply here and we’ll help.`,
        },
      });
      break;
    }
    case OrderStatus.REJECTED: {
      const short = order.id.slice(0, 8).toUpperCase();
      const amt = order.total_amount != null ? `₹${Number(order.total_amount).toLocaleString("en-IN")}` : "your payment";
      await postWhatsApp({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body:
            `Sorry, your order *#${short}…* could not be accepted by the kitchen.\n\n` +
            `A full refund of *${amt}* has been initiated — it should arrive within 5–7 working days.\n\n` +
            `We apologise for the inconvenience. Reply here if you need help.`,
        },
      });
      break;
    }
    default:
      break;
  }
}

type OrderItemRow = {
  quantity?: number | null;
  menu_items?: { name?: string | null } | null;
};

/**
 * Kitchen marked order READY — notify driver with deep link to driver app.
 * Set `DRIVER_WHATSAPP_PHONE` in env (same digit rules as customer numbers).
 */
export async function notifyWhatsAppDriverNewDeliveryReady(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const driverRaw = process.env.DRIVER_WHATSAPP_PHONE;
  if (!driverRaw?.trim()) {
    console.warn("[whatsapp-order-notify] Skipped driver notify: set DRIVER_WHATSAPP_PHONE");
    return;
  }
  const to = toWhatsAppRecipient(driverRaw);
  if (!to) {
    console.warn("[whatsapp-order-notify] Invalid DRIVER_WHATSAPP_PHONE");
    return;
  }

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      delivery_address,
      users:customer_id ( full_name ),
      order_items ( quantity, menu_items ( name ) )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !row) {
    console.error("[whatsapp-order-notify] driver fetch", error?.message);
    return;
  }

  const r = row as {
    id: string;
    delivery_address?: string | null;
    users?: { full_name?: string | null } | null;
    order_items?: OrderItemRow[] | null;
  };

  const customerName = r.users?.full_name?.trim() || "Customer";
  const items = Array.isArray(r.order_items) ? r.order_items : [];
  const first = items[0];
  let itemLine = "See kitchen list";
  if (first) {
    const nm = String(first.menu_items?.name || "Item");
    const q = Math.max(1, Math.floor(Number(first.quantity) || 1));
    if (items.length === 1) {
      itemLine = `${nm} × ${q}`;
    } else {
      itemLine = `${nm} × ${q} +${items.length - 1} more`;
    }
  }

  const body =
    `🍱 *New delivery ready!*\n\n` +
    `Customer: ${customerName}\n` +
    `Item: ${itemLine}\n` +
    `Address: ${r.delivery_address || "—"}`;

  const url = `${publicSiteOrigin()}/driver/order/${encodeURIComponent(orderId)}`;
  await sendCtaUrl(to, body, url, "View & Pick Up");
}
