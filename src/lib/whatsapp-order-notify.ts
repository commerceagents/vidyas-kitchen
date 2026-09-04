import { publicSiteOrigin } from "@/lib/site-url";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { OrderStatus, codFailureLabel, formatOrderRef } from "@/lib/order-status";
import { sendText, sendCtaUrl, sendCarousel } from "@/lib/whatsapp-send";
import {
  buildOrderStatusWhatsApp,
  notifyCodCollected,
  notifyOrderUndelivered,
  notifyOrderCancelled,
  notifyOrderRejected,
  driverPinCaption,
  BTN,
  type WaOrderBill,
  type WaOrderStage,
} from "@/lib/whatsapp-copy";
import { updateSession } from "@/lib/whatsapp-session";
import { loadWaLang } from "@/lib/whatsapp-lang";
import { formatInr } from "@/lib/menu/dish-pricing";
import { parseRecipeTag } from "@/lib/dish-name";
import { publicDishImageUrl } from "@/lib/whatsapp-catalog";
import {
  computeOrderBreakdownFromItemSubtotal,
  orderItemsSubtotal,
} from "@/lib/order-pricing";
import { sendLocation } from "@/lib/whatsapp-send";
import { createServerSupabase } from "@/lib/supabase-server";
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

async function loadOrderBill(order: NotifyOrderRow): Promise<WaOrderBill> {
  const short = formatOrderRef(order.order_number, order.id).replace(/^#/, "");
  const isCod = String(order.payment_method || "").toLowerCase() === "cod";
  const empty: WaOrderBill = {
    ref: short,
    slotLine: formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind) || undefined,
    isCod,
    amount: Math.round(Number(order.total_amount) || 0),
    items: [],
    breakdown: { itemsSubtotal: 0, packaging: 0, delivery: 0, gst: 0 },
  };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `id, total_amount, order_items ( quantity, unit_price, menu_items ( name, image_url, retailer_id ) )`,
      )
      .eq("id", order.id)
      .maybeSingle();
    if (error || !data) return empty;

    const rows = (data as {
      total_amount?: number | null;
      order_items?: {
        quantity?: number | null;
        unit_price?: number | null;
        menu_items?: { name?: string | null; image_url?: string | null; retailer_id?: string | null } | null;
      }[] | null;
    }).order_items;

    const items = (Array.isArray(rows) ? rows : []).map((row) => {
      const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
      const unit = Number(row.unit_price) || 0;
      const rawName = String(row.menu_items?.name || "Item");
      return {
        name: parseRecipeTag(rawName).cleanName || rawName,
        quantity: qty,
        lineTotal: unit * qty,
        imageUrl: publicDishImageUrl({
          image_url: row.menu_items?.image_url ?? undefined,
          retailer_id: row.menu_items?.retailer_id ?? undefined,
        }),
      };
    });

    const subtotal = orderItemsSubtotal(
      (Array.isArray(rows) ? rows : []).map((row) => ({
        quantity: Number(row.quantity) || 0,
        unit_price: Number(row.unit_price) || 0,
      })),
    );
    const breakdown = computeOrderBreakdownFromItemSubtotal(subtotal);
    const stored = Number(data.total_amount ?? order.total_amount) || 0;

    return {
      ...empty,
      amount: stored > 0 ? Math.round(stored) : Math.round(breakdown.computedTotal),
      items,
      breakdown,
    };
  } catch (e) {
    console.error("[whatsapp-order-notify] bill load", e);
    return empty;
  }
}

/**
 * Photo + receipt card, with Track opening the app (`/?track=`).
 * Two or more dishes become a carousel; one dish is an image header.
 */
async function sendOrderCard(
  to: string,
  body: string,
  bill: WaOrderBill,
  trackUrl: string,
): Promise<void> {
  const photos = bill.items.filter((it) => it.imageUrl);
  if (photos.length >= 2) {
    const sent = await sendCarousel(
      to,
      body,
      photos.slice(0, 10).map((it, i) => ({
        id: `dish-${i}`,
        title: it.name.slice(0, 60),
        body: `× ${it.quantity} · ${formatInr(it.lineTotal)}`.slice(0, 160),
        imageUrl: it.imageUrl,
        buttonTitle: BTN.track,
        url: trackUrl,
      })),
    );
    if (sent) return;
  }
  await sendCtaUrl(to, body, trackUrl, BTN.track, {
    headerImageUrl: photos[0]?.imageUrl,
  });
}

export async function notifyWhatsAppOrderEvent(order: NotifyOrderRow): Promise<void> {
  const to = order.phone_number ? toPhone(order.phone_number) : null;
  if (!to) return;

  const trackUrl = `${publicSiteOrigin()}/?track=${order.id}`;
  const short = formatOrderRef(order.order_number, order.id).replace(/^#/, "");
  const isCod = String(order.payment_method || "").toLowerCase() === "cod";
  const amtStr = order.total_amount != null ? formatInr(Number(order.total_amount)) : "the order amount";
  const lang = (await loadWaLang(to)) ?? undefined;
  const bill = await loadOrderBill(order);

  const card = async (stage: WaOrderStage) => {
    await sendOrderCard(to, buildOrderStatusWhatsApp(stage, bill, lang), bill, trackUrl);
  };

  switch (order.status) {
    case OrderStatus.PAID:
      await card(isCod ? "placed_cod" : "placed_paid");
      break;
    case OrderNotifyEvent.COD_COLLECTED:
      await sendText(to, notifyCodCollected(short, amtStr, lang));
      break;
    case OrderStatus.UNDELIVERED:
      await sendText(to, notifyOrderUndelivered(short, codFailureLabel(order.cod_failure_reason).toLowerCase(), lang));
      break;
    case OrderStatus.CONFIRMED:
      await card("accepted");
      break;
    case OrderStatus.PREPARING:
      await card("preparing");
      break;
    case OrderStatus.READY:
      await card("packed");
      break;
    case OrderStatus.OUT_FOR_DELIVERY:
      await card("dispatched");
      break;
    case OrderStatus.DELIVERED: {
      try {
        await updateSession(to, { pending_options: deliveredRatingPendingOptions(order.id) });
      } catch (e) {
        console.error("[WA] store delivered rating options", e);
      }
      await sendOrderCard(to, buildOrderStatusWhatsApp("delivered", bill, lang), bill, trackUrl);
      break;
    }
    case OrderStatus.CANCELLED:
      await sendText(to, notifyOrderCancelled(short, lang));
      break;
    case OrderStatus.REJECTED:
      await sendText(to, notifyOrderRejected(short, amtStr, !isCod, lang));
      break;
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
