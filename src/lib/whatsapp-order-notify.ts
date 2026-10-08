import { publicSiteOrigin } from "@/lib/site-url";
import { formatSlotLineForCustomer, slotWindowEnded } from "@/lib/delivery-slots";
import { OrderStatus, codFailureLabel, formatOrderRef, normalizeOrderStatus } from "@/lib/order-status";
import { sendText, sendButtons, sendCtaUrl, sendCarousel, type WaSendOutcome } from "@/lib/whatsapp-send";
import {
  sendGiftOrderTemplate,
  sendOrderUpdateTemplate,
} from "@/lib/whatsapp-order-templates";
import {
  buildOrderStatusWhatsApp,
  notifyCodCollected,
  notifyOrderUndelivered,
  notifyOrderCancelled,
  notifyOrderRejected,
  driverPinCaption,
  notifyDriverArrived,
  notifyGiftSenderDriverArrived,
  giftRecipientWhatsApp,
  giftRecipientSms,
  olderOrderAskReply,
  olderOrderButtons,
  olderOrderTemplateLine,
  BTN,
  type GiftNotifyKind,
  type OlderOrderKind,
  type WaOrderBill,
  type WaOrderStage,
} from "@/lib/whatsapp-copy";
import { giftTrackUrl } from "@/lib/gift-track";
import { sendSms } from "@/lib/sms";
import { toE164Phone } from "@/lib/test-numbers";
import { getSession, updateSession } from "@/lib/whatsapp-session";
import { staleNoticeAlreadySent, turnsWithStaleOrder } from "@/lib/whatsapp-stale-order";
import { loadWaLang } from "@/lib/whatsapp-lang";
import { formatInr } from "@/lib/menu/dish-pricing";
import { formatFullDishName } from "@/lib/dish-name";
import { publicDishImageUrl } from "@/lib/whatsapp-catalog";
import {
  computeOrderBreakdownFromItemSubtotal,
  orderItemsSubtotal,
} from "@/lib/order-pricing";
import { sendLocation } from "@/lib/whatsapp-send";
import { logWhatsAppMessageSoon } from "@/lib/whatsapp-message-log";
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

/**
 * Meta only delivers a free-form card inside 24 hours of the customer's last
 * reply. An app order never opens that window, and Meta can still answer 200
 * and then drop the card. The approved template is what actually arrives.
 */
async function hasOpenServiceWindow(to: string): Promise<boolean> {
  const digits = to.replace(/\D/g, "");
  const keys = [digits, digits.slice(-10)].filter((v, i, a) => v && a.indexOf(v) === i);
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("created_at")
      .eq("direction", "in")
      .in("phone", keys)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.created_at) return false;
    const at = Date.parse(String(data.created_at));
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < 23 * 60 * 60 * 1000;
  } catch {
    return false;
  }
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
  payment_status?: string | null;
  refund_status?: string | null;
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
        name: formatFullDishName(rawName) || rawName,
        quantity: qty,
        lineTotal: unit * qty,
        imageUrl: publicDishImageUrl(
          {
            image_url: row.menu_items?.image_url ?? undefined,
            retailer_id: row.menu_items?.retailer_id ?? undefined,
          },
          { fallbackLogo: false },
        ) || undefined,
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

function cancelledOrderImageUrl(bill: WaOrderBill, kind: "cancelled" | "rejected"): string {
  const origin = publicSiteOrigin();
  const raw = bill.items.find((it) => it.imageUrl)?.imageUrl || "";
  const img = raw.startsWith("http")
    ? raw
    : raw
      ? `${origin}${raw.startsWith("/") ? "" : "/"}${raw}`
      : "";
  const q = new URLSearchParams({ kind });
  if (img) q.set("img", img);
  return `${origin}/api/og/cancelled-order?${q.toString()}`;
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
): Promise<WaSendOutcome> {
  // Never use the brand logo as a status header — that is why every update
  // used to open with the same red chef card.
  const photos = bill.items.filter((it) => it.imageUrl && !it.imageUrl.includes("vk_logo_full"));
  if (photos.length >= 2) {
    const sent = await sendCarousel(
      to,
      body,
      photos.slice(0, 10).map((it, i) => ({
        id: `dish-${i}`,
        title: it.name.slice(0, 60),
        body: `× ${it.quantity} · ${formatInr(it.lineTotal)}`.slice(0, 160),
        imageUrl: it.imageUrl!,
        buttonTitle: BTN.track,
        url: trackUrl,
      })),
    );
    if (sent) return { ok: true };
  }
  return sendCtaUrl(to, body, trackUrl, BTN.track, {
    headerImageUrl: photos[0]?.imageUrl,
  });
}

/**
 * One line per stage for the template, which has no room for the full card.
 * Deliberately plain: Meta reviews utility templates for transactional tone.
 */
const TEMPLATE_STATUS_LINE: Record<WaOrderStage, string> = {
  placed_cod: "We have received your order. Pay cash or UPI when it arrives.",
  placed_paid: "We have received your order and payment.",
  accepted: "The kitchen has accepted your order.",
  preparing: "The kitchen has started cooking your food.",
  packed: "Your food is packed and waiting for the driver.",
  dispatched: "Your driver has picked up the order and is on the way.",
  delivered: "Your order has been delivered. Thank you.",
  cancelled: "Your order has been cancelled.",
  rejected: "Sorry, the kitchen could not accept your order.",
  cod_collected: "We have received your payment. Thank you.",
  undelivered: "We could not hand over your order at the door.",
};

/** Sent to the person who placed a gift, when the recipient is the one who pays. */
const GIFT_COD_BUYER_LINE =
  "We have received your order. The person receiving it pays the driver, in cash or by scanning the driver's QR.";

function recipientPaysAtDoor(
  buyerPhone: string | null | undefined,
  recipientPhone: string | null | undefined,
): boolean {
  const buyer = String(buyerPhone || "").replace(/\D/g, "").slice(-10);
  const recipient = String(recipientPhone || "").replace(/\D/g, "").slice(-10);
  return recipient.length === 10 && recipient !== buyer;
}

function giftKindForStatus(status: string): GiftNotifyKind | null {
  switch (status) {
    case OrderStatus.PAID:
      return "placed";
    case OrderStatus.OUT_FOR_DELIVERY:
      return "dispatched";
    case OrderStatus.DELIVERED:
      return "delivered";
    case OrderStatus.CANCELLED:
    case OrderStatus.REJECTED:
      return "cancelled";
    default:
      return null;
  }
}

async function displayNameForPhone(
  phoneRaw: string | null | undefined,
  fallback: string,
): Promise<string> {
  const e164 = phoneRaw ? toE164Phone(phoneRaw) : "";
  const digits = phoneRaw ? phoneRaw.replace(/\D/g, "").slice(-10) : "";
  const candidates = [e164, phoneRaw || "", digits].filter((v, i, a) => v && a.indexOf(v) === i);
  try {
    const supabase = createServerSupabase();
    for (const p of candidates) {
      const { data } = await supabase.from("users").select("full_name").eq("phone_number", p).maybeSingle();
      const name = String((data as { full_name?: string | null } | null)?.full_name || "").trim();
      if (name) return name.split(/\s+/)[0];
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

function olderKindForLiveStage(stage: WaOrderStage): OlderOrderKind | null {
  if (stage === "dispatched") return "unfinished_trip";
  if (stage === "accepted" || stage === "preparing" || stage === "packed") return "not_sent";
  return null;
}

async function sendOlderOrderNotice(
  to: string,
  order: NotifyOrderRow,
  ref: string,
  kind: OlderOrderKind,
  trackUrl: string,
): Promise<void> {
  const session = await getSession(to).catch(() => null);
  if (session && staleNoticeAlreadySent(session.recent_turns, order.id, kind)) return;

  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind) || "the booked time";
  const text = olderOrderAskReply(ref, slotLine, kind);
  const buttons = olderOrderButtons(kind);
  try {
    await updateSession(to, {
      pending_options: buttons,
      recent_turns: turnsWithStaleOrder(session?.recent_turns, order.id, kind),
    });
  } catch (e) {
    console.error("[whatsapp-order-notify] store older-order buttons", e);
  }
  if (await hasOpenServiceWindow(to)) {
    const outcome = await sendButtons(to, text, buttons);
    if (outcome.ok) return;
  }
  await sendOrderUpdateTemplate(to, {
    name: await displayNameForPhone(order.phone_number, "there"),
    ref,
    line: olderOrderTemplateLine(kind),
    slot: slotLine,
    url: trackUrl,
  });
}

/** Template wording for the updates that follow the first gift message. */
const GIFT_TEMPLATE_LINE: Record<Exclude<GiftNotifyKind, "placed">, string> = {
  dispatched: "The driver has left the kitchen with your food.",
  arrived: "The driver is at your door with your food.",
  delivered: "Your food has been delivered. Enjoy.",
  cancelled: "Sorry, this order has been cancelled.",
};

async function notifyGiftRecipient(order: NotifyOrderRow, kind: GiftNotifyKind): Promise<void> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("orders")
      .select("recipient_name, recipient_phone, phone_number")
      .eq("id", order.id)
      .maybeSingle();
    const recPhone = String((data as { recipient_phone?: string | null } | null)?.recipient_phone || "").replace(/\D/g, "");
    const buyerPhone = String(
      (data as { phone_number?: string | null } | null)?.phone_number || order.phone_number || "",
    ).replace(/\D/g, "");
    if (recPhone.length < 10) return;
    if (buyerPhone.slice(-10) === recPhone.slice(-10)) return;

    const recipientName =
      String((data as { recipient_name?: string | null } | null)?.recipient_name || "").trim().split(/\s+/)[0] ||
      "there";
    const sender = await displayNameForPhone(order.phone_number, "A friend");
    const bill = await loadOrderBill(order);
    const itemsLine =
      bill.items.length === 0
        ? "A Vidya's Kitchen order"
        : bill.items.length === 1
          ? `${bill.items[0].name} × ${bill.items[0].quantity}`
          : `${bill.items[0].name} +${bill.items.length - 1} more`;
    const url = giftTrackUrl(order.id, recPhone);
    const isCod = String(order.payment_method || "").toLowerCase() === "cod";
    const giftStale =
      (kind === "dispatched" || kind === "arrived") && slotWindowEnded(order.delivery_slot);
    const waBody = giftStale
      ? olderOrderAskReply(
          bill.ref,
          bill.slotLine || "the booked time",
          "unfinished_trip",
        )
      : giftRecipientWhatsApp(kind, {
      sender,
      itemsLine,
      slotLine: bill.slotLine,
      isCod,
      amount: bill.amount,
    });
    const smsBody = giftStale
      ? olderOrderAskReply(bill.ref, bill.slotLine || "the booked time", "unfinished_trip")
      : giftRecipientSms(kind, {
      sender,
      url,
      itemsLine,
      slotLine: bill.slotLine,
      isCod,
      amount: bill.amount,
    });

    /**
     * Gift recipient delivery strategy — ordered from most-reliable to least.
     *
     * Meta silently accepts free-form sends to new recipients (HTTP 200) but
     * never delivers them when the person has never initiated contact with the
     * business account. The 200 is misleading — the message is queued and then
     * dropped on Meta's side, with no error or webhook. This produced a log
     * entry showing OUT (success) while the friend received nothing.
     *
     * Fix: for the initial "placed" notification always use the approved
     * gift_order_placed template — it is the one path guaranteed to reach a
     * first-time recipient. Free-form can follow as a richer card for repeat
     * customers, but the template goes first.
     *
     * For subsequent status updates (dispatched, arrived, delivered,
     * cancelled) both paths are tried in order because those recipients are
     * more likely to have an open session from tapping the track link.
     */
    const waTo = toPhone(recPhone);
    let delivered = false;
    if (waTo) {
      if (kind === "placed") {
        // Template first — guaranteed delivery to new recipients.
        delivered = await sendGiftOrderTemplate(waTo, {
          name: recipientName,
          sender,
          ref: bill.ref,
          itemsLine,
          slot: bill.slotLine || "See the tracking link",
          payLine: isCod
            ? `Please pay ${formatInr(bill.amount)} to the driver. Cash, or scan the QR on their phone.`
            : "Already paid. Just receive it at the door.",
          url,
        });
        if (!delivered) {
          logWhatsAppMessageSoon({
            phone: waTo,
            direction: "out",
            kind: "template",
            body: `[FAILED] gift placed template to recipient`,
            payload: { orderId: order.id, ref: bill.ref, giftKind: kind, recipient: true, template: "gift_order_placed" },
            provider: "meta",
            error: "gift_order_placed template failed — check template approval and that the number is on WhatsApp",
          });
          // Template failed — try the richer free-form card as a last attempt
          // before falling through to SMS.
          const cardOutcome = await sendOrderCard(waTo, waBody, bill, url);
          delivered = cardOutcome.ok;
        }
      } else {
        // Status updates: try free-form first (recipient may have open session
        // from tapping the track link), fall back to template if rejected.
        let freeFormError: string | null = null;
        try {
          const outcome = giftStale
            ? await sendText(waTo, waBody)
            : await sendCtaUrl(waTo, waBody, url, BTN.track);
          delivered = outcome.ok;
          if (!outcome.ok) freeFormError = outcome.error ?? "Meta rejected free-form";
        } catch (e) {
          freeFormError = e instanceof Error ? e.message : String(e);
          console.error("[whatsapp-order-notify] gift WhatsApp", e);
        }
        if (!delivered) {
          logWhatsAppMessageSoon({
            phone: waTo,
            direction: "out",
            kind: "text",
            body: `[FAILED] gift ${kind} free-form to recipient — ${freeFormError ?? "rejected"}`,
            payload: { orderId: order.id, ref: bill.ref, giftKind: kind, recipient: true },
            provider: "meta",
            error: freeFormError ?? "Meta rejected free-form message to gift recipient",
          });
          delivered = await sendOrderUpdateTemplate(waTo, {
            name: recipientName,
            ref: bill.ref,
            line: giftStale ? olderOrderTemplateLine("unfinished_trip") : GIFT_TEMPLATE_LINE[kind],
            slot: bill.slotLine || "See the tracking link",
            url,
          });
        }
      }
      if (!delivered) {
        logWhatsAppMessageSoon({
          phone: waTo,
          direction: "out",
          kind: "template",
          body: `[FAILED] gift ${kind} all WhatsApp paths failed — falling back to SMS`,
          payload: {
            orderId: order.id,
            ref: bill.ref,
            giftKind: kind,
            recipient: true,
          },
          provider: "meta",
          error: "All WhatsApp paths failed for gift recipient — SMS fallback will be attempted.",
        });
      }
    }
    if (!delivered) await sendSms(recPhone, smsBody);
  } catch (e) {
    console.error("[whatsapp-order-notify] gift recipient", e);
  }
}

export async function notifyWhatsAppOrderEvent(order: NotifyOrderRow): Promise<void> {
  const giftKind = giftKindForStatus(order.status);
  // Awaited, never fire-and-forget: serverless can freeze the moment the caller
  // responds, which silently drops the recipient's message. notifyGiftRecipient
  // swallows its own errors, so this cannot break the buyer's notification.
  if (giftKind) await notifyGiftRecipient(order, giftKind);

  const to = order.phone_number ? toPhone(order.phone_number) : null;
  if (!to) return;

  const trackUrl = `${publicSiteOrigin()}/?track=${order.id}`;
  const short = formatOrderRef(order.order_number, order.id).replace(/^#/, "");
  const isCod = String(order.payment_method || "").toLowerCase() === "cod";
  const wasPaid =
    !isCod && String(order.payment_status || "").toLowerCase() === "paid";
  const refundStatus = String(order.refund_status || "");
  const refundStarted = wasPaid && refundStatus === "refunded";
  const refundFailed = wasPaid && refundStatus === "refund_failed";
  const amtStr = order.total_amount != null ? formatInr(Number(order.total_amount)) : "the order amount";
  const lang = (await loadWaLang(to)) ?? undefined;
  const bill = await loadOrderBill(order);
  let recipientPays = false;
  if (isCod) {
    try {
      const supabase = createServerSupabase();
      const { data } = await supabase
        .from("orders")
        .select("recipient_phone, phone_number")
        .eq("id", order.id)
        .maybeSingle();
      const row = data as { recipient_phone?: string | null; phone_number?: string | null } | null;
      recipientPays = recipientPaysAtDoor(row?.phone_number || order.phone_number, row?.recipient_phone);
    } catch {
      recipientPays = false;
    }
  }
  if (recipientPays) bill.recipientPays = true;
  const lineFor = (stage: WaOrderStage) =>
    stage === "placed_cod" && recipientPays ? GIFT_COD_BUYER_LINE : TEMPLATE_STATUS_LINE[stage];

  /**
   * Rich card first, approved template if WhatsApp refuses it. The refusal is
   * routine, not exceptional: outside the 24-hour service window every
   * free-form message is rejected, which is why app-only customers used to see
   * their order move through the dashboard without a single WhatsApp arriving.
   */
  const fallbackToTemplate = async (stage: WaOrderStage, outcome: WaSendOutcome) => {
    if (outcome.ok) return;
    // Log the free-form failure so the kitchen owner can see it in the dashboard
    // without needing Vercel log access.
    logWhatsAppMessageSoon({
      phone: to,
      direction: "out",
      kind: "text",
      body: `[FAILED] ${stage} — ${outcome.error ?? "Meta rejected free-form"}`,
      payload: { stage, orderId: order.id, ref: short },
      provider: "meta",
      error: outcome.error ?? "Meta rejected free-form message",
    });
    const sent = await sendOrderUpdateTemplate(to, {
      name: await displayNameForPhone(order.phone_number, "there"),
      ref: short,
        line: lineFor(stage),
      slot: bill.slotLine || "See the app for your slot",
      url: trackUrl,
    });
    if (!sent) {
      console.error(
        `[whatsapp-order-notify] order ${short} ${stage}: free-form and template both failed`,
      );
      // Also log template failure to the DB.
      logWhatsAppMessageSoon({
        phone: to,
        direction: "out",
        kind: "template",
        body: `[FAILED] ${stage} template — order_update`,
        payload: { stage, orderId: order.id, ref: short, template: "order_update" },
        provider: "meta",
        error: "order_update template also failed — check WHATSAPP_ACCESS_TOKEN and template approval",
      });
    }
  };

  const card = async (stage: WaOrderStage) => {
    const olderKind = olderKindForLiveStage(stage);
    if (olderKind && slotWindowEnded(order.delivery_slot)) {
      await sendOlderOrderNotice(to, order, short, olderKind, trackUrl);
      return;
    }
    // App orders never open a WhatsApp chat, so the rich card is dropped and
    // the customer sees nothing. Send the approved template first in that case.
    if (!(await hasOpenServiceWindow(to))) {
      const sent = await sendOrderUpdateTemplate(to, {
        name: await displayNameForPhone(order.phone_number, "there"),
        ref: short,
        line: lineFor(stage),
        slot: bill.slotLine || "See the app for your slot",
        url: trackUrl,
      });
      if (sent) return;
    }
    const body = buildOrderStatusWhatsApp(stage, bill, lang);
    // Photo + receipt only on the first confirmation. Later updates stay
    // short — repeating the same header (or the brand logo) made the thread
    // look like a stack of identical posters.
    const outcome =
      stage === "placed_cod" || stage === "placed_paid"
        ? await sendOrderCard(to, body, bill, trackUrl)
        : await sendCtaUrl(to, body, trackUrl, BTN.track);
    await fallbackToTemplate(stage, outcome);
  };

  switch (order.status) {
    case OrderStatus.PAID:
      await card(isCod ? "placed_cod" : "placed_paid");
      break;
    case OrderNotifyEvent.COD_COLLECTED:
      await fallbackToTemplate(
        "cod_collected",
        await sendText(to, notifyCodCollected(short, amtStr, lang)),
      );
      break;
    case OrderStatus.UNDELIVERED:
      await fallbackToTemplate(
        "undelivered",
        await sendText(
          to,
          notifyOrderUndelivered(short, codFailureLabel(order.cod_failure_reason).toLowerCase(), lang),
        ),
      );
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
      await fallbackToTemplate(
        "delivered",
        await sendOrderCard(to, buildOrderStatusWhatsApp("delivered", bill, lang), bill, trackUrl),
      );
      break;
    }
    case OrderStatus.CANCELLED:
      await fallbackToTemplate(
        "cancelled",
        await sendCtaUrl(
          to,
          notifyOrderCancelled(short, lang, refundStarted ? { amount: amtStr } : null, refundFailed),
          trackUrl,
          BTN.track,
          { headerImageUrl: cancelledOrderImageUrl(bill, "cancelled") },
        ),
      );
      break;
    case OrderStatus.REJECTED:
      await fallbackToTemplate(
        "rejected",
        await sendCtaUrl(
          to,
          notifyOrderRejected(short, amtStr, refundStarted, lang, refundFailed),
          trackUrl,
          BTN.track,
          { headerImageUrl: cancelledOrderImageUrl(bill, "rejected") },
        ),
      );
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
    .select("id, phone_number, status, driver_pin_sent_at, delivery_slot")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return;

  const row = data as {
    phone_number?: string | null;
    status?: string | null;
    driver_pin_sent_at?: string | null;
    delivery_slot?: string | null;
  };
  if (String(row.status || "").toLowerCase() !== OrderStatus.OUT_FOR_DELIVERY) return;
  if (slotWindowEnded(row.delivery_slot)) return;

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

/** The driver has reached the door — sent once, from the arrival endpoint. */
export async function notifyWhatsAppDriverArrived(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, phone_number, recipient_phone, status, payment_method, payment_status, total_amount, delivery_slot, delivery_slot_kind, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return;

  const row = data as {
    phone_number?: string | null;
    recipient_phone?: string | null;
    status?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    total_amount?: number | null;
    delivery_slot?: string | null;
    delivery_slot_kind?: string | null;
    order_number?: number | null;
  };
  if (normalizeOrderStatus(String(row.status || "")) !== OrderStatus.OUT_FOR_DELIVERY) return;

  if (slotWindowEnded(row.delivery_slot)) {
    const toStale = row.phone_number ? toPhone(row.phone_number) : null;
    if (!toStale) return;
    const ref = formatOrderRef(row.order_number, orderId).replace(/^#/, "");
    await sendOlderOrderNotice(
      toStale,
      {
        id: orderId,
        status: OrderStatus.OUT_FOR_DELIVERY,
        phone_number: row.phone_number,
        delivery_slot: row.delivery_slot,
        delivery_slot_kind: row.delivery_slot_kind,
        order_number: row.order_number,
      },
      ref,
      "unfinished_trip",
      `${publicSiteOrigin()}/?track=${orderId}`,
    );
    return;
  }

  await notifyGiftRecipient(
    {
      id: orderId,
      status: OrderStatus.OUT_FOR_DELIVERY,
      phone_number: row.phone_number,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      total_amount: row.total_amount,
    },
    "arrived",
  );

  const to = row.phone_number ? toPhone(row.phone_number) : null;
  if (!to) return;

  const cashDue =
    String(row.payment_method || "").toLowerCase() === "cod" &&
    String(row.payment_status || "").toLowerCase() !== "paid";
  const lang = (await loadWaLang(to)) ?? undefined;
  const arrivedCopy = recipientPaysAtDoor(row.phone_number, row.recipient_phone)
    ? notifyGiftSenderDriverArrived(cashDue, Number(row.total_amount) || 0, lang)
    : notifyDriverArrived(cashDue, Number(row.total_amount) || 0, lang);

  await sendCtaUrl(
    to,
    arrivedCopy,
    `${publicSiteOrigin()}/?track=${orderId}`,
    BTN.track,
  );
}

