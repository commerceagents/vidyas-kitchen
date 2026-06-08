import { publicSiteOrigin } from "@/lib/site-url";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { OrderStatus } from "@/lib/order-status";
import { sendText, sendButtons, sendCtaUrl } from "@/lib/twilio-whatsapp";
import type { SupabaseClient } from "@supabase/supabase-js";

/** WhatsApp reply id: rate + star (1–5) + 32-char hex uuid (no dashes). */
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

/** Normalize phone to pure digits with country code */
function toPhone(phoneRaw: string): string | null {
  const d = phoneRaw.replace(/\D/g, "");
  if (d.length >= 10) return d.startsWith("91") ? d : `91${d.slice(-10)}`;
  return null;
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
  const to = order.phone_number ? toPhone(order.phone_number) : null;
  if (!to) return;

  const trackUrl = `${publicSiteOrigin()}/?track=${order.id}`;
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);

  switch (order.status) {
    case OrderStatus.PAID: {
      const body =
        `✅ *Order confirmed!* (#${order.id.slice(0, 8).toUpperCase()}…)\n\n` +
        (slotLine ? `📅 *Slot:* ${slotLine}\n\n` : "") +
        `We've received your payment. The kitchen will start soon.`;
      await sendCtaUrl(to, body, trackUrl, "Track order");
      break;
    }
    case OrderStatus.CONFIRMED: {
      const short = order.id.slice(0, 8).toUpperCase();
      const cancelUrl = `${publicSiteOrigin()}/?cancelOrder=${order.id}&phone=${encodeURIComponent(order.phone_number || "")}`;
      const body =
        `🎉 *Order accepted!* (#${short}…)\n\n` +
        (slotLine ? `📅 *Slot:* ${slotLine}\n\n` : "") +
        `Your order is confirmed. You can cancel up to 12 hours before your delivery slot.`;
      await sendCtaUrl(to, body, cancelUrl, "Cancel Order");
      break;
    }
    case OrderStatus.PREPARING: {
      await sendButtons(
        to,
        "👩‍🍳 Your meal is being prepared! We'll notify you when it's out for delivery.",
        [{ id: "track_order", title: "Track order" }],
      );
      break;
    }
    case OrderStatus.OUT_FOR_DELIVERY: {
      await sendButtons(
        to,
        "🛵 Your driver has picked up your order! They're on the way to you.",
        [{ id: "track_order", title: "Track order" }],
      );
      break;
    }
    case OrderStatus.DELIVERED: {
      await sendText(
        to,
        "🍽️ *Your order has been delivered!*\n\n" +
        "How was everything? Rate your experience:\n\n" +
        "1. ⭐⭐⭐⭐⭐ Excellent\n" +
        "2. ⭐⭐⭐⭐ Great\n" +
        "3. ⭐⭐⭐ Good\n" +
        "4. ⭐⭐ Fair\n" +
        "5. ⭐ Poor\n\n" +
        "_Reply with a number to rate._",
      );
      break;
    }
    case OrderStatus.CANCELLED: {
      const short = order.id.slice(0, 8).toUpperCase();
      await sendText(
        to,
        `Your order *#${short}…* has been *cancelled* as you requested.\n\n` +
        `If anything looks wrong or you were charged in error, reply here and we'll help.`,
      );
      break;
    }
    case OrderStatus.REJECTED: {
      const short = order.id.slice(0, 8).toUpperCase();
      const amt = order.total_amount != null ? `₹${Number(order.total_amount).toLocaleString("en-IN")}` : "your payment";
      await sendText(
        to,
        `Sorry, your order *#${short}…* could not be accepted by the kitchen.\n\n` +
        `A full refund of *${amt}* has been initiated — it should arrive within 5–7 working days.\n\n` +
        `We apologise for the inconvenience. Reply here if you need help.`,
      );
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
 * Kitchen marked order READY — notify driver via WhatsApp with link to driver app.
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
  const to = toPhone(driverRaw);
  if (!to) {
    console.warn("[whatsapp-order-notify] Invalid DRIVER_WHATSAPP_PHONE");
    return;
  }

  const { data: row, error } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_address,
      users:customer_id ( full_name ),
      order_items ( quantity, menu_items ( name ) )
    `)
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
    itemLine = items.length === 1 ? `${nm} × ${q}` : `${nm} × ${q} +${items.length - 1} more`;
  }

  const body =
    `🍱 *New delivery ready!*\n\n` +
    `Customer: ${customerName}\n` +
    `Item: ${itemLine}\n` +
    `Address: ${r.delivery_address || "—"}`;

  const url = `${publicSiteOrigin()}/driver/order/${encodeURIComponent(orderId)}`;
  await sendCtaUrl(to, body, url, "View & Pick Up");
}
