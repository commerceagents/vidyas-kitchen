import { publicSiteOrigin } from "@/lib/site-url";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { OrderStatus, codFailureLabel, formatOrderRef } from "@/lib/order-status";
import { sendText, sendButtons, sendCtaUrl } from "@/lib/whatsapp-send";
import {
  notifyOrderPaid,
  notifyOrderPlacedCod,
  notifyCodCollected,
  notifyOrderUndelivered,
  notifyOrderAccepted,
  notifyOrderPreparing,
  notifyOrderOutForDelivery,
  notifyOrderDelivered,
  notifyOrderCancelled,
  notifyOrderRejected,
  driverPinCaption,
  BTN,
} from "@/lib/whatsapp-copy";
import { updateSession } from "@/lib/whatsapp-session";
import { loadWaLang } from "@/lib/whatsapp-lang";
import { formatInr } from "@/lib/menu/dish-pricing";
import { sendLocation } from "@/lib/whatsapp-send";
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

/** Numbered WA list: 1 Excellent → 5★ … 5 Not satisfied → 1★ */
export function deliveredRatingPendingOptions(orderId: string): { id: string; title: string }[] {
  const labels = ["Excellent", "Good", "Okay", "Could be better", "Not satisfied"] as const;
  const starByChoice = [5, 4, 3, 2, 1] as const;
  return labels.map((title, i) => ({
    id: encodeOrderRatingButtonId(starByChoice[i], orderId),
    title,
  }));
}

function toPhone(phoneRaw: string): string | null {
  const d = phoneRaw.replace(/\D/g, "");
  if (d.length >= 10) return d.startsWith("91") ? d : `91${d.slice(-10)}`;
  return null;
}

type NotifyOrderRow = {
  id: string;
  order_number?: number | null;
  status: string;
  phone_number?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  total_amount?: number | null;
  payment_method?: string | null;
  /** Set for the synthetic cod_collected / undelivered events. */
  cod_failure_reason?: string | null;
};

/** Events that aren't order statuses but still notify the customer. */
export const OrderNotifyEvent = {
  COD_COLLECTED: "cod_collected",
} as const;

export async function notifyWhatsAppOrderEvent(order: NotifyOrderRow): Promise<void> {
  const to = order.phone_number ? toPhone(order.phone_number) : null;
  if (!to) return;

  const trackUrl = `${publicSiteOrigin()}/?track=${order.id}`;
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  // Same reference the kitchen dashboard and the app show, so a customer
  // quoting it over WhatsApp can actually be looked up.
  const short = formatOrderRef(order.order_number, order.id).replace(/^#/, "");
  const isCod = String(order.payment_method || "").toLowerCase() === "cod";
  const amtStr = order.total_amount != null ? formatInr(Number(order.total_amount)) : "the order amount";
  // Read the stored choice rather than the in-memory cache: an outbound
  // notification usually runs on a serverless instance that has never seen
  // this customer, and the cache would silently answer "English".
  const lang = (await loadWaLang(to)) ?? undefined;

  switch (order.status) {
    case OrderStatus.PAID: {
      // A COD order reaches `paid` (= placed) with nothing collected yet, so it
      // must never claim we received money.
      const body = isCod
        ? notifyOrderPlacedCod(short, amtStr, slotLine || undefined, lang)
        : notifyOrderPaid(short, slotLine || undefined, lang);
      await sendCtaUrl(to, body, trackUrl, BTN.track);
      break;
    }
    case OrderNotifyEvent.COD_COLLECTED: {
      await sendText(to, notifyCodCollected(short, amtStr, lang));
      break;
    }
    case OrderStatus.UNDELIVERED: {
      await sendText(to, notifyOrderUndelivered(short, codFailureLabel(order.cod_failure_reason).toLowerCase(), lang));
      break;
    }
    case OrderStatus.CONFIRMED: {
      const cancelUrl = `${publicSiteOrigin()}/?cancelOrder=${order.id}&phone=${encodeURIComponent(order.phone_number || "")}`;
      const body = notifyOrderAccepted(short, slotLine || undefined, lang);
      await sendCtaUrl(to, body, cancelUrl, "Cancel Order");
      break;
    }
    case OrderStatus.PREPARING: {
      await sendButtons(to, notifyOrderPreparing(lang), [{ id: "track_order", title: BTN.track }]);
      break;
    }
    case OrderStatus.OUT_FOR_DELIVERY: {
      await sendButtons(to, notifyOrderOutForDelivery(lang), [{ id: "track_order", title: BTN.track }]);
      break;
    }
    case OrderStatus.DELIVERED: {
      const ratingMsg = notifyOrderDelivered(lang);
      // Reply "1"…"5" → resolveNumbered → correct ★ (1=Excellent=5★)
      try {
        await updateSession(to, { pending_options: deliveredRatingPendingOptions(order.id) });
      } catch (e) {
        console.error("[WA] store delivered rating options", e);
      }
      await sendText(to, ratingMsg);
      break;
    }
    case OrderStatus.CANCELLED: {
      await sendText(to, notifyOrderCancelled(short, lang));
      break;
    }
    case OrderStatus.REJECTED: {
      // Nothing was collected on a COD order, so don't promise a refund.
      await sendText(to, notifyOrderRejected(short, amtStr, !isCod, lang));
      break;
    }
    default:
      break;
  }
}

/**
 * Static pin for a driver GPS ping, sent while the order is out for delivery.
 *
 * A WhatsApp Business account cannot send live location, so this is an honest
 * snapshot with the time it was taken, plus the app link for the real map.
 * Throttled to one pin every few minutes — the driver app reports far more
 * often than that, and a stream of pins would be unusable.
 */
const DRIVER_PIN_MIN_GAP_MS = 6 * 60 * 1000;

export async function notifyWhatsAppDriverLocation(
  supabase: SupabaseClient,
  orderId: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const { data, error } = await supabase
    .from("orders")
    .select("id, phone_number, status, driver_pin_sent_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return;

  const row = data as {
    phone_number?: string | null;
    status?: string | null;
    driver_pin_sent_at?: string | null;
  };
  if (String(row.status || "").toLowerCase() !== OrderStatus.OUT_FOR_DELIVERY) return;

  const to = row.phone_number ? toPhone(row.phone_number) : null;
  if (!to) return;

  const lastSent = row.driver_pin_sent_at ? Date.parse(row.driver_pin_sent_at) : 0;
  if (Number.isFinite(lastSent) && Date.now() - lastSent < DRIVER_PIN_MIN_GAP_MS) return;

  const lang = (await loadWaLang(to)) ?? undefined;
  const sent = await sendLocation(to, lat, lng, "Your driver", "On the way to you");
  if (!sent) return;

  await sendCtaUrl(
    to,
    driverPinCaption(1, lang),
    `${publicSiteOrigin()}/?track=${orderId}`,
    BTN.track,
  );

  // Column may not exist yet if the migration has not run — a failure here
  // only costs throttling, never the pin itself.
  const { error: stampError } = await supabase
    .from("orders")
    .update({ driver_pin_sent_at: new Date().toISOString() })
    .eq("id", orderId);
  if (stampError) console.error("[whatsapp-order-notify] driver pin stamp:", stampError.message);
}

type OrderItemRow = {
  quantity?: number | null;
  menu_items?: { name?: string | null } | null;
};

export async function notifyWhatsAppDriverNewDeliveryReady(
  supabase: SupabaseClient,
  orderId: string,
  driverPhone?: string,
): Promise<void> {
  const driverRaw = driverPhone || process.env.DRIVER_WHATSAPP_PHONE;
  if (!driverRaw?.trim()) {
    console.warn("[whatsapp-order-notify] Skipped driver notify: no driver phone");
    return;
  }
  const to = toPhone(driverRaw);
  if (!to) {
    console.warn("[whatsapp-order-notify] Invalid driver phone");
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
    `*New delivery ready*\n\n` +
    `Customer: ${customerName}\n` +
    `Item: ${itemLine}\n` +
    `Address: ${r.delivery_address || "—"}`;

  const url = `${publicSiteOrigin()}/driver/order/${encodeURIComponent(orderId)}`;
  await sendCtaUrl(to, body, url, "View and pick up");
}
