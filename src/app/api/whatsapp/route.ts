import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, after } from "next/server";
import { VidyaAgent, type MenuItem, type Message } from "@/lib/ai/agent";
import { publicSiteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { decodeOrderRatingButtonId } from "@/lib/whatsapp-order-notify";
import { saveOrderRatingByPhone, saveOrderRatingCommentByPhone } from "@/lib/order-rating";
import { createPaymentLink } from "@/lib/payments";
import {
  istCalendarYmd,
  istAddCalendarDays,
  slotStartIsoFor,
  isSlotBookable,
  isValidSlotKind,
  isOrderingWindowOpen,
  formatSlotLineForCustomer,
  slotWindowEnded,
  iterDeliveryDateOptions,
  DELIVERY_SLOT_DEFS,
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import {
  sendText,
  sendButtons,
  sendCtaUrl,
  sendList,
  sendCarousel,
  sendProductList,
  sendLocationRequest,
} from "@/lib/whatsapp-send";
import { fromMetaWebhook } from "@/lib/meta-whatsapp";
import {
  getSession,
  updateSession,
  resetSession,
  type SessionState,
  type WhatsAppSession,
} from "@/lib/whatsapp-session";
import { cartGrandTotal, cartItemsSubtotal, type CartItem } from "@/lib/whatsapp-cart";
import {
  BTN,
  buildUsualChangeMessage,
  buildUsualListBody,
  buildUsualPayNote,
  buildWelcomeMessage,
  welcomeLogoImageUrl,
  buildCategoryListBody,
  buildCategoryMessage,
  buildDishListBody,
  buildVariantMessage,
  buildQtyMessage,
  buildCartMessage,
  buildCartLimitMessage,
  buildLineRemovedMessage,
  buildLineUpdatedMessage,
  buildWhichCartLineMessage,
  buildNotInCartMessage,
  buildCartUnchangedMessage,
  buildItemAddedMessage,
  buildItemsAddedMessage,
  buildDatePickerMessage,
  buildSlotPickerMessage,
  buildAddressChoicesMessage,
  buildMapPinPrompt,
  buildOrderSummaryMessage,
  buildPaymentMessage,
  buildPayMethodPrompt,
  buildCodOverLimitMention,
  buildCodOverLimitReply,
  buildCarouselBody,
  buildOrderIdPendingPaymentMessage,
  buildReorderEmptyMessage,
  buildReuseLastPrompt,
  buildReuseAddressPrompt,
  buildProposalMessage,
  buildInstantGapMessage,
  buildProposalAskMessage,
  buildProposalExpiredMessage,
  buildRatingCommentPrompt,
  buildActiveOrdersMessage,
  buildOrderHistoryMessage,
  buildPaymentsMessage,
  buildOpenAppBody,
  buildPwaPromoBody,
  buildCodPlacedMessage,
  complaintPrompt,
  escalateHumanReply,
  interruptCancelledMessage,
  interruptClarifyMessage,
  interruptMenuAside,
  interruptStatusMessage,
  interruptStillOpenMessage,
  olderOrderAskReply,
  olderOrderArrivedReply,
  olderOrderButtons,
  type OlderOrderKind,
  helpAndSupportReply,
  callUsDialReply,
  languageSetReply,
  marketingOptOutReply,
  notUnderstoodReply,
  ratingThanksReply,
  ratingCommentThanks,
  aiFollowupPrompt,
  ORDER_CUTOFF_REMINDER,
  WA_CART_MAX,
  buildAppNudgeFooter,
} from "@/lib/whatsapp-copy";
import { AGAINST_ORDER_CATEGORIES } from "@/lib/menu/against-order";
import { staticMenuItems, staticMenuByCategory } from "@/lib/menu/whatsapp-menu";
import { createAutoLoginToken } from "@/lib/wa-auto-login";
import { formatFullDishName } from "@/lib/dish-name";
import {
  saveWaLang,
  langForPhone,
  type WaLang,
} from "@/lib/whatsapp-lang";
import {
  fetchLastAddressAndSlot,
  fetchLastOrderSnapshot,
  nextBookableDateForKind,
} from "@/lib/whatsapp-last-order";
import { fetchUsualProfile, type UsualPayment } from "@/lib/whatsapp-usual";
import { isCodAllowedForTotal } from "@/lib/cod-policy";
import { checkSharedPin, checkTypedAddress } from "@/lib/delivery-area";
import { reverseGeocode } from "@/lib/places-search";
import { DELIVERY_ZONE } from "@/lib/delivery-zone";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";
import { redeemOffer, releaseOffer, resolveOfferForCheckout } from "@/lib/offers-server";
import type { AppliedOffer } from "@/lib/offers";
import { isCodBlocked, markOrderPaidAndNotify } from "@/lib/order-transition";
import { PaymentStatus, formatOrderRef } from "@/lib/order-status";
import { hasAppInstalledSignal } from "@/lib/whatsapp-app-signal";
import { logWhatsAppMessage, type WaMessageKind } from "@/lib/whatsapp-message-log";
import { unitPriceFor, packPricesFor, packPriceLine, formatInr, allDishPricing, dishPricingForRetailerId, type DishPricing, type PackSize } from "@/lib/menu/dish-pricing";
import { KITCHEN_PICK_DISH_IDS } from "@/lib/menu/best-selling";
import {
  buildProposal,
  dishQueryCategory,
  fillDraftFromReply,
  isKnownDishQuery,
  isProposalStillValid,
  listDraftGaps,
  looksLikeCompoundOrder,
  parseDateText,
  parseHour,
  parsePackSize,
  parsePackQuantities,
  parseSpokenQuantity,
  parseSlotWord,
  repriceProposal,
  slotKindForHour,
  type OrderProposal,
  type ProposalDraft,
} from "@/lib/ai/order-proposal";
import { resolveCartIntent } from "@/lib/ai/cart-intent";
import { cartUpsellMessage } from "@/lib/ai/cart-upsell";
import {
  cartLineButtonTitle,
  looksLikeCartEdit,
  matchCartLines,
  planScopedCartEdit,
  removeLines,
  setLineQty,
  type ScopedCartEdit,
} from "@/lib/whatsapp-cart-ops";
import { classifyTurnWithModel } from "@/lib/ai/turn-intent";
import {
  asksAboutExistingOrder,
  classifyTurn,
  isPendingState,
  pendingResume,
  readInterrupt,
  routeTurn,
  VK_INTERRUPT_PREFIX,
  withInterrupt,
  type TurnClassification,
} from "@/lib/whatsapp-turn";
import {
  MENU_SECTION_ORDER,
  categoryDisplayLabel,
  parseCatalogProductId,
  retailerIdForCsvPrefix,
  guessRetailerId,
  publicDishImageUrl,
  whatsappCatalogId,
  catalogPackDrawers,
} from "@/lib/whatsapp-catalog";

/**
 * WhatsApp webhook — tap-first checkout, Meta primary with a Twilio fallback.
 *
 * States: idle → browsing_category → picking_item → picking_variant → picking_qty
 *       → cart_review → confirming_last → picking_date → picking_slot
 *       → picking_address → picking_pay_method → awaiting_payment
 * Plus two that sit outside the funnel: rating_comment (after a delivery) and
 * confirming_proposal (a conversational order awaiting its Confirm tap).
 *
 * Two rules hold everywhere in this file:
 *  - Prices come from dish-pricing and totals from whatsapp-cart. Never from
 *    the catalog payload, the session, or arithmetic written inline.
 *  - Every branch replies with something. A silent bot reads as a broken bot.
 */

/**
 * A line from an `order` webhook.
 *
 * `quantity` is deliberately not typed as a number. Meta's reference calls it
 * an integer but prints a decimal in the same table, and the official Node SDK
 * types it as a string, so it is coerced at the point of use. Meta's prices are
 * not modelled at all — they are re-derived server-side, never read.
 */
type CatalogOrderItem = {
  product_retailer_id?: string;
  quantity?: string | number;
};

function ack() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Service-role upsert — never throws; never blocks the WhatsApp reply. */
async function trackWhatsAppUser(phone: string, name: string) {
  try {
    const db = createServerSupabase();
    const { error } = await db
      .from("users")
      .upsert({ phone_number: phone, full_name: name, role: "customer" }, { onConflict: "phone_number" });
    if (error) console.error("[WA] user tracking (non-blocking):", error.code || error.message);
  } catch (e) {
    console.error("[WA] user tracking (non-blocking):", e);
  }
}

function langOf(phone: string): WaLang {
  return langForPhone(phone);
}

async function storeOptions(phone: string, opts: { id: string; title: string }[]) {
  try {
    await updateSession(phone, { pending_options: opts.slice(0, 10) });
  } catch (e) {
    console.error("[WA] storeOptions error (non-critical):", e);
  }
}

async function resolveNumbered(phone: string, text: string): Promise<string | null> {
  // Only a message that is nothing but the button number. "2 500gms" is two
  // packs of 500gm, and parseInt would otherwise treat the leading 2 as
  // button 2 (1kg) and ask for a quantity again.
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1) return null;

  try {
    const session = await getSession(phone);
    const opts = session.pending_options;
    if (!opts || num > opts.length) return null;
    return opts[num - 1].id;
  } catch {
    return null;
  }
}

async function getMenu(): Promise<MenuItem[]> {
  try {
    const { primeFestivalQuote } = await import("@/lib/menu/festival-dishes");
    await primeFestivalQuote(supabase);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .in("category", [...AGAINST_ORDER_CATEGORIES])
      .eq("is_available", true)
      .order("price", { ascending: true });
    if (!error && data?.length) return data as MenuItem[];
  } catch (e) {
    console.error("[WA] getMenu supabase error:", e);
  }
  return staticMenuItems();
}

async function getMenuByCategory(cat: string): Promise<MenuItem[]> {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("category", cat)
      .eq("is_available", true)
      .order("price", { ascending: true });
    if (!error && data?.length) return data as MenuItem[];
  } catch (e) {
    console.error("[WA] getMenuByCategory supabase error:", e);
  }
  return staticMenuByCategory(cat);
}

function findItemByName(menu: MenuItem[], text: string): MenuItem | undefined {
  const lower = text.toLowerCase();
  return menu.find(
    (m) =>
      m.name.toLowerCase() === lower ||
      m.name.toLowerCase().includes(lower) ||
      lower.includes(m.name.toLowerCase().replace(/[()]/g, "").trim()),
  );
}

function parseDateInput(text: string): string | null {
  const stripped = text.trim().replace(/^date_/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) return stripped;

  const lower = text.toLowerCase().trim();
  const today = istCalendarYmd();

  if (/^(tomo|tomorrow|naalai|nalai|tmr|tmrw)/.test(lower)) return istAddCalendarDays(today, 1);
  if (/^(day after|dayafter|naalai marra)/.test(lower)) return istAddCalendarDays(today, 2);

  const dayMap: Record<string, number> = {
    mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
    thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 0, sunday: 0,
  };

  for (const [key, target] of Object.entries(dayMap)) {
    if (lower.startsWith(key)) {
      const now = new Date();
      const current = now.getDay();
      let diff = target - current;
      if (diff <= 0) diff += 7;
      return istAddCalendarDays(today, diff);
    }
  }

  const numMatch = text.match(/^(\d)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10);
    if (idx >= 1 && idx <= 5) return istAddCalendarDays(today, idx);
  }

  return null;
}

function parseSlotInput(text: string): DeliverySlotKind | null {
  const lower = text.toLowerCase().trim().replace(/^slot_/, "");
  if (lower === "1" || /breakfast/i.test(lower)) return "breakfast";
  if (lower === "2" || /lunch/i.test(lower)) return "lunch";
  if (lower === "3" || /dinner/i.test(lower)) return "dinner";
  if (isValidSlotKind(lower)) return lower;
  return null;
}

function dateLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function slotLabel(kind: string): string {
  return DELIVERY_SLOT_DEFS[kind as DeliverySlotKind]?.label ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** They already named the family, the size, and the meal. Ask only which dish. */
function whichDishAsk(draft: ProposalDraft, source: string): string {
  const family = dishQueryCategory(source) || dishQueryCategory(String(draft.items?.[0]?.dish || ""));
  const noun =
    family === "mutton" ? "mutton gravy" : family === "chicken" ? "chicken gravy" : family === "egg" ? "egg dish" : "dish";
  const size = parsePackSize(String(draft.items?.[0]?.size || "")) || parsePackSize(source);
  const slot = parseSlotWord(String(draft.slot || "")) || parseSlotWord(source);
  const date = parseDateText(String(draft.date || "")) || parseDateText(source);
  const noted = [size, slot ? slotLabel(slot) : null, date ? dateLabel(date) : null].filter(Boolean);
  if (noted.length === 0) return `Which ${noun}?`;
  return `Which ${noun}? ${noted.join(", ")} is already noted.`;
}

function upcomingDateRows(): { id: string; title: string; description?: string }[] {
  const today = istCalendarYmd();
  const rows: { id: string; title: string; description?: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const ymd = istAddCalendarDays(today, i);
    rows.push({ id: `date_${ymd}`, title: dateLabel(ymd) });
  }
  return rows;
}

function itemOptions(items: MenuItem[]): { id: string; title: string }[] {
  return items.map((m) => ({ id: m.id, title: formatFullDishName(m.name) }));
}

function shortRef(orderId: string, orderNumber?: number | null): string {
  return formatOrderRef(orderNumber ?? null, orderId).replace(/^#/, "");
}

/**
 * Returns all plausible storage formats for a WhatsApp phone so a single
 * Supabase `.in()` can match orders regardless of which format the app used.
 * Meta sends `919XXXXXXXXX`; the PWA might have stored `+919XXXXXXXXX` or
 * just the 10-digit number.
 */
function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return [...new Set([digits, `+${digits}`, last10, `91${last10}`, `+91${last10}`])].filter(
    (v) => v.length >= 10,
  );
}

/** Status labels for a specific order lookup. */
const STATUS_DETAIL: Record<string, string> = {
  pending_payment: "waiting for payment — if you've already paid, it'll update in a moment.",
  paid: "received by us and queued for the kitchen.",
  confirmed: "accepted by the kitchen.",
  preparing: "being cooked right now.",
  ready: "packed and ready — we're arranging a driver.",
  out_for_delivery: "picked up and on its way to you.",
  delivered: "delivered. Enjoy!",
  cancelled: "cancelled.",
  rejected: "not accepted by the kitchen (we'll reach out if needed).",
  undelivered: "couldn't be handed over — we'll be in touch.",
};

/** Past the booked window, an open order is no longer a live trip. */
function olderKindForAskedOrder(status: string, slotStartIso: string | null | undefined): OlderOrderKind | null {
  if (!slotWindowEnded(slotStartIso)) return null;
  if (["delivered", "cancelled", "rejected", "undelivered"].includes(status)) return null;
  if (status === "out_for_delivery") return "unfinished_trip";
  if (status === "pending_payment") return "unpaid";
  return "not_sent";
}

/**
 * Look up a specific order by its 5-digit reference number and phone, then
 * reply with its current status and a track link. Called when the message
 * contains "need help with order #XXXXX" or similar.
 */
async function showSpecificOrderStatus(from: string, refNum: string, profileName: string) {
  const num = parseInt(refNum, 10);
  if (!Number.isFinite(num) || num < 1) {
    return await showWelcome(from, profileName);
  }

  const db = createServerSupabase();
  const phones = phoneVariants(from);

  const { data: order } = await db
    .from("orders")
    .select("id, order_number, status, total_amount, delivery_slot, delivery_slot_kind")
    .in("phone_number", phones)
    .eq("order_number", num)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trackBase = `${publicSiteOrigin()}/?track=`;

  if (!order) {
    // Order not found for this phone — fall back to general greeting so the
    // customer can use Track Order for all their orders.
    await sendText(
      from,
      `I couldn't find order #${String(num).padStart(5, "0")} on this number. Use *Track Order* below to see all your active orders, or call us if something's wrong.`,
    );
    const buttons = await homeButtons(from);
    await storeOptions(from, buttons);
    await sendButtons(from, "Here's what I can do for you:", buttons);
    return ack();
  }

  const row = order as {
    id: string;
    order_number?: number | null;
    status: string;
    total_amount?: number | null;
    delivery_slot?: string | null;
    delivery_slot_kind?: string | null;
  };
  const ref = shortRef(row.id, row.order_number);
  const slotLine = formatSlotLineForCustomer(row.delivery_slot, row.delivery_slot_kind);
  const olderKind = olderKindForAskedOrder(row.status, row.delivery_slot);
  if (olderKind) {
    const buttons = olderOrderButtons(olderKind);
    await storeOptions(from, buttons);
    await sendButtons(from, olderOrderAskReply(ref, slotLine, olderKind), buttons);
    return ack();
  }

  const statusPhrase = STATUS_DETAIL[row.status] ?? `status: ${row.status.replace(/_/g, " ")}`;
  const slotSuffix = slotLine ? `\n\nDelivery: ${slotLine}` : "";

  const body = `*Order #${ref}* is ${statusPhrase}${slotSuffix}\n\nTap below to follow it live or share your location with the driver.`;
  await sendCtaUrl(from, body, `${trackBase}${row.id}`, BTN.track);
  return ack();
}

const VK_DRAFT_PREFIX = "__vk_draft__:";
const VK_USUAL_PAY_PREFIX = "__vk_usual_pay__:";

function isHiddenTurn(content: string): boolean {
  return (
    content.startsWith(VK_DRAFT_PREFIX) ||
    content.startsWith(VK_INTERRUPT_PREFIX) ||
    content.startsWith(VK_USUAL_PAY_PREFIX)
  );
}

function readUsualPay(turns: WhatsAppSession["recent_turns"]): UsualPayment | null {
  const raw = [...(turns || [])].reverse().find((t) => t.content.startsWith(VK_USUAL_PAY_PREFIX));
  const value = raw?.content.slice(VK_USUAL_PAY_PREFIX.length);
  return value === "cod" || value === "online" ? value : null;
}

function turnsWithUsualPay(turns: WhatsAppSession["recent_turns"], method: UsualPayment): SessionTurns {
  const kept = (turns || []).filter((t) => !t.content.startsWith(VK_USUAL_PAY_PREFIX));
  return [...kept, { role: "assistant" as const, content: `${VK_USUAL_PAY_PREFIX}${method}` }].slice(-12);
}

type SessionTurns = NonNullable<WhatsAppSession["recent_turns"]>;

function turnsForAgent(turns: WhatsAppSession["recent_turns"]): Message[] {
  return (turns || []).filter((t) => !isHiddenTurn(t.content));
}

function chatTurns(turns: WhatsAppSession["recent_turns"]): SessionTurns {
  return (turns || []).filter((t) => !isHiddenTurn(t.content));
}

function sessionNotes(turns: WhatsAppSession["recent_turns"]): SessionTurns {
  return (turns || []).filter((t) => isHiddenTurn(t.content));
}

function readStoredDraft(turns: WhatsAppSession["recent_turns"]): ProposalDraft | null {
  const raw = (turns || []).find((t) => t.content.startsWith(VK_DRAFT_PREFIX))?.content.slice(VK_DRAFT_PREFIX.length);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProposalDraft;
  } catch {
    return null;
  }
}

function turnsWithDraft(turns: WhatsAppSession["recent_turns"], draft: ProposalDraft): SessionTurns {
  const kept = chatTurns(turns);
  const interrupt = (turns || []).filter((t) => t.content.startsWith(VK_INTERRUPT_PREFIX));
  return [
    ...kept,
    ...interrupt,
    { role: "assistant" as const, content: `${VK_DRAFT_PREFIX}${JSON.stringify(draft)}` },
  ].slice(-10);
}

const BOT_REPLY_ID =
  /^(add_|addmore_|szsec_|sz500_|sz1kg_|var_|book_|cat_|qty_|rm_|uq_|date_|slot_|stale_|order_|lang_|hs_|browse_|view_|track_|help_|quick_|reuse_|change_|new_|clear_|checkout|confirm_|cancel_|pay_|edit_|back_|open_|install_)/;

function isBotReplyId(value: string): boolean {
  return BOT_REPLY_ID.test(value);
}

/** Pull a button or list id out of whatever shape Meta used for the tap. */
function findReplyId(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") return isBotReplyId(value) ? value : null;
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReplyId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  for (const key of ["id", "payload", "button_reply", "list_reply", "button"]) {
    if (key in obj) {
      const found = findReplyId(obj[key], depth + 1);
      if (found) return found;
    }
  }
  for (const nested of Object.values(obj)) {
    const found = findReplyId(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * A card tap that never included a button id. Offer the same dishes as a list,
 * which WhatsApp does deliver back to us.
 */
async function replyUnreadableTap(from: string): Promise<void> {
  const session = await getSession(from);
  const dishes = (session.pending_options || []).filter((option) => option.id.startsWith("add_"));
  if (dishes.length > 0) {
    await sendList(
      from,
      "Oops — that tap stayed on your phone and never reached the kitchen. Pick the dish here, and I'll ask 500gm or 1kg.",
      "Pick a dish",
      [
        {
          title: "On the cards",
          rows: dishes.slice(0, 10).map((option) => {
            const pricing = dishPricingForRetailerId(option.id.slice(4));
            const name = pricing ? formatFullDishName(pricing.name) : option.title;
            return {
              id: option.id,
              title: name.slice(0, 24),
              description: pricing
                ? `500gm ${formatInr(pricing.prices["500gm"])} · 1kg ${formatInr(pricing.prices["1kg"])}`.slice(0, 72)
                : undefined,
            };
          }),
        },
      ],
    );
    return;
  }
  await sendText(
    from,
    "Oops — that didn't come through as text. Type the dish name, or send hi and I'll start again.",
  );
}

/** Meta signs the raw body with the app secret. A missing secret leaves the check off so the bot keeps working until WHATSAPP_APP_SECRET is set. */
function whatsAppSignatureOk(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const given = header.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(given, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.text();
    let from = "";
    let body = "";
    let profileName = "";
    let messageId = "";

    let interactiveReplyId: string | null = null;
    let catalogProductItems: CatalogOrderItem[] | null = null;
    let inboundKind: WaMessageKind = "text";
    /** Set when the customer sends a WhatsApp location pin. */
    let sharedPin: { lat: number; lng: number; label: string } | null = null;

    if (contentType.includes("application/json")) {
      const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
      if (appSecret && !whatsAppSignatureOk(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
        console.error("[WA] Rejected a webhook post with a bad signature");
        return new Response("Invalid signature", { status: 401 });
      }
      let json: any = {};
      try {
        json = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }

      if (json.object === "whatsapp_business_account") {
        const { primeFestivalQuote } = await import("@/lib/menu/festival-dishes");
        await primeFestivalQuote(supabase);
      }

      if (json.object === "whatsapp_business_account" && json.entry) {
        const entry = json.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];
        const contact = value?.contacts?.[0];

        if (message && message.type === "text") {
          from = fromMetaWebhook(message.from);
          body = message.text?.body || "";
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA] From=${from} Body="${body}" Name=${profileName} MsgId=${messageId}`);
        } else if (message && message.type === "interactive") {
          from = fromMetaWebhook(message.from);
          const interactive = message.interactive;
          if (interactive?.type === "button_reply") {
            interactiveReplyId = interactive.button_reply?.id || null;
            body = interactive.button_reply?.title || interactiveReplyId || "";
            inboundKind = "button";
          } else if (interactive?.type === "list_reply") {
            interactiveReplyId = interactive.list_reply?.id || null;
            body = interactive.list_reply?.title || interactiveReplyId || "";
            inboundKind = "list";
          } else if (interactive?.type === "nfm_reply") {
            interactiveReplyId = null;
            body = interactive.nfm_reply?.body || "";
          } else {
            const replyId = findReplyId(message);
            console.error(
              `[WA] unrecognised interactive type "${interactive?.type}": ${JSON.stringify(interactive)}`,
            );
            if (replyId) {
              interactiveReplyId = replyId;
              body = replyId;
              inboundKind = "button";
            } else {
              await logWhatsAppMessage({
                phone: from,
                direction: "in",
                kind: "button",
                body: `[interactive:${interactive?.type || "unknown"}]`,
                payload: { type: message.type, interactiveType: interactive?.type || null },
                provider: "meta",
                waMessageId: message.id || null,
              });
              await replyUnreadableTap(from);
              return ack();
            }
          }
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Interactive] From=${from} Id=${interactiveReplyId} Body="${body}"`);
        } else if (message && message.type === "button") {
          // Template and some carousel quick replies arrive here, not as
          // interactive.button_reply. The id is button.payload.
          from = fromMetaWebhook(message.from);
          const button = message.button as { payload?: string; text?: string } | undefined;
          const payload = button?.payload || "";
          interactiveReplyId = isBotReplyId(payload) ? payload : findReplyId(message);
          body = button?.text || interactiveReplyId || "";
          inboundKind = "button";
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Button] From=${from} Id=${interactiveReplyId} Body="${body}"`);
          if (!interactiveReplyId) {
            await replyUnreadableTap(from);
            return ack();
          }
        } else if (message && message.type === "order") {
          from = fromMetaWebhook(message.from);
          const products = (message.order?.product_items || []) as CatalogOrderItem[];
          catalogProductItems = products;
          body = products[0]?.product_retailer_id || "catalog_order";
          inboundKind = "catalog";
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Catalog] From=${from} items=${products.length}`);
        } else if (message && message.type === "location") {
          from = fromMetaWebhook(message.from);
          const loc = message.location as
            | { latitude?: number; longitude?: number; name?: string; address?: string }
            | undefined;
          const lat = Number(loc?.latitude);
          const lng = Number(loc?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            sharedPin = {
              lat,
              lng,
              label: [loc?.name, loc?.address].filter(Boolean).join(", "),
            };
          }
          inboundKind = "location";
          body = sharedPin?.label || "[location]";
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Location] From=${from} lat=${lat} lng=${lng}`);
        } else if (message) {
          from = fromMetaWebhook(message.from);
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          const replyId = findReplyId(message);
          if (replyId) {
            interactiveReplyId = replyId;
            body = replyId;
            inboundKind = "button";
            console.log(`[WA] salvaged reply ${replyId} from type "${message.type}"`);
          } else {
            inboundKind = message.type === "image" ? "image" : "media";
            body = `[${message.type}]`;
            console.error(
              `[WA] unreadable inbound type "${message.type}" keys=${Object.keys(message).join(",")}`,
            );
            await logWhatsAppMessage({
              phone: from,
              direction: "in",
              kind: inboundKind,
              body,
              payload: { type: message.type, profileName: profileName || undefined },
              provider: "meta",
              waMessageId: messageId || null,
            });
            await replyUnreadableTap(from);
            return ack();
          }
        } else {
          return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        }
      }
    }

    if (!from || (!body && !catalogProductItems?.length)) {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    await logWhatsAppMessage({
      phone: from,
      direction: "in",
      kind: inboundKind,
      body: body.trim() || null,
      payload: {
        profileName: profileName || undefined,
        replyId: interactiveReplyId || undefined,
        catalogItems: catalogProductItems || undefined,
      },
      provider: "meta",
      waMessageId: messageId || null,
    });

    const text = body.trim();
    const lower = text.toLowerCase();

    const session = await getSession(from);

    // A dropped pin is the only address we can actually verify on WhatsApp,
    // so it takes priority over whatever state the chat was in.
    if (sharedPin) {
      return await handleSharedLocation(from, session, sharedPin);
    }

    // Old chats may still have the language picker buttons.
    if (interactiveReplyId === "lang_en" || interactiveReplyId === "lang_tanglish") {
      return await applyLanguageChoice(from, "en", profileName);
    }

    /**
     * A greeting only counts when greeting is *all* they said. "Hey, is my
     * order late?" is a real question and deserves a real answer — routing it
     * to the welcome card is what made the bot feel like a phone menu.
     */
    const trimmedText = text.trim();
    const isGreeting =
      /^(hi+|hello+|hey+|yo|namaste|vanakkam|start|restart|good\s+(morning|afternoon|evening))\b/i.test(
        trimmedText,
      ) &&
      !trimmedText.includes("?") &&
      trimmedText.split(/\s+/).length <= 3 &&
      !asksAboutExistingOrder(trimmedText);
    const isMenuCmd =
      /^(menu|browse|show menu|full menu|browse_menu|view_menu)\b/i.test(lower) || /^order$/i.test(lower);
    const isCartCmd = /^(cart|my cart|view cart)\b/i.test(lower);
    const isHelpCmd = /^(help|support|help & support|help_support)\b/i.test(lower);
    const isTrackCmd =
      /^(track|order status|where is my order|my orders?)\b/i.test(lower) ||
      asksAboutExistingOrder(text);
    const isCallCmd = /^(call|call us|phone)\b/i.test(lower);
    const isAppCmd = /^(app|open app|pwa|install|install app|install_app)\b/i.test(lower);
    const isLangCmd = /^(language|lang|bhasha|mozhi)\b/i.test(lower);
    const isStopCmd = /^(stop|unsubscribe|opt out|no ads|stop marketing)\b/i.test(lower);

    // Meta requires opt-out to actually work, so it is handled before anything
    // else can change the subject. Order updates keep coming — those are not
    // marketing.
    if (isStopCmd) {
      return await applyMarketingOptOut(from);
    }

    // "Hi — I need help with order #00010." or "need help with order 10"
    // The PWA sends a pre-filled message like this when the customer taps the
    // Help button on a specific order. Extract the 4–6 digit reference and
    // look it up directly instead of showing the generic welcome screen.
    const orderRefInMsg = text.match(/#(\d{4,6})\b|order\s*#?(\d{4,6})\b/i);
    if (orderRefInMsg && (isGreeting || isHelpCmd || isTrackCmd || session.state === "idle")) {
      const refNum = orderRefInMsg[1] ?? orderRefInMsg[2];
      if (refNum) return await showSpecificOrderStatus(from, refNum, profileName);
    }

    if (isGreeting) {
      return await showWelcome(from, profileName);
    }

    after(() => {
      void trackWhatsAppUser(from, profileName?.trim() || "WhatsApp User");
    });

    // Ratings arrive as a button tap or as "1".."5" against the stored options.
    const ratingId = interactiveReplyId || (await resolveNumbered(from, text));
    if (ratingId) {
      const dec = decodeOrderRatingButtonId(ratingId);
      if (dec) return await applyRating(from, dec.orderId, dec.stars);
    }

    if (session.state === "rating_comment") {
      return await handleRatingComment(from, text, session, interactiveReplyId);
    }

    if (catalogProductItems?.length) {
      return await handleCatalogOrder(from, catalogProductItems);
    }

    const resolvedId = await resolveNumbered(from, text);

    if (interactiveReplyId) {
      const handled = await handleResolvedId(from, interactiveReplyId, session, profileName);
      if (handled) return handled;
    }

    if (resolvedId) {
      const handled = await handleResolvedId(from, resolvedId, session, profileName);
      if (handled) return handled;
    }

    if (isPendingState(session.state) && !interactiveReplyId && !resolvedId) {
      const diverted = await handleInterrupt(from, text, session, profileName);
      if (diverted) return diverted;
    }

    if (isMenuCmd) {
      await updateSession(from, { state: "browsing_category", proposal: null });
      return await showFullMenu(from);
    }
    if (isCartCmd) {
      return await showCart(from, session.cart);
    }
    if (isLangCmd) {
      return await showWelcome(from, profileName);
    }
    if (isHelpCmd) {
      return await showHelpSupport(from);
    }
    if (isTrackCmd) {
      return await showTrackOrder(from);
    }
    if (isCallCmd) {
      await sendText(from, callUsDialReply(langOf(from)));
      return ack();
    }
    if (isAppCmd) {
      return await showInstallApp(from, profileName);
    }

    switch (session.state) {
      case "idle":
        return await handleIdle(from, text, session, profileName);

      case "browsing_category":
        return await handleBrowsingCategory(from, text, profileName);

      case "picking_item":
        return await handlePickingItem(from, text, profileName);

      case "picking_variant":
        return await handlePickingVariant(from, text, session);

      case "picking_qty":
        return await handlePickingQty(from, text, session);

      case "cart_review":
        return await handleCartReview(from, text, session, profileName);

      case "confirming_last":
        return await handleConfirmingLast(from, text, session);

      case "confirming_proposal":
        return await handleConfirmingProposal(from, text, session, profileName);

      case "picking_date":
        return await handlePickingDate(from, text, session);

      case "picking_slot":
        return await handlePickingSlot(from, text, session);

      case "picking_address":
        return await handlePickingAddress(from, text, session);

      case "picking_pay_method":
        return await handlePickingPayMethod(from, text, session);

      case "awaiting_payment":
        return await handleAwaitingPayment(from, text, session);

      case "ai_chat":
        return await handleAiChat(from, text, profileName);

      default:
        return await handleIdle(from, text, session, profileName);
    }
  } catch (error) {
    console.error("[WA] Error:", (error as Error).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ─── Language ──────────────────────────────────────────────────────────────

async function applyLanguageChoice(from: string, lang: WaLang, profileName: string) {
  await saveWaLang(from, "en");
  await sendText(from, languageSetReply(lang));
  return await showWelcome(from, profileName);
}

async function applyMarketingOptOut(from: string) {
  const lang = langOf(from);
  try {
    const { error } = await createServerSupabase()
      .from("users")
      .upsert({ phone_number: from, marketing_opt_out: true }, { onConflict: "phone_number" });
    if (error) throw error;
  } catch (e) {
    console.error("[WA] marketing opt-out failed:", e);
  }

  await sendText(from, marketingOptOutReply(lang));
  return ack();
}

// ─── State Handlers ────────────────────────────────────────────────────────

async function handleResolvedId(
  from: string,
  id: string,
  session: WhatsAppSession,
  profileName: string,
): Promise<Response | null> {
  if (id.startsWith("date_")) {
    return await applyDeliveryDate(from, id.replace(/^date_/, ""));
  }
  const booked = id.match(/^book_(\d{4}-\d{2}-\d{2})_(breakfast|lunch|dinner)$/);
  if (booked) {
    return await applyBookedSlot(from, booked[1], booked[2] as DeliverySlotKind);
  }
  if (id === "add_more") return await showAddMoreChoice(from);
  if (id === "addmore_menu") return await showSizedMenu(from);
  const sizedSection = id.match(/^szsec_(chicken|mutton|egg)_(500gm|1kg)$/);
  if (sizedSection) return await showSizedSectionItems(from, sizedSection[1], sizedSection[2] as PackSize);
  const sizedDish = id.match(/^sz(500|1kg)_(.+)$/);
  if (sizedDish) {
    return await addDishAtSize(from, sizedDish[2], sizedDish[1] === "1kg" ? "1kg" : "500gm");
  }
  if (id.startsWith("add_")) {
    return await addDishByRetailer(from, id.slice(4));
  }
  if (id.startsWith("qty_")) {
    const qty = parseInt(id.slice(4), 10);
    if (qty >= 1 && qty <= 10) return await addSelectedItemToCart(from, session, qty);
  }
  const cartLine = parseCartLineId(id);
  if (cartLine?.kind === "rm") return await removeMatchedLine(from, cartLine.menuId, cartLine.variant);
  if (cartLine?.kind === "uq" && cartLine.qty) {
    return await updateMatchedLine(from, cartLine.menuId, cartLine.variant, cartLine.qty);
  }
  if (id.startsWith("order_")) {
    return await handleMarketingOrderTap(from, id.slice("order_".length));
  }

  const usualPick = id.match(/^buyusual_(\d+)$/);
  if (usualPick) return await startUsualDish(from, Number(usualPick[1]));
  const savedAddress = id.match(/^addr_(\d+)$/);
  if (savedAddress) return await useSavedAddress(from, Number(savedAddress[1]));

  switch (id) {
    case "lang_en":
      return await applyLanguageChoice(from, "en", profileName);
    case "lang_tanglish":
      return await applyLanguageChoice(from, "tanglish", profileName);
    case "hs_language":
      return await showWelcome(from, profileName);
    case "browse_menu":
    case "view_menu":
      return await showFullMenu(from);
    case "browse_categories":
      return await showCategoryBrowser(from);
    case "track_order":
    case "welcome_track":
    case "hs_track":
      return await showTrackOrder(from);
    case "open_app":
    case "view_app":
    case "install_app":
      return await showInstallApp(from, profileName);
    case "help_support":
      return await showHelpSupport(from);
    case "quick_reorder":
      return await showQuickReorder(from);
    case "buy_usual":
      return await showUsualList(from);
    case "cat_chicken":
      return await showCategoryItems(from, "chicken");
    case "cat_mutton":
      return await showCategoryItems(from, "mutton");
    case "cat_egg":
      return await showCategoryItems(from, "egg");
    case "var_500gm":
      return await applyVariant(from, "500gm");
    case "var_1kg":
      return await applyVariant(from, "1kg");
    case "slot_breakfast":
      return await applySlot(from, session, "breakfast");
    case "slot_lunch":
      return await applySlot(from, session, "lunch");
    case "slot_dinner":
      return await applySlot(from, session, "dinner");
    case "checkout":
      if (session.cart.length === 0) {
        await sendText(from, buildCartMessage([], langOf(from)));
        return ack();
      }
      return await afterCartReady(from, session);
    case "add_more":
      return await showAddMoreChoice(from);
    case "clear_cart":
      await dropCartDraft(from, session, []);
      await sendText(from, buildCartMessage([], langOf(from)));
      return ack();
    case "reuse_last":
      return await applyLastAddressAndSlot(from, session);
    case "change_slot_addr":
      return await showDatePicker(from);
    case "reuse_address":
      return await finishAddress(from, session, session.delivery_address || (await fetchLastAddressAndSlot(from)).address || "");
    case "new_address":
      return await askForAddress(from);
    case "addr_map":
      return await askForMapPin(from);
    case "confirm_proposal":
      return await confirmProposal(from, session);
    case "cancel_proposal":
      await updateSession(from, { proposal: null, state: "idle" });
      return await showFullMenu(from);
    case "confirm_order":
    case "pay_online":
      return await processConfirmOrder(from, session, "online");
    case "pay_cod":
      return await handlePayCodTap(from, session);
    case "edit_order":
      return await showCart(from, session.cart);
    case "usual_change":
      return await showUsualChange(from);
    case "usual_dish":
      return await showUsualList(from);
    case "usual_qty":
      return await showCart(from, session.cart);
    case "usual_time":
      return await showDatePicker(from);
    case "usual_addr":
      return await askForAddress(from);
    case "usual_back":
      return await resumeUsualPayment(from);
    case "back_home":
      await resetSession(from);
      return await showWelcome(from, profileName);
    case "hs_call":
      await sendText(from, callUsDialReply(langOf(from)));
      return ack();
    case "hs_complaint":
      await updateSession(from, { state: "ai_chat" });
      try {
        await createServerSupabase()
          .from("users")
          .upsert(
            { phone_number: from, whatsapp_pending_action: "complaint" },
            { onConflict: "phone_number" },
          );
      } catch (e) {
        console.error("[WA] complaint pending_action failed:", e);
      }
      await sendText(from, complaintPrompt(langOf(from)));
      return ack();
    case "hs_your_orders":
      return await showOrderHistory(from);
    case "hs_payments":
      return await showPaymentsSummary(from);
    case "stale_issue":
    case "stale_missing":
      await updateSession(from, { state: "ai_chat" });
      await sendText(from, complaintPrompt(langOf(from)));
      return ack();
    case "stale_latest":
      return await showTrackOrder(from);
    case "stale_again":
      return await showQuickReorder(from);
    case "stale_arrived":
      await sendText(from, olderOrderArrivedReply());
      return ack();
    case "stale_call":
      await sendText(from, callUsDialReply(langOf(from)));
      return ack();
    case "rating_skip":
      await updateSession(from, { state: "idle", rating_order_id: null });
      await sendText(from, ratingThanksReply(langOf(from)));
      return ack();
    default: {
      const menu = await getMenu();
      const item = menu.find((m) => m.id === id);
      if (item) {
        return await showVariantPicker(from, item);
      }
      return null;
    }
  }
}

async function handleIdle(from: string, text: string, session: { cart: CartItem[] }, profileName: string) {
  const menu = await getMenu();
  const matched = findItemByName(menu, text);

  if (matched && !looksLikeCompoundOrder(text)) {
    return await showVariantPicker(from, matched);
  }

  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

function categoryChoice(text: string): "chicken" | "mutton" | "egg" | null {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);
  if (num === 1 || lower === "chicken") return "chicken";
  if (num === 2 || lower === "mutton") return "mutton";
  if (num === 3 || lower === "egg") return "egg";
  return null;
}

async function handleBrowsingCategory(from: string, text: string, profileName: string) {
  const cat = categoryChoice(text);
  if (cat) return await showCategoryItems(from, cat);
  return await handleIdle(from, text, { cart: [] }, profileName);
}

/** A category order already named the size. Don't ask for 500gm again. */
async function continuePickedDish(from: string, session: WhatsAppSession, item: MenuItem) {
  const draft = readStoredDraft(session.recent_turns);
  const size = parsePackSize(String(draft?.items?.[0]?.size || ""));
  if (size && draft) {
    await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
    return await applyVariant(from, size);
  }
  return await showVariantPicker(from, item);
}

async function handlePickingItem(from: string, text: string, profileName: string) {
  const num = parseInt(text, 10);
  const menu = await getMenu();

  const resolved = await resolveNumbered(from, text);
  const sess = await getSession(from);
  const itemId = resolved || (num > 0 && sess.pending_options ? sess.pending_options[num - 1]?.id : null);

  if (itemId) {
    const item = menu.find((m) => m.id === itemId);
    if (item) return await continuePickedDish(from, sess, item);
  }

  const matched = findItemByName(menu, text);
  if (matched) return await continuePickedDish(from, sess, matched);

  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function handlePickingVariant(from: string, text: string, session: WhatsAppSession) {
  const packs = parsePackQuantities(text);
  if (packs.length > 0 && session.selected_item_id) {
    return await setPackLines(from, session, session.selected_item_id, packs);
  }

  const lower = text.toLowerCase().trim();
  const bare = /^\d{1,2}$/.test(lower);
  const num = bare ? parseInt(lower, 10) : NaN;

  let variant: PackSize | null = null;
  if ((bare && num === 1) || (!bare && /500/i.test(lower)) || lower === "var_500gm") variant = "500gm";
  else if ((bare && num === 2) || /1\s*kg/i.test(lower) || lower === "var_1kg") variant = "1kg";

  const resolvedVar = await resolveNumbered(from, text);
  if (resolvedVar === "var_500gm") variant = "500gm";
  if (resolvedVar === "var_1kg") variant = "1kg";

  if (!variant) {
    await sendText(from, buildProposalAskMessage("size", langOf(from)));
    return ack();
  }

  return await applyVariant(from, variant);
}

async function handlePickingQty(from: string, text: string, session: WhatsAppSession) {
  const fromButton = text.trim().match(/^qty_(\d+)$/);
  const packs = fromButton ? [] : parsePackQuantities(text);
  if (packs.length > 0 && session.selected_item_id) {
    return await setPackLines(from, session, session.selected_item_id, packs);
  }

  const qty = fromButton ? parseInt(fromButton[1], 10) : parseSpokenQuantity(text);
  if (qty == null || qty < 1 || qty > 10) {
    await sendText(from, buildQtyMessage(session.selected_variant || "500gm", langOf(from)));
    return ack();
  }
  return await addSelectedItemToCart(from, session, qty);
}

type CartLineTarget = { kind: "rm" | "uq"; qty: number | null; menuId: string; variant: string };

function parseCartLineId(id: string): CartLineTarget | null {
  const removed = id.match(/^rm_(.+)_(500gm|1kg)$/);
  if (removed) return { kind: "rm", qty: null, menuId: removed[1], variant: removed[2] };
  const updated = id.match(/^uq_(\d+)_(.+)_(500gm|1kg)$/);
  if (updated) {
    return { kind: "uq", qty: parseInt(updated[1], 10), menuId: updated[2], variant: updated[3] };
  }
  return null;
}

/** Drop a stored proposal draft so it cannot be shown as the cart. */
async function dropCartDraft(from: string, session: WhatsAppSession, cart: CartItem[]) {
  await updateSession(from, {
    cart,
    proposal: null,
    state: cart.length > 0 ? "cart_review" : "idle",
    recent_turns: [...chatTurns(session.recent_turns).slice(-8), ...sessionNotes(session.recent_turns)],
    selected_item_id: null,
    selected_variant: null,
    pending_options: null,
  });
}

async function removeMatchedLine(from: string, menuItemId: string, variant: string) {
  const session = await getSession(from);
  const hit = session.cart.find((line) => line.menu_item_id === menuItemId && line.variant === variant);
  if (!hit) {
    await sendText(from, buildNotInCartMessage());
    return await showCart(from, session.cart);
  }
  const next = removeLines(session.cart, [hit]);
  await dropCartDraft(from, session, next);
  await sendText(from, buildLineRemovedMessage(hit.name, hit.variant));
  if (next.length === 0) {
    await updateSession(from, { recent_turns: withInterrupt(session.recent_turns, session.state, 0) });
    await sendText(from, buildCartMessage([], langOf(from)));
    return ack();
  }
  return await showCart(from, next);
}

async function updateMatchedLine(from: string, menuItemId: string, variant: string, qty: number) {
  const session = await getSession(from);
  const hit = session.cart.find((line) => line.menu_item_id === menuItemId && line.variant === variant);
  if (!hit || qty < 1 || qty > 10) {
    await sendText(from, buildNotInCartMessage());
    return await showCart(from, session.cart);
  }
  const next = setLineQty(session.cart, hit, qty);
  await dropCartDraft(from, session, next);
  await sendText(from, buildLineUpdatedMessage(hit.name, hit.variant, qty));
  return await showCart(from, next);
}

async function askWhichLine(from: string, hits: CartItem[], kind: "remove" | "update", qty?: number) {
  const bases = hits.map((hit) => cartLineButtonTitle(hit.name));
  const duplicated = bases.some((title, index) => bases.indexOf(title) !== index);
  const buttons = hits.slice(0, 3).map((hit) => {
    const base = cartLineButtonTitle(hit.name);
    const title = duplicated ? `${base.replace(/ gravy$/i, "")} ${hit.variant}`.slice(0, 20) : base;
    return {
      id: kind === "remove" ? `rm_${hit.menu_item_id}_${hit.variant}` : `uq_${qty}_${hit.menu_item_id}_${hit.variant}`,
      title,
    };
  });
  await updateSession(from, { state: "cart_review" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildWhichCartLineMessage(), buttons);
  return ack();
}

/**
 * A cart edit names an action. The session cart is what changes, and the
 * summary sent afterwards is read back from that cart.
 */
async function applySpokenCartEdit(
  from: string,
  text: string,
  session: WhatsAppSession,
): Promise<Response | null> {
  if (session.cart.length === 0) return null;

  const pending = (session.pending_options || [])
    .map((option) => parseCartLineId(option.id))
    .filter((row): row is CartLineTarget => row != null);
  if (pending.length > 0 && !looksLikeCartEdit(text)) {
    const lines = session.cart.filter((line) =>
      pending.some((row) => row.menuId === line.menu_item_id && row.variant === line.variant),
    );
    const named = matchCartLines(lines, text);
    if (!named.ambiguous && named.hits.length === 1) {
      const hit = named.hits[0];
      const target = pending.find((row) => row.menuId === hit.menu_item_id && row.variant === hit.variant);
      if (target?.kind === "rm") return await removeMatchedLine(from, target.menuId, target.variant);
      if (target?.kind === "uq" && target.qty) {
        return await updateMatchedLine(from, target.menuId, target.variant, target.qty);
      }
    }
  }

  const scoped = planScopedCartEdit(text);
  if (scoped) return await applyScopedCartEdit(from, session, scoped);

  const intent = await resolveCartIntent(text, session.cart);
  if (intent.action === "checkout") return await afterCartReady(from, session);
  if (intent.action === "clear_cart") {
    await dropCartDraft(from, session, []);
    await updateSession(from, { recent_turns: withInterrupt(session.recent_turns, session.state, 0) });
    await sendText(from, buildCartMessage([], langOf(from)));
    return ack();
  }
  if (intent.action === "remove_item") {
    const match = matchCartLines(session.cart, intent.item_reference);
    if (match.hits.length === 0) {
      await sendText(from, buildNotInCartMessage());
      return await showCart(from, session.cart);
    }
    if (match.ambiguous) return await askWhichLine(from, match.hits, "remove");
    return await removeMatchedLine(from, match.hits[0].menu_item_id, match.hits[0].variant);
  }
  if (intent.action === "update_qty") {
    const qty = intent.quantity ?? parseSpokenQuantity(text);
    if (qty == null || qty < 1 || qty > 10) {
      await sendText(from, buildWhichCartLineMessage());
      return await showCart(from, session.cart);
    }
    const match = matchCartLines(session.cart, intent.item_reference);
    if (match.hits.length === 0) {
      await sendText(from, buildNotInCartMessage());
      return await showCart(from, session.cart);
    }
    if (match.ambiguous) return await askWhichLine(from, match.hits, "update", qty);
    return await updateMatchedLine(from, match.hits[0].menu_item_id, match.hits[0].variant, qty);
  }
  if (intent.action === "unclear" && looksLikeCartEdit(text)) {
    await sendText(from, buildWhichCartLineMessage());
    return await showCart(from, session.cart);
  }
  return null;
}

async function applyScopedCartEdit(
  from: string,
  session: WhatsAppSession,
  plan: ScopedCartEdit,
): Promise<Response> {
  const pool = plan.removeSize
    ? session.cart.filter((line) => parsePackSize(line.variant) === plan.removeSize)
    : session.cart;
  const match = matchCartLines(pool, plan.itemReference || "");
  if (match.hits.length === 0) {
    await sendText(from, buildNotInCartMessage());
    return await showCart(from, session.cart);
  }
  if (match.ambiguous) return await askWhichLine(from, match.hits, "remove");

  const hit = match.hits[0];
  let next = removeLines(session.cart, [hit]);
  const notes = [buildLineRemovedMessage(hit.name, hit.variant)];
  if (plan.keep) {
    const keepLine = next.find(
      (line) => line.menu_item_id === hit.menu_item_id && parsePackSize(line.variant) === plan.keep?.size,
    );
    if (keepLine) {
      next = setLineQty(next, keepLine, plan.keep.quantity);
      notes.push(buildLineUpdatedMessage(keepLine.name, keepLine.variant, plan.keep.quantity));
    }
  }

  await dropCartDraft(from, session, next);
  for (const note of notes) await sendText(from, note);
  if (next.length === 0) {
    await updateSession(from, { recent_turns: withInterrupt(session.recent_turns, session.state, 0) });
    await sendText(from, buildCartMessage([], langOf(from)));
    return ack();
  }
  return await showCart(from, next);
}

function pendingQuestion(state: SessionState): string {
  switch (state) {
    case "picking_date":
      return "When would you like it?";
    case "picking_slot":
      return "Breakfast, lunch, or dinner?";
    case "picking_address":
      return "What's the delivery address?";
    case "picking_pay_method":
      return "Pay online or cash?";
    case "awaiting_payment":
      return "The payment link is still open.";
    case "confirming_last":
      return "Same as last time?";
    case "confirming_proposal":
      return "Confirm this order?";
    case "picking_variant":
      return "500gm or 1kg?";
    case "picking_qty":
      return "How many?";
    default:
      return "";
  }
}

async function rememberInterrupt(from: string, session: WhatsAppSession, count: number) {
  await updateSession(from, {
    recent_turns: withInterrupt(session.recent_turns, session.state, count),
  });
}

/**
 * Classify first. A day answer falls through to the state handler. A cart
 * edit, a menu question, or anything else is handled, then the pending
 * question is asked again. The third interruption on the same question
 * stops the loop and hands the chat to a person.
 */
async function handleInterrupt(
  from: string,
  text: string,
  session: WhatsAppSession,
  _profileName: string,
): Promise<Response | null> {
  if (!isPendingState(session.state)) return null;

  let classification: TurnClassification = classifyTurn(text, session.state);
  if (classification.intent === "unclear" && text.trim().split(/\s+/).length >= 3) {
    const modeled = await classifyTurnWithModel({
      text,
      state: session.state,
      pendingQuestion: pendingQuestion(session.state),
      cart: session.cart,
    });
    if (modeled && modeled.intent !== "unclear") classification = modeled;
  }

  const decision = routeTurn(session.state, classification, readInterrupt(session.recent_turns, session.state));

  if (decision.action === "accept_answer") {
    await rememberInterrupt(from, session, 0);
    if (session.state === "picking_date") {
      const date = parseDateInput(text) || parseDateText(classification.extracted_value || "");
      if (date && !parseDateInput(text)) return await applyDeliveryDate(from, date);
    }
    return null;
  }

  if (decision.action === "escalate") {
    try {
      await createServerSupabase().from("customer_complaints").insert({
        phone_number: from,
        body: `Stuck during ${session.state} after repeated side messages. Last: ${text.slice(0, 500)}`,
      });
    } catch (err) {
      console.error("[WA] interrupt escalate", err);
    }
    await updateSession(from, {
      state: "idle",
      pending_options: null,
      recent_turns: withInterrupt(session.recent_turns, session.state, 0),
    });
    await sendText(from, escalateHumanReply(langOf(from)));
    return ack();
  }

  if (decision.action === "cancel") {
    await updateSession(from, {
      state: "idle",
      cart: [],
      proposal: null,
      pending_options: null,
      delivery_date: null,
      delivery_slot_kind: null,
      selected_item_id: null,
      selected_variant: null,
      recent_turns: withInterrupt(session.recent_turns, session.state, 0),
    });
    await sendText(from, interruptCancelledMessage());
    return ack();
  }

  if (decision.action === "complaint") {
    await updateSession(from, {
      state: "ai_chat",
      pending_options: null,
      recent_turns: withInterrupt(session.recent_turns, session.state, 0),
    });
    try {
      await createServerSupabase()
        .from("users")
        .upsert({ phone_number: from, whatsapp_pending_action: "complaint" }, { onConflict: "phone_number" });
    } catch (err) {
      console.error("[WA] interrupt complaint", err);
    }
    await sendText(from, complaintPrompt(langOf(from)));
    return ack();
  }

  await rememberInterrupt(from, session, decision.nextInterruptCount);

    if (decision.action === "mutate_cart_then_reask") {
    const fresh = await getSession(from);
    const edited = await applySpokenCartEdit(from, text, fresh);
    if (edited) return edited;
    if (classification.intent === "add_item") {
      const menu = await getMenu();
      const matched = findItemByName(menu, text);
      if (matched && !looksLikeCompoundOrder(text)) return await showVariantPicker(from, matched);
    }
    const aside = await answerWithVidya(from, text, _profileName);
    if (aside.kind === "done") return aside.response;
    if (aside.kind === "skip") await sendText(from, interruptClarifyMessage(text));
    return reaskPending(from, session.state);
  }

  if (decision.action === "answer_menu_then_reask") {
    const aside = await answerWithVidya(from, text, _profileName);
    if (aside.kind === "done") return aside.response;
    if (aside.kind === "skip") await sendText(from, interruptMenuAside());
    return reaskPending(from, session.state);
  }

  if (decision.action === "answer_status_then_reask") {
    const { data: orders } = await createServerSupabase()
      .from("orders")
      .select("id, order_number, status")
      .in("phone_number", phoneVariants(from))
      .order("created_at", { ascending: false })
      .limit(3);
    const lines = ((orders || []) as { id: string; order_number?: number | null; status?: string }[])
      .filter((row) => row.status && !["delivered", "cancelled", "rejected"].includes(row.status))
      .map((row) => `${formatOrderRef(row.order_number, row.id)} · ${(row.status || "").replace(/_/g, " ")}`);
    await sendText(from, interruptStatusMessage(lines));
    return reaskPending(from, session.state);
  }

  if (decision.action === "clarify" || (decision.action === "reask" && classification.intent !== "small_talk")) {
    const aside = await answerWithVidya(from, text, _profileName);
    if (aside.kind === "done") return aside.response;
    if (aside.kind === "skip") {
      await sendText(
        from,
        decision.action === "clarify" ? interruptClarifyMessage(text) : interruptStillOpenMessage(),
      );
    }
  }
  return reaskPending(from, session.state);
}

/**
 * A side question gets a real answer from Vidya, using this chat and the live
 * menu. A draft order is handed to the normal confirmation card. Otherwise the
 * caller asks the pending step again.
 */
async function answerWithVidya(
  from: string,
  text: string,
  profileName: string,
): Promise<{ kind: "skip" } | { kind: "said" } | { kind: "done"; response: Response }> {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const asking = text.includes("?") || words.length >= 2;
  if (!asking) return { kind: "skip" };

  const session = await getSession(from);
  const agent = new VidyaAgent();
  const result = await agent.processMessage(text, turnsForAgent(session.recent_turns), from, profileName);
  const turns: SessionTurns = [
    ...chatTurns(session.recent_turns),
    { role: "user", content: text },
    ...(result.reply ? [{ role: "assistant" as const, content: result.reply }] : []),
    ...sessionNotes(session.recent_turns),
  ].slice(-16);

  if (result.proposalDraft && session.cart.length === 0) {
    await updateSession(from, { recent_turns: turnsWithDraft(turns, result.proposalDraft) });
    return { kind: "done", response: await presentProposal(from, result.proposalDraft, text) };
  }

  if (!result.reply) return { kind: "skip" };
  await updateSession(from, { recent_turns: turns });
  await sendText(from, result.reply);
  return { kind: "said" };
}

async function reaskPending(from: string, state: SessionState): Promise<Response> {
  const session = await getSession(from);
  if (state === "picking_date") return await showDatePicker(from);
  if (state === "picking_slot") {
    if (!session.delivery_date) return await showDatePicker(from);
    const buttons = [
      { id: "slot_breakfast", title: BTN.breakfast },
      { id: "slot_lunch", title: BTN.lunch },
      { id: "slot_dinner", title: BTN.dinner },
    ];
    await updateSession(from, { state: "picking_slot" });
    await storeOptions(from, buttons);
    await sendButtons(from, buildSlotPickerMessage(dateLabel(session.delivery_date), langOf(from)), buttons);
    return ack();
  }
  if (state === "picking_address") return await askForAddress(from);
  if (state === "picking_pay_method") return await offerPayOrConfirm(from, session);
  if (state === "awaiting_payment") {
    await updateSession(from, { state: "awaiting_payment" });
    await sendText(from, "The payment link is still open. Say pay when it's done, or tell me what to change.");
    return ack();
  }
  if (state === "confirming_last") return await afterCartReady(from, session);
  if (state === "confirming_proposal") {
    await updateSession(from, { state: "confirming_proposal" });
    await sendText(from, "Tap Confirm when the order looks right.");
    return ack();
  }
  if (state === "picking_qty") {
    await updateSession(from, { state: "picking_qty" });
    await sendText(from, buildQtyMessage(session.selected_variant || "500gm", langOf(from)));
    return ack();
  }
  if (state === "picking_variant" && session.selected_item_id) {
    const menu = await getMenu();
    const item = menu.find((row) => row.id === session.selected_item_id);
    if (item) return await showVariantPicker(from, item);
  }
  return await showDatePicker(from);
}

async function handleCartReview(from: string, text: string, session: WhatsAppSession, profileName: string) {
  const resolvedEarly = await resolveNumbered(from, text);
  const earlyLine = resolvedEarly ? parseCartLineId(resolvedEarly) : null;
  if (earlyLine?.kind === "rm") return await removeMatchedLine(from, earlyLine.menuId, earlyLine.variant);
  if (earlyLine?.kind === "uq" && earlyLine.qty) {
    return await updateMatchedLine(from, earlyLine.menuId, earlyLine.variant, earlyLine.qty);
  }

  const bare = text.trim();
  const isMenuNumber = /^(1|2|3)$/.test(bare);
  if (!isMenuNumber) {
    const edited = await applySpokenCartEdit(from, text, session);
    if (edited) return edited;
    const packs = parsePackQuantities(text);
    const itemId = session.selected_item_id || session.cart[session.cart.length - 1]?.menu_item_id;
    if (packs.length > 0 && itemId) {
      return await setPackLines(from, session, itemId, packs);
    }
    // A size was named but not paired with a count. Don't rewrite the line already in the cart.
    if (/\b500\b|\b1\s*kg\b|\bhalf\s*kg\b/i.test(text)) {
      await sendText(from, buildQtyMessage(session.selected_variant || "500gm", langOf(from)));
      return ack();
    }
    const qty = parseSpokenQuantity(text);
    const last = session.cart[session.cart.length - 1];
    if (qty != null && qty >= 1 && qty <= 10 && last) {
      const variant: PackSize = last.variant === "1kg" ? "1kg" : "500gm";
      return await setPackLines(from, session, last.menu_item_id, [{ size: variant, quantity: qty }]);
    }
  }

  const num = parseInt(text.trim(), 10);
  const resolved = await resolveNumbered(from, text);

  if (resolved === "checkout" || num === 1) {
    if (session.cart.length === 0) {
      await sendText(from, buildCartMessage([], langOf(from)));
      return ack();
    }
    return await afterCartReady(from, session);
  }
  if (resolved === "add_more" || num === 2 || /^add more$/i.test(text.trim())) {
    return await showAddMoreChoice(from);
  }
  if (resolved === "clear_cart" || num === 3) {
    await dropCartDraft(from, session, []);
    await sendText(from, buildCartMessage([], langOf(from)));
    return ack();
  }

  // A question while the cart is open is still a question. The cart stays.
  return await handleAiChat(from, text, profileName);
}

async function handleConfirmingLast(from: string, text: string, session: WhatsAppSession) {
  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();
  if (resolved === "reuse_last" || /same|last time|aama|same last/i.test(lower)) {
    return await applyLastAddressAndSlot(from, session);
  }
  if (resolved === "change_slot_addr" || /change|vera|different/i.test(lower)) {
    return await showDatePicker(from);
  }
  if (resolved === "edit_order" || /edit|cart/i.test(lower)) {
    return await showCart(from, session.cart);
  }
  const aside = await answerWithVidya(from, text, "");
  if (aside.kind === "done") return aside.response;
  if (aside.kind === "skip") {
    await sendText(from, "Say same to repeat the last door and time, or change to pick new ones.");
  }
  return reaskPending(from, "confirming_last");
}

async function handleConfirmingProposal(
  from: string,
  text: string,
  session: WhatsAppSession,
  profileName: string,
) {
  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();

  if (resolved === "confirm_proposal" || /^(yes|confirm|ok|sari|seri|aama|correct)\b/i.test(lower)) {
    return await confirmProposal(from, session);
  }
  if (resolved === "cancel_proposal" || /^(no|cancel|vendaam|stop)\b/i.test(lower)) {
    await updateSession(from, { proposal: null, state: "idle" });
    return await showFullMenu(from);
  }
  // Anything else is a correction — hand it back to the model with the draft
  // still in view rather than making them start again.
  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function handlePickingDate(from: string, text: string, _session: WhatsAppSession) {
  const date = parseDateInput(text);
  if (!date) {
    await sendText(from, buildDatePickerMessage(langOf(from)));
    return ack();
  }
  return await applyDeliveryDate(from, date);
}

async function handlePickingSlot(from: string, text: string, session: WhatsAppSession) {
  let slotKind: DeliverySlotKind | null = parseSlotInput(text);

  const resolved = await resolveNumbered(from, text);
  if (resolved === "slot_breakfast") slotKind = "breakfast";
  if (resolved === "slot_lunch") slotKind = "lunch";
  if (resolved === "slot_dinner") slotKind = "dinner";

  if (!slotKind) {
    await sendText(from, buildProposalAskMessage("slot", langOf(from)));
    return ack();
  }

  return await applySlot(from, session, slotKind);
}

async function handlePickingAddress(from: string, text: string, session: WhatsAppSession) {
  if (text.length < 5) return await askForAddress(from);
  const check = checkTypedAddress(text);
  if (check.status !== "ok") {
    await sendText(from, check.message);
    return await askForMapPin(from);
  }
  return await finishAddress(from, session, text.trim());
}

/**
 * A shared pin is checked against the real delivery radius. When the chat was
 * waiting for an address this completes that step; otherwise we just tell them
 * whether we reach them, which is the question a pin usually means.
 */
async function handleSharedLocation(
  from: string,
  session: WhatsAppSession,
  pin: { lat: number; lng: number; label: string },
) {
  const check = checkSharedPin(pin.lat, pin.lng);
  if (check.status !== "ok") {
    await sendText(from, check.message);
    return ack();
  }

  const geo = pin.label.trim().length >= 8 ? null : await reverseGeocode(pin.lat, pin.lng).catch(() => null);
  const address =
    pin.label.trim() ||
    geo ||
    `Pinned location (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})`;
  await updateSession(from, { delivery_address: address });
  const fresh = await getSession(from);
  const draft = readStoredDraft(fresh.recent_turns);

  if (draft && (session.state === "ai_chat" || session.state === "confirming_proposal")) {
    return await presentProposal(from, { ...draft, address }, address);
  }

  if (
    session.state === "picking_address" ||
    (fresh.cart.length > 0 && fresh.delivery_date && fresh.delivery_slot_kind)
  ) {
    return await finishAddress(from, fresh, address, { pinVerified: true });
  }

  await sendText(
    from,
    `Good news — we deliver there. ${DELIVERY_ZONE.name} and about ${DELIVERY_ZONE.radiusKm} km around it is our area.`,
  );
  return ack();
}

async function handlePickingPayMethod(from: string, text: string, session: WhatsAppSession) {
  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();
  if (resolved === "pay_online" || /online|upi|razor|pay now/i.test(lower)) {
    return await processConfirmOrder(from, session, "online");
  }
  if (resolved === "pay_cod" || /cash|cod/i.test(lower)) {
    return await handlePayCodTap(from, session);
  }
  if (resolved === "edit_order" || /edit|change/i.test(lower)) {
    return await showCart(from, session.cart);
  }
  await sendText(from, buildProposalAskMessage("payment", langOf(from)));
  return ack();
}

async function handleAwaitingPayment(from: string, text: string, session: WhatsAppSession) {
  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();

  if (resolved === "confirm_order" || resolved === "pay_online" || lower === "1" || /confirm|pay|yes/i.test(lower)) {
    return await offerPayOrConfirm(from, session);
  }
  if (resolved === "pay_cod") {
    return await handlePayCodTap(from, session);
  }
  if (resolved === "edit_order" || lower === "2" || /edit|change/i.test(lower)) {
    return await showCart(from, session.cart);
  }

  const aside = await answerWithVidya(from, text, "");
  if (aside.kind === "done") return aside.response;
  if (aside.kind === "skip") {
    await sendText(from, "The payment link is still open. Say pay when it's done, or tell me what to change.");
  }
  return ack();
}

// ─── Conversational ordering ───────────────────────────────────────────────

function understoodOrderLines(draft: ProposalDraft): string[] {
  const lines: string[] = [];
  for (const item of draft.items || []) {
    const dish = String(item.dish || "").trim();
    if (!dish) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const size = parsePackSize(String(item.size || "")) || parsePackSize(dish);
    lines.push(`${dish} × ${qty}${size ? ` (${size})` : ""}`);
  }
  const date = parseDateText(String(draft.date || "")) || parseDateText(String(draft.time || ""));
  const slot =
    parseSlotWord(String(draft.slot || "")) ||
    parseSlotWord(String(draft.time || "")) ||
    (() => {
      const hour = parseHour(String(draft.time || ""));
      return hour == null ? null : slotKindForHour(hour);
    })();
  const when = [slot ? slotLabel(slot) : null, date ? dateLabel(date) : null].filter(Boolean).join(" · ");
  if (when) lines.push(when);
  return lines;
}

async function handleAiChat(from: string, text: string, profileName: string) {
  const session = await getSession(from);
  if (session.cart.length > 0) {
    const edited = await applySpokenCartEdit(from, text, session);
    if (edited) return edited;
  }

  const history = session.recent_turns || [];
  // An open cart is the order. A leftover draft must not redraw it.
  const stored = session.cart.length > 0 ? null : readStoredDraft(history);
  if (stored) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(stored, text, last.address || session.delivery_address);
    if (filled.changed) return await presentProposal(from, filled.draft, text);
  } else if (parsePackSize(text) && session.selected_item_id) {
    return await applyVariant(from, parsePackSize(text)!);
  }

  const agent = new VidyaAgent();
  const result = await agent.processMessage(text, turnsForAgent(history), from, profileName);

  const turns: NonNullable<WhatsAppSession["recent_turns"]> = [
    ...history,
    { role: "user" as const, content: text },
    ...(result.reply ? [{ role: "assistant" as const, content: result.reply }] : []),
  ].slice(-16);

  // A model draft is not allowed to replace a cart that already has dishes.
  if (result.proposalDraft && session.cart.length > 0) {
    await dropCartDraft(from, session, session.cart);
    await sendText(from, buildCartUnchangedMessage());
    return await showCart(from, session.cart);
  }

  // A draft means they were trying to order. Price it here — the model has
  // never seen a price and is not allowed to quote one.
  if (result.proposalDraft) {
    await updateSession(from, { recent_turns: turnsWithDraft(turns, result.proposalDraft) });
    return await presentProposal(from, result.proposalDraft, text);
  }

  const choices = agentChoices(result.buttons);
  if (result.reply && choices.length > 0) {
    await storeOptions(from, choices);
    await sendButtons(from, result.reply, choices);
  } else if (result.reply) {
    await sendText(from, result.reply);
  }

  await updateSession(from, { state: "idle", recent_turns: turns });
  return ack();
}

/** Titles for the taps Vidya is allowed to offer. Anything else is dropped. */
function agentChoices(buttons: { id: string; title: string }[] | undefined) {
  const titles: Record<string, string> = {
    browse_menu: BTN.menu,
    buy_usual: BTN.buyUsual,
    help_support: BTN.help,
    track_order: BTN.track,
    cat_chicken: BTN.chicken,
    cat_mutton: BTN.mutton,
    cat_egg: BTN.egg,
    checkout: BTN.checkout,
    add_more: BTN.addMore,
    pay_online: BTN.payOnline,
    pay_cod: BTN.payCash,
    hs_call: BTN.callUs,
    open_app: BTN.openApp,
  };
  const chosen: { id: string; title: string }[] = [];
  for (const button of buttons || []) {
    const title = titles[button.id];
    if (!title || chosen.some((row) => row.id === button.id)) continue;
    chosen.push({ id: button.id, title });
    if (chosen.length === 3) break;
  }
  return chosen;
}

/** Price and rule-check a draft, then either ask for what's missing or show it. */
async function presentProposal(
  from: string,
  draft: ProposalDraft,
  sourceText?: string | null,
) {
  const lang = langOf(from);
  const menu = await getMenu();
  const last = await fetchLastAddressAndSlot(from);
  const session = await getSession(from);
  const turns = turnsWithDraft(session.recent_turns, draft);

  const result = buildProposal({
    menu,
    draft,
    sourceText,
    lastAddress: last.address || session.delivery_address,
    lastSlotKind: (last.slotKind || session.delivery_slot_kind) as DeliverySlotKind | null,
  });

  if (!result.ok && result.kind === "rejected") {
    if (result.code === "too_soon") {
      await updateSession(from, { state: "ai_chat", proposal: null, recent_turns: turns });
      return await showBookableSlots(from, result.reason);
    }
    await updateSession(from, { state: "idle", proposal: null });
    await sendText(from, result.reason);
    return await showFullMenu(from);
  }

  if (!result.ok) {
    // Keep the draft so a size/date/slot tap can finish this order, not restart checkout.
    await updateSession(from, { state: "ai_chat", proposal: null, recent_turns: turns });
    const savedAddress = last.address || session.delivery_address;
    const gaps = listDraftGaps(draft, {
      lastAddress: savedAddress,
      lastSlotKind: (last.slotKind || session.delivery_slot_kind) as DeliverySlotKind | null,
    });
    if (result.field !== "dish" && gaps.length > 1) {
      await sendText(
        from,
        buildInstantGapMessage(
        understoodOrderLines(draft),
        gaps.filter((g): g is "size" | "date" | "slot" | "address" | "payment" => g !== "dish"),
        Boolean(savedAddress),
      ),
      );
      return ack();
    }
    const ask = buildProposalAskMessage(result.field, lang);

    if (result.field === "size") {
      const buttons = [
        { id: "var_500gm", title: BTN.size500 },
        { id: "var_1kg", title: BTN.size1kg },
      ];
      const only = result.dishOptions?.[0];
      if (only) {
        await updateSession(from, { selected_item_id: only.id, state: "ai_chat", recent_turns: turns });
      }
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "dish") {
      const query = (draft.items || []).map((item) => item.dish).filter(Boolean).join(" ") || sourceText || "";
      if (!isKnownDishQuery(menu, query)) {
        await sendLookalikeCarousel(from, query);
        return ack();
      }
    }

    if (result.field === "dish" && result.dishOptions?.length) {
      await updateSession(from, { state: "picking_item" });
      await storeOptions(from, itemOptions(result.dishOptions));
      await sendList(from, whichDishAsk(draft, sourceText || ""), "Pick A Dish", [
        {
          title: "Did You Mean",
          rows: result.dishOptions.slice(0, 10).map((m) => {
            const formatted = formatFullDishName(m.name);
            return {
              id: m.id,
              title: formatted.length > 24 ? `${formatted.slice(0, 21)}...` : formatted,
              description: packPriceLine(m, " / "),
            };
          }),
        },
      ]);
      return ack();
    }

    if (result.field === "slot") {
      const buttons = [
        { id: "slot_breakfast", title: BTN.breakfast },
        { id: "slot_lunch", title: BTN.lunch },
        { id: "slot_dinner", title: BTN.dinner },
      ];
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "date") {
      return await showDatePicker(from);
    }

    if (result.field === "payment") {
      const buttons = [
        { id: "pay_online", title: BTN.payOnline },
        { id: "pay_cod", title: BTN.payCash },
      ];
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    await sendText(from, ask);
    return ack();
  }

  const proposal = result.proposal;
  await updateSession(from, {
    state: "confirming_proposal",
    proposal,
    recent_turns: chatTurns(turns).slice(-8),
  });

  const buttons = [
    { id: "confirm_proposal", title: BTN.confirmOrder },
    { id: "cancel_proposal", title: BTN.startOver },
  ];
  await storeOptions(from, buttons);
  const quoted = await quoteCart(proposal.cart, from);
  await sendButtons(
    from,
    buildProposalMessage(
      proposal.cart,
      dateLabel(proposal.deliveryDate),
      slotLabel(proposal.slotKind),
      proposal.address,
      proposal.paymentMethod === "cod" ? "Cash on delivery" : "Pay online",
      lang,
      quoted.offer,
    ),
    buttons,
  );
  return ack();
}

/** The Confirm tap. Re-validated and re-priced before anything is written. */
async function confirmProposal(from: string, session: WhatsAppSession) {
  const stored = session.proposal as OrderProposal | null;
  if (!stored) {
    await updateSession(from, { state: "idle" });
    return await showFullMenu(from);
  }

  const menu = await getMenu();
  const proposal = repriceProposal(stored, menu);

  // Time has passed since the card was sent; the 24-hour rule still applies.
  if (!isProposalStillValid(proposal)) {
    await updateSession(from, { proposal: null, state: "idle" });
    await sendText(from, buildProposalExpiredMessage(langOf(from)));
    return await showDatePicker(from);
  }

  await updateSession(from, {
    cart: proposal.cart,
    delivery_date: proposal.deliveryDate,
    delivery_slot_kind: proposal.slotKind,
    delivery_address: proposal.address,
    proposal: null,
  });

  return await processConfirmOrder(
    from,
    {
      cart: proposal.cart,
      delivery_date: proposal.deliveryDate,
      delivery_slot_kind: proposal.slotKind,
      delivery_address: proposal.address,
    },
    proposal.paymentMethod,
  );
}

// ─── Ratings ───────────────────────────────────────────────────────────────

async function applyRating(from: string, orderId: string, stars: number) {
  const lang = langOf(from);
  const db = createServerSupabase();
  const saved = await saveOrderRatingByPhone(db, orderId, stars, from);

  if (!saved.ok) {
    await updateSession(from, { pending_options: null });
    await sendText(from, ratingThanksReply(lang));
    return ack();
  }

  const buttons = [{ id: "rating_skip", title: BTN.skip }];
  await updateSession(from, {
    state: "rating_comment",
    rating_order_id: orderId,
    pending_options: buttons,
  });
  await sendButtons(from, buildRatingCommentPrompt(stars, lang), buttons);
  return ack();
}

async function handleRatingComment(
  from: string,
  text: string,
  session: WhatsAppSession,
  interactiveReplyId: string | null,
) {
  const lang = langOf(from);

  if (interactiveReplyId === "rating_skip" || /^(skip|no|later|vendaam)\b/i.test(text)) {
    await updateSession(from, { state: "idle", rating_order_id: null, pending_options: null });
    await sendText(from, ratingThanksReply(lang));
    return ack();
  }

  const orderId = session.rating_order_id;
  if (!orderId || text.length < 2) {
    await updateSession(from, { state: "idle", rating_order_id: null });
    await sendText(from, ratingThanksReply(lang));
    return ack();
  }

  const db = createServerSupabase();
  const saved = await saveOrderRatingCommentByPhone(db, orderId, text, from);
  if (!saved.ok) console.error("[WA] rating comment:", saved.error);

  await updateSession(from, { state: "idle", rating_order_id: null, pending_options: null });
  await sendText(from, ratingCommentThanks(lang));
  return ack();
}

// ─── Shared Flows ──────────────────────────────────────────────────────────

/**
 * Home row, at most three buttons.
 *
 * "Install app" only earns its slot if we have no sign they already have the
 * app. When they do, that slot goes to the thing they are most likely to want:
 * tracking a live order, or reordering.
 */
async function homeButtons(_from: string): Promise<{ id: string; title: string }[]> {
  return [
    { id: "buy_usual", title: BTN.buyUsual },
    { id: "browse_menu", title: BTN.menu },
    { id: "help_support", title: BTN.help },
  ];
}

async function askForMapPin(from: string) {
  await updateSession(from, { state: "picking_address" });
  await sendLocationRequest(from, buildMapPinPrompt(langOf(from)));
  return ack();
}

async function askForAddress(from: string) {
  await updateSession(from, { state: "picking_address" });
  const profile = await fetchUsualProfile(from).catch(() => null);
  const saved = profile?.addresses ?? [];
  if (saved.length === 0) return await askForMapPin(from);

  const rows = [
    ...saved.slice(0, 8).map((address, index) => ({
      id: `addr_${index}`,
      title: clipLabel(address, 24),
      description: clipLabel(address, 72),
    })),
    { id: "addr_map", title: "Choose on map", description: "Drop a pin. No need to type it." },
  ];
  await sendList(from, buildAddressChoicesMessage(langOf(from)), "Address", [
    { title: "Deliver to", rows },
  ]);
  await storeOptions(
    from,
    rows.map((row) => ({ id: row.id, title: row.title })),
  );
  return ack();
}

async function useSavedAddress(from: string, index: number) {
  const profile = await fetchUsualProfile(from);
  const address = profile?.addresses[index];
  if (!address) return await askForAddress(from);
  const session = await getSession(from);
  return await finishAddress(from, session, address);
}

function clipLabel(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3))}...`;
}

function usualListRows(profile: NonNullable<Awaited<ReturnType<typeof fetchUsualProfile>>>, active: boolean) {
  const dishes = profile.dishes.map((dish, index) => ({
    id: `buyusual_${index}`,
    title: clipLabel(formatFullDishName(dish.name), 24),
    description: `${dish.variant} × ${dish.quantity}`.slice(0, 72),
  }));
  const other = [
    { id: "browse_menu", title: "Full menu", description: "Pick something else" },
    active
      ? { id: "track_order", title: "Track order", description: "An order is already moving" }
      : { id: "help_support", title: "Help", description: "Questions, or a problem with an order" },
  ];
  return { dishes, other };
}

async function showUsualList(from: string) {
  const [profile, active] = await Promise.all([fetchUsualProfile(from), hasActiveOrder(from)]);
  if (!profile?.dishes.length) {
    await sendText(from, buildReorderEmptyMessage(langOf(from)));
    return await showFullMenu(from);
  }
  const rows = usualListRows(profile, active);
  const options = [...rows.dishes, ...rows.other];
  await sendList(from, buildUsualListBody(langOf(from)), BTN.buyUsual, [
    { title: "Your usual", rows: rows.dishes },
    { title: "Or", rows: rows.other },
  ]);
  await storeOptions(from, options.map((row) => ({ id: row.id, title: row.title })));
  return ack();
}

async function startUsualDish(from: string, index: number) {
  const profile = await fetchUsualProfile(from);
  const dish = profile?.dishes[index];
  if (!profile || !dish) {
    await sendText(from, buildReorderEmptyMessage(langOf(from)));
    return await showFullMenu(from);
  }
  const menu = await getMenu();
  const item = menu.find((row) => row.id === dish.menuItemId);
  if (!item) {
    await sendText(from, buildReorderEmptyMessage(langOf(from)));
    return await showFullMenu(from);
  }
  const variant: PackSize = dish.variant === "1kg" ? "1kg" : "500gm";
  const kind = profile.slotKind && isValidSlotKind(profile.slotKind) ? profile.slotKind : "lunch";
  const next = nextBookableDateForKind(kind);
  const session = await getSession(from);
  await updateSession(from, {
    cart: [
      {
        menu_item_id: item.id,
        name: item.name,
        variant,
        quantity: dish.quantity,
        unit_price: unitPriceFor(item, variant),
      },
    ],
    delivery_address: profile.address,
    delivery_slot_kind: kind,
    delivery_date: next?.ymd ?? null,
    proposal: null,
    selected_item_id: null,
    selected_variant: null,
    recent_turns: turnsWithUsualPay(session.recent_turns, profile.payment),
    state: !next ? "picking_date" : profile.address ? "awaiting_payment" : "picking_address",
  });
  if (!next) return await showDatePicker(from);
  if (!profile.address) return await askForAddress(from);
  const fresh = await getSession(from);
  return await finishAddress(from, fresh, profile.address, { usualPayment: profile.payment });
}

async function showUsualChange(from: string) {
  const rows = [
    { id: "usual_dish", title: "Change dish", description: "Pick another usual" },
    { id: "usual_qty", title: "Change quantity", description: "Edit what is in the cart" },
    { id: "usual_time", title: "Change time", description: "Another day or meal" },
    { id: "usual_addr", title: "Change address", description: "A different door" },
    { id: "usual_back", title: "Back to payment", description: "Keep this order" },
  ];
  await sendList(from, buildUsualChangeMessage(langOf(from)), BTN.change, [{ title: "Change", rows }]);
  await storeOptions(
    from,
    rows.map((row) => ({ id: row.id, title: row.title })),
  );
  return ack();
}

async function resumeUsualPayment(from: string) {
  const session = await getSession(from);
  if (!session.cart.length) return await showUsualList(from);
  if (!session.delivery_date || !session.delivery_slot_kind) return await showDatePicker(from);
  if (!session.delivery_address) return await askForAddress(from);
  return await finishAddress(from, session, session.delivery_address, {
    usualPayment: readUsualPay(session.recent_turns) ?? undefined,
  });
}

async function showWelcome(from: string, profileName: string) {
  const firstName = profileName?.trim().split(/\s+/)[0];
  const lang = langOf(from);

  const [active, returning] = await Promise.all([hasActiveOrder(from), hasOrders(from)]);
  const kind = active ? "active" : returning ? "returning" : "new";
  const buttons = await homeButtons(from);

  try {
    await sendButtons(from, buildWelcomeMessage(firstName, kind, lang), buttons, {
      headerImageUrl: welcomeLogoImageUrl(),
    });
    console.log(`[WA] Welcome (${kind}) sent to ${from}`);
  } catch (e) {
    console.error("[WA] welcome send failed, text fallback:", e);
    try {
      await sendText(from, buildWelcomeMessage(firstName, kind, lang));
    } catch (textErr) {
      console.error("[WA] welcome text fallback failed:", textErr);
    }
  }

  after(async () => {
    try {
      await resetSession(from);
      await storeOptions(from, buttons);
      await trackWhatsAppUser(from, profileName?.trim() || "WhatsApp User");
    } catch (e) {
      console.error("[WA] welcome background:", e);
    }
  });

  return ack();
}

async function showInstallApp(from: string, profileName: string) {
  const lang = langOf(from);
  const [token, installed] = await Promise.all([
    createAutoLoginToken(from, profileName || "Friend"),
    hasAppInstalledSignal(from),
  ]);
  // Phone gets a confirm-then-install sheet. Laptop gets a QR to that same page.
  const autoLoginUrl = installed
    ? `${publicSiteOrigin()}?wa_token=${token}`
    : `${publicSiteOrigin()}?wa_token=${token}&install=1`;
  const body = installed ? buildOpenAppBody(lang) : buildPwaPromoBody(lang);
  await sendCtaUrl(from, body, autoLoginUrl, BTN.openApp);
  return ack();
}

/**
 * The menu, best format first.
 *
 * A Multi-Product Message is the only one that renders Meta's own photos and
 * prices, and lets the customer build a cart and send it back in one go. The
 * chain below degrades one step at a time and always ends in something
 * readable: catalog → category carousel → interactive list → numbered text.
 */
function dishCards(dishes: DishPricing[]): { id: string; title: string; body: string; imageUrl: string; buttonTitle: string }[] {
  return dishes.map((dish) => {
    const name = formatFullDishName(dish.name);
    return {
      id: `add_${dish.retailerId}`,
      title: name,
      body: `${name}\n500gm ${formatInr(dish.prices["500gm"])} · 1kg ${formatInr(dish.prices["1kg"])}`.slice(0, 160),
      imageUrl: publicDishImageUrl({ image_url: dish.imagePath, retailer_id: dish.retailerId }),
      buttonTitle: "Choose size",
    };
  });
}

function dishesInCategory(category: string): DishPricing[] {
  return allDishPricing().filter((dish) => dish.category === category);
}

function lookalikeDishes(query: string): DishPricing[] {
  const category = dishQueryCategory(query);
  const pool = category ? dishesInCategory(category) : allDishPricing();
  const rank = (dish: DishPricing) => {
    const index = KITCHEN_PICK_DISH_IDS.indexOf(dish.dishId);
    return index < 0 ? 99 : index;
  };
  return pool.slice().sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 5);
}

async function rememberDishCards(from: string, dishes: DishPricing[]): Promise<void> {
  await storeOptions(
    from,
    dishes.map((dish) => ({
      id: `add_${dish.retailerId}`,
      title: formatFullDishName(dish.name),
    })),
  );
}

async function sendLookalikeCarousel(from: string, query: string): Promise<void> {
  const category = dishQueryCategory(query);
  const dishes = lookalikeDishes(query);
  const heading = await new VidyaAgent().writeMissingDishLine(query, category);
  if (dishes.length > 0) await rememberDishCards(from, dishes);
  if (dishes.length >= 2 && (await sendCarousel(from, heading, dishCards(dishes)))) return;
  if (dishes.length === 0) {
    await sendText(from, heading);
    return;
  }
  await sendList(from, heading, "See dishes", [
    {
      title: category ? categoryDisplayLabel(category) : "House favourites",
      rows: dishes.map((dish) => ({
        id: `add_${dish.retailerId}`,
        title: formatFullDishName(dish.name).slice(0, 24),
        description: `500gm ${formatInr(dish.prices["500gm"])} · 1kg ${formatInr(dish.prices["1kg"])}`.slice(0, 72),
      })),
    },
  ]);
}

function bookableSlotRows(): { id: string; title: string; description: string }[] {
  const rows: { id: string; title: string; description: string }[] = [];
  for (const day of iterDeliveryDateOptions(6)) {
    for (const card of day.cards) {
      if (!card.available) continue;
      rows.push({
        id: `book_${day.istYmd}_${card.kind}`,
        title: card.label.slice(0, 24),
        description: `${day.weekendLabel} · ${card.rangeLabel}`.slice(0, 72),
      });
      if (rows.length >= 9) return rows;
    }
  }
  return rows;
}

async function showBookableSlots(from: string, reason: string) {
  const rows = bookableSlotRows();
  if (rows.length === 0) {
    await sendText(from, reason);
    return ack();
  }
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  await sendList(from, reason, "Pick a slot", [{ title: "Open slots", rows }]);
  return ack();
}

async function applyBookedSlot(from: string, ymd: string, kind: DeliverySlotKind) {
  const session = await getSession(from);
  const draft = readStoredDraft(session.recent_turns);
  if (draft) {
    return await presentProposal(from, { ...draft, date: ymd, slot: kind });
  }
  await updateSession(from, { delivery_date: ymd, delivery_slot_kind: kind });
  return await applySlot(from, { ...(await getSession(from)), delivery_date: ymd, delivery_slot_kind: kind }, kind);
}

async function addDishByRetailer(from: string, retailerId: string) {
  const pricing = dishPricingForRetailerId(retailerId);
  if (!pricing) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return await showFullMenu(from);
  }
  const menu = await getMenu();
  const item =
    menu.find((m) => m.id === pricing.dishId || m.retailer_id === pricing.retailerId) ||
    ({
      id: pricing.dishId,
      retailer_id: pricing.retailerId,
      name: pricing.name,
      price: pricing.prices["1kg"],
      category: pricing.category,
      image_url: pricing.imagePath,
    } satisfies MenuItem);
  return await showVariantPicker(from, item);
}

async function showAddMoreChoice(from: string) {
  const buttons = [{ id: "addmore_menu", title: "Menu" }];
  await updateSession(from, { state: "cart_review" });
  await storeOptions(from, buttons);
  await sendButtons(from, "Tap Menu to add another dish. Your cart stays as it is.", buttons);
  return ack();
}

async function showSizedMenu(from: string) {
  const catalogId = whatsappCatalogId();
  const drawers = catalogPackDrawers();
  if (catalogId && drawers.length > 0) {
    let sent = false;
    for (const sections of drawers) {
      const names = [...new Set(sections.map((section) => section.title.replace(/\s+\(.*\)$/, "")))];
      const header = names.length === 1 ? names[0] : `${names[0]} and ${names[1].toLowerCase()}`;
      const ok = await sendProductList(
        from,
        catalogId,
        header,
        "Tap View items. 500gm is the first heading, then 1kg.",
        sections,
        "Vidya's Kitchen, Sivakasi",
      );
      if (ok) sent = true;
    }
    if (sent) return ack();
    console.error("[WA] sized menu product_list failed — falling back to a list.");
  }

  const rows = [
    { id: "szsec_chicken_500gm", title: "Chicken (500gm)", description: "Chicken dishes, 500gm pack" },
    { id: "szsec_chicken_1kg", title: "Chicken (1kg)", description: "Chicken dishes, 1kg pack" },
    { id: "szsec_mutton_500gm", title: "Mutton (500gm)", description: "Mutton dishes, 500gm pack" },
    { id: "szsec_mutton_1kg", title: "Mutton (1kg)", description: "Mutton dishes, 1kg pack" },
    { id: "szsec_egg_500gm", title: "Egg (500gm)", description: "Egg dishes, 500gm pack" },
    { id: "szsec_egg_1kg", title: "Egg (1kg)", description: "Egg dishes, 1kg pack" },
  ];
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  await sendList(from, "Pick a pack size. The dishes for that size open next.", "Menu", [
    { title: "Menu", rows },
  ]);
  return ack();
}

async function showSizedSectionItems(from: string, category: string, variant: PackSize) {
  const dishes = dishesInCategory(category);
  const rows = dishes.slice(0, 10).map((dish) => ({
    id: `${variant === "1kg" ? "sz1kg" : "sz500"}_${dish.retailerId}`,
    title: formatFullDishName(dish.name).slice(0, 24),
    description: formatInr(dish.prices[variant]),
  }));
  if (rows.length === 0) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return ack();
  }
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  const heading = `${categoryDisplayLabel(category)} (${variant})`;
  await sendList(from, heading, "Menu", [{ title: heading.slice(0, 24), rows }]);
  return ack();
}

async function addDishAtSize(from: string, retailerId: string, variant: PackSize) {
  const pricing = dishPricingForRetailerId(retailerId);
  if (!pricing) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return ack();
  }
  const menu = await getMenu();
  const item =
    menu.find((m) => m.id === pricing.dishId || m.retailer_id === pricing.retailerId) ||
    ({
      id: pricing.dishId,
      retailer_id: pricing.retailerId,
      name: pricing.name,
      price: pricing.prices[variant],
      category: pricing.category,
      image_url: pricing.imagePath,
    } satisfies MenuItem);
  const buttons = [
    { id: "qty_1", title: "1" },
    { id: "qty_2", title: "2" },
    { id: "qty_3", title: "3" },
  ];
  await updateSession(from, { selected_item_id: item.id, selected_variant: variant, state: "picking_qty" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildQtyMessage(variant, langOf(from)), buttons);
  return ack();
}

async function showFullMenu(from: string) {
  await updateSession(from, { state: "browsing_category" });

  const shown: DishPricing[] = [];
  let sent = false;
  for (const category of MENU_SECTION_ORDER) {
    const dishes = dishesInCategory(category).slice(0, 10);
    if (dishes.length === 0) continue;
    const rows = dishes.map((dish) => ({
      id: `add_${dish.retailerId}`,
      title: formatFullDishName(dish.name).slice(0, 24),
      description: `500gm ${formatInr(dish.prices["500gm"])} · 1kg ${formatInr(dish.prices["1kg"])}`.slice(0, 72),
    }));
    const ok = await sendList(
      from,
      `${categoryDisplayLabel(category)}\nTap a dish, then pick 500gm or 1kg.`,
      "View menu",
      [{ title: categoryDisplayLabel(category).slice(0, 24), rows }],
    );
    if (ok) {
      sent = true;
      shown.push(...dishes);
    }
  }
  if (sent) {
    await rememberDishCards(from, shown.slice(0, 10));
    return ack();
  }

  return await showCategoryBrowser(from);
}

async function showCategoryBrowser(from: string) {
  const options = [
    { id: "cat_chicken", title: BTN.chicken },
    { id: "cat_mutton", title: BTN.mutton },
    { id: "cat_egg", title: BTN.egg },
  ];
  try {
    await updateSession(from, { state: "browsing_category", pending_options: options });
  } catch (e) {
    console.error("[WA] showCategoryBrowser updateSession error:", e);
  }

  const lang = langOf(from);
  await sendList(from, buildCategoryListBody(lang), "View Menu", [
    {
      title: "Categories",
      rows: [
        { id: "cat_chicken", title: BTN.chicken, description: "Gravies, Pepper, Wings" },
        { id: "cat_mutton", title: BTN.mutton, description: "Curries, Keema, Stew" },
        { id: "cat_egg", title: BTN.egg, description: "Egg Curry and Chalna" },
      ],
    },
  ]);
  return ack();
}

async function showCategoryItems(from: string, cat: string) {
  const lang = langOf(from);
  const catLabel = categoryDisplayLabel(cat);
  const items = await getMenuByCategory(cat);

  if (items.length === 0) {
    await sendText(from, buildCategoryMessage(lang));
    return ack();
  }

  const dishes = dishesInCategory(cat).slice(0, 10);
  if (dishes.length > 0) {
    await rememberDishCards(from, dishes);
    await updateSession(from, { state: "picking_item" });
    const rows = dishes.map((dish) => ({
      id: `add_${dish.retailerId}`,
      title: formatFullDishName(dish.name).slice(0, 24),
      description: `500gm ${formatInr(dish.prices["500gm"])} · 1kg ${formatInr(dish.prices["1kg"])}`.slice(0, 72),
    }));
    await sendList(from, `${catLabel}\nTap a dish, then pick 500gm or 1kg.`, "View menu", [
      { title: catLabel.slice(0, 24), rows },
    ]);
    return ack();
  }

  const slice = items.slice(0, 10);
  await storeOptions(from, itemOptions(slice));
  await updateSession(from, { state: "picking_item" });
  let body = buildDishListBody(catLabel, lang);
  if (items.length > 10) {
    body += `\n\n${buildAppNudgeFooter(lang)}`;
  }
  const rows = slice.map((m) => {
    const formatted = formatFullDishName(m.name);
    return {
      id: m.id,
      title: formatted.length > 24 ? `${formatted.slice(0, 21)}...` : formatted,
      description: packPriceLine(m, " / "),
    };
  });
  await sendList(from, body, "Pick A Dish", [{ title: catLabel, rows }]);
  return ack();
}

async function showVariantPicker(from: string, item: MenuItem) {
  const lang = langOf(from);
  const prices = packPricesFor(item);
  const rows = [
    { id: "var_500gm", title: BTN.size500, description: formatInr(prices["500gm"]) },
    { id: "var_1kg", title: BTN.size1kg, description: formatInr(prices["1kg"]) },
  ];
  await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
  await storeOptions(
    from,
    rows.map((row) => ({ id: row.id, title: row.title })),
  );
  await sendList(from, buildVariantMessage(formatFullDishName(item.name), prices, lang), "Choose size", [
    { title: "Size", rows },
  ]);
  return ack();
}

async function applyVariant(from: string, variant: PackSize) {
  const session = await getSession(from);
  const stored = session.cart.length > 0 ? null : readStoredDraft(session.recent_turns);
  const menu = await getMenu();
  const selected = session.selected_item_id
    ? menu.find((m) => m.id === session.selected_item_id)
    : undefined;

  // The size buttons sit on a dish card. A leftover draft (an earlier wings
  // order, still holding its date and address) must not keep that other dish.
  // An open cart stays the order: the size tap falls through to the qty picker.
  if (session.cart.length === 0 && session.state === "picking_variant" && selected) {
    const draft: ProposalDraft = {
      ...(stored || {}),
      items: [
        {
          dish: selected.name,
          size: variant,
          quantity: Math.max(1, Math.floor(Number(stored?.items?.[0]?.quantity) || 1)),
        },
      ],
    };
    if (stored) return await presentProposal(from, draft);
  } else if (session.cart.length === 0 && (stored || (session.state === "ai_chat" && selected))) {
    const items = (stored?.items || []).map((item) => ({
      ...item,
      size: parsePackSize(String(item.size || "")) ?? variant,
    }));
    if (items.length === 0 && selected) {
      items.push({ dish: selected.name, size: variant, quantity: 1 });
    }
    const draft: ProposalDraft = { ...(stored || {}), items };
    return await presentProposal(from, draft);
  }

  const buttons = [
    { id: "qty_1", title: "1" },
    { id: "qty_2", title: "2" },
    { id: "qty_3", title: "3" },
  ];
  await updateSession(from, { selected_variant: variant, state: "picking_qty" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildQtyMessage(variant, langOf(from)), buttons);
  return ack();
}

async function handleMarketingOrderTap(from: string, retailerOrId: string) {
  const menu = await getMenu();
  const key = retailerOrId.trim();
  const parsed = parseCatalogProductId(key);
  const retailer = parsed ? retailerIdForCsvPrefix(parsed.prefix) : key;
  const item = menu.find(
    (m) =>
      m.id === key ||
      m.retailer_id === key ||
      m.retailer_id === retailer ||
      guessRetailerId(m) === retailer,
  );
  if (!item) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return await showFullMenu(from);
  }
  if (parsed) {
    await updateSession(from, { selected_item_id: item.id, selected_variant: parsed.variant });
    return await applyVariant(from, parsed.variant);
  }
  return await showVariantPicker(from, item);
}

async function setPackLines(
  from: string,
  session: WhatsAppSession,
  menuItemId: string,
  packs: { size: PackSize; quantity: number }[],
) {
  const menu = await getMenu();
  const item = menu.find((m) => m.id === menuItemId);
  if (!item) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return ack();
  }
  if (packs.some((pack) => pack.quantity < 1 || pack.quantity > 10)) {
    await sendText(from, buildQtyMessage(session.selected_variant || packs[0]?.size || "500gm", langOf(from)));
    return ack();
  }

  const cart = [...(session.cart || [])];
  const newLines = packs.filter(
    (pack) => !cart.some((line) => line.menu_item_id === item.id && line.variant === pack.size),
  );
  if (cart.length + newLines.length > WA_CART_MAX) {
    await sendText(from, buildCartLimitMessage(langOf(from)));
    return ack();
  }

  for (const pack of packs) {
    const unitPrice = unitPriceFor(item, pack.size);
    const existingIdx = cart.findIndex((line) => line.menu_item_id === item.id && line.variant === pack.size);
    if (existingIdx >= 0) {
      cart[existingIdx] = { ...cart[existingIdx], quantity: pack.quantity, unit_price: unitPrice };
    } else {
      cart.push({
        menu_item_id: item.id,
        name: item.name,
        variant: pack.size,
        quantity: pack.quantity,
        unit_price: unitPrice,
      });
    }
  }

  await updateSession(from, {
    cart,
    selected_item_id: item.id,
    selected_variant: null,
    selected_qty: 1,
    state: "cart_review",
  });
  await sendText(
    from,
    buildItemsAddedMessage(
      packs.map((pack) => ({ name: item.name, variant: pack.size, qty: pack.quantity })),
      langOf(from),
    ),
  );
  return await showCart(from, cart);
}

async function addSelectedItemToCart(from: string, session: WhatsAppSession, qty: number) {
  const menu = await getMenu();
  const item = menu.find((m) => m.id === session.selected_item_id);
  if (!item) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    await updateSession(from, { state: "idle" });
    return ack();
  }

  const variant: PackSize = session.selected_variant === "1kg" ? "1kg" : "500gm";
  const unitPrice = unitPriceFor(item, variant);

  const cart = [...(session.cart || [])];
  const existingIdx = cart.findIndex((c) => c.menu_item_id === item.id && c.variant === variant);
  if (cart.length >= WA_CART_MAX && existingIdx < 0) {
    await sendText(from, buildCartLimitMessage(langOf(from)));
    return ack();
  }

  if (existingIdx >= 0) {
    cart[existingIdx].quantity += qty;
  } else {
    cart.push({
      menu_item_id: item.id,
      name: item.name,
      variant,
      quantity: qty,
      unit_price: unitPrice,
    });
  }

  await updateSession(from, {
    cart,
    selected_item_id: null,
    selected_variant: null,
    selected_qty: 1,
    state: "cart_review",
  });

  await sendText(from, buildItemAddedMessage(item.name, variant, qty, langOf(from)));
  return await showCart(from, cart);
}

async function showCart(from: string, cart: CartItem[]) {
  const lang = langOf(from);
  const live = await getSession(from);
  const resume = pendingResume(live.recent_turns);
  // A cart edit that interrupted a question comes back to that question.
  // The confirmation was already sent by the edit itself.
  if (resume && cart.length > 0) {
    return reaskPending(from, resume);
  }
  await updateSession(from, { state: "cart_review" });
  const buttons = [
    { id: "checkout", title: BTN.checkout },
    { id: "add_more", title: BTN.addMore },
    { id: "clear_cart", title: BTN.clearCart },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildCartMessage(cart, lang), buttons);
  return ack();
}

async function afterCartReady(from: string, session: WhatsAppSession) {
  try {
    const upsell = await cartUpsellMessage(session.cart);
    if (upsell) await sendText(from, upsell);
  } catch (err) {
    console.error("[WA upsell]", err);
  }
  const last = await fetchLastAddressAndSlot(from);
  if (last.address || last.slotKind) {
    await updateSession(from, {
      state: "confirming_last",
      delivery_address: last.address,
      delivery_slot_kind: last.slotKind,
    });
    const line = last.slotKind ? slotLabel(last.slotKind) : null;
    const buttons = [
      { id: "reuse_last", title: BTN.sameAsLast },
      { id: "change_slot_addr", title: BTN.change },
      { id: "edit_order", title: BTN.editCart },
    ];
    await storeOptions(from, buttons);
    await sendButtons(from, buildReuseLastPrompt(session.cart, last.address, line, langOf(from)), buttons);
    return ack();
  }
  return await showDatePicker(from);
}

async function showDatePicker(from: string) {
  const rows = upcomingDateRows();
  await updateSession(from, { state: "picking_date", pending_options: rows.map((r) => ({ id: r.id, title: r.title })) });
  await sendList(from, buildDatePickerMessage(langOf(from)), "Pick A Day", [{ title: "Delivery Day", rows }]);
  return ack();
}

async function applyDeliveryDate(from: string, ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    await sendText(from, buildDatePickerMessage(langOf(from)));
    return ack();
  }
  const buttons = [
    { id: "slot_breakfast", title: BTN.breakfast },
    { id: "slot_lunch", title: BTN.lunch },
    { id: "slot_dinner", title: BTN.dinner },
  ];
  const prior = await getSession(from);
  await updateSession(from, {
    delivery_date: ymd,
    state: "picking_slot",
    recent_turns: withInterrupt(prior.recent_turns, "picking_date", 0),
  });
  await storeOptions(from, buttons);
  await sendButtons(from, buildSlotPickerMessage(dateLabel(ymd), langOf(from)), buttons);
  return ack();
}

async function applySlot(from: string, session: WhatsAppSession, slotKind: DeliverySlotKind) {
  const date = session.delivery_date;
  if (date) {
    const slotIso = slotStartIsoFor(date, slotKind);
    if (!isSlotBookable(slotIso)) {
      const def = DELIVERY_SLOT_DEFS[slotKind];
      return await showBookableSlots(
        from,
        `We cook every order fresh, so it has to be placed at least 24 hours before the slot. ${def.label} on ${dateLabel(date)} (${def.rangeLabel}) is too soon. Pick a later time below.`,
      );
    }
  }

  await updateSession(from, { delivery_slot_kind: slotKind, state: "picking_address" });

  const lastAddr = session.delivery_address || (await fetchLastAddressAndSlot(from)).address;
  if (lastAddr) {
    await updateSession(from, { delivery_address: lastAddr });
    const buttons = [
      { id: "reuse_address", title: BTN.sameAddress },
      { id: "new_address", title: BTN.newAddress },
    ];
    await storeOptions(from, buttons);
    await sendButtons(from, buildReuseAddressPrompt(lastAddr, langOf(from)), buttons);
    return ack();
  }

  return await askForAddress(from);
}

async function applyLastAddressAndSlot(from: string, session: WhatsAppSession) {
  const last = await fetchLastAddressAndSlot(from);
  const kind = (session.delivery_slot_kind || last.slotKind) as DeliverySlotKind | null;
  const address = session.delivery_address || last.address;

  if (kind && isValidSlotKind(kind)) {
    const next = nextBookableDateForKind(kind);
    if (next) {
      await updateSession(from, {
        delivery_date: next.ymd,
        delivery_slot_kind: kind,
        delivery_address: address,
      });
      if (address) {
        return await finishAddress(from, { ...session, delivery_date: next.ymd, delivery_slot_kind: kind }, address);
      }
      return await askForAddress(from);
    }
  }

  if (address) await updateSession(from, { delivery_address: address });
  return await showDatePicker(from);
}

async function finishAddress(
  from: string,
  session: WhatsAppSession | { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null },
  address: string,
  opts?: { pinVerified?: boolean; usualPayment?: UsualPayment },
) {
  if (!address || address.length < 5) return await askForAddress(from);

  const pinLabel = /^Pinned location \(/.test(address);
  if (!opts?.pinVerified && !pinLabel) {
    const check = checkTypedAddress(address);
    if (check.status !== "ok") {
      await sendText(from, check.message);
      return await askForMapPin(from);
    }
  }

  await updateSession(from, { delivery_address: address, state: "awaiting_payment" });
  const quoted = await quoteCart(session.cart, from);
  const dateStr = session.delivery_date ? dateLabel(session.delivery_date) : "To be confirmed";
  const summary = buildOrderSummaryMessage(
    session.cart,
    dateStr,
    session.delivery_slot_kind || "lunch",
    address,
    langOf(from),
    quoted.offer,
  );
  const usualPayment = opts?.usualPayment ?? readUsualPay((await getSession(from)).recent_turns) ?? undefined;
  return await showSummaryButtons(from, session.cart, summary, quoted.total, usualPayment);
}

async function showSummaryButtons(
  from: string,
  cart: CartItem[],
  summary: string,
  quotedTotal?: number,
  usualPayment?: UsualPayment,
) {
  const total = quotedTotal ?? cartGrandTotal(cart);
  const overLimit = !isCodAllowedForTotal(total);
  const lang = langOf(from);
  const tail = usualPayment
    ? `\n\n_${buildUsualPayNote(usualPayment, lang, overLimit)}_`
    : overLimit
      ? `\n\n${buildCodOverLimitMention(lang)}`
      : "";
  const body = `${summary}${tail}`;
  const payOnline = { id: "pay_online", title: BTN.payOnline };
  const payCash = { id: "pay_cod", title: BTN.payCash };
  const change = usualPayment
    ? { id: "usual_change", title: BTN.change }
    : { id: "edit_order", title: BTN.edit };
  const buttons = overLimit
    ? [payOnline, change]
    : usualPayment === "cod"
      ? [payCash, payOnline, change]
      : [payOnline, payCash, change];
  await storeOptions(from, buttons);
  await sendButtons(from, body, buttons);
  return ack();
}

async function offerPayOrConfirm(from: string, session: WhatsAppSession) {
  const { total } = await quoteCart(session.cart, from);
  const overLimit = !isCodAllowedForTotal(total);
  await updateSession(from, { state: "picking_pay_method" });
  const buttons = overLimit
    ? [
        { id: "pay_online", title: BTN.payOnline },
        { id: "edit_order", title: BTN.edit },
      ]
    : [
        { id: "pay_online", title: BTN.payOnline },
        { id: "pay_cod", title: BTN.payCash },
        { id: "edit_order", title: BTN.edit },
      ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildPayMethodPrompt(total, langOf(from), { overLimit }), buttons);
  return ack();
}

async function handlePayCodTap(from: string, session: WhatsAppSession) {
  const { total } = await quoteCart(session.cart, from);
  const serverDb = createServerSupabase();
  const blocked = await isCodBlocked(serverDb, from).catch(() => false);
  if (blocked || !isCodAllowedForTotal(total)) {
    const buttons = [
      { id: "pay_online", title: BTN.payOnline },
      { id: "edit_order", title: BTN.edit },
    ];
    await storeOptions(from, buttons);
    await sendButtons(from, buildCodOverLimitReply(total, langOf(from), blocked), buttons);
    return ack();
  }
  return await processConfirmOrder(from, session, "cod");
}

async function showHelpSupport(from: string) {
  const hasActive = await hasActiveOrder(from);
  const options: { id: string; title: string }[] = hasActive
    ? [
        { id: "hs_track", title: BTN.track },
        { id: "hs_call", title: BTN.callUs },
        { id: "hs_complaint", title: BTN.somethingWrong },
      ]
    : [
        { id: "hs_your_orders", title: BTN.yourOrders },
        { id: "hs_call", title: BTN.callUs },
        { id: "hs_complaint", title: BTN.somethingWrong },
      ];
  await storeOptions(from, options);
  await sendButtons(from, helpAndSupportReply(langOf(from)), options);
  return ack();
}

type OrderRow = {
  id: string;
  order_number?: number | null;
  status: string;
  created_at: string;
  total_amount: number | null;
};

async function showTrackOrder(from: string) {
  const lang = langOf(from);
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, order_number, status, created_at, total_amount")
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(10);

  const now = Date.now();
  const active = ((orders || []) as OrderRow[]).filter((o) => {
    if (["delivered", "cancelled", "rejected"].includes(o.status)) return false;
    // Drop stale abandoned-payment orders so the list stays relevant
    if (o.status === "pending_payment" && now - Date.parse(o.created_at) > STALE_PENDING_MS)
      return false;
    return true;
  });

  const buttons = await homeButtons(from);
  await storeOptions(from, buttons);
  await sendButtons(
    from,
    buildActiveOrdersMessage(
      active.map((o) => ({
        ref: shortRef(o.id, o.order_number),
        status: o.status.replace(/_/g, " "),
        amount: o.total_amount != null ? formatInr(o.total_amount) : "—",
      })),
      lang,
    ),
    buttons,
  );
  return ack();
}

async function showOrderHistory(from: string) {
  const lang = langOf(from);
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, order_number, status, created_at, total_amount")
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(8);

  const buttons = [
    { id: "browse_menu", title: BTN.menu },
    { id: "back_home", title: BTN.home },
  ];
  await storeOptions(from, buttons);
  await sendButtons(
    from,
    buildOrderHistoryMessage(
      ((orders || []) as OrderRow[]).map((o) => ({
        ref: shortRef(o.id, o.order_number),
        status: o.status.replace(/_/g, " "),
        amount: o.total_amount != null ? formatInr(o.total_amount) : "—",
        date: new Date(o.created_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
        }),
      })),
      lang,
    ),
    buttons,
  );
  return ack();
}

async function showPaymentsSummary(from: string) {
  const lang = langOf(from);
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, order_number, status, total_amount, created_at")
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(10);

  const buttons = [
    { id: "browse_menu", title: BTN.menu },
    { id: "back_home", title: BTN.home },
  ];
  await storeOptions(from, buttons);
  await sendButtons(
    from,
    buildPaymentsMessage(
      ((orders || []) as OrderRow[]).map((o) => ({
        ref: shortRef(o.id, o.order_number),
        label: o.status === "pending_payment" ? "awaiting payment" : o.status.replace(/_/g, " "),
        amount: o.total_amount != null ? formatInr(o.total_amount) : "—",
      })),
      lang,
    ),
    buttons,
  );
  return ack();
}

function findMenuItemForCatalogPrefix(menu: MenuItem[], prefix: string): MenuItem | undefined {
  const retailer = retailerIdForCsvPrefix(prefix);
  return menu.find((m) => {
    const rid = guessRetailerId(m);
    return rid === retailer || rid === prefix || m.id === retailer || m.id === prefix;
  });
}

/**
 * A cart sent back from the catalog.
 *
 * Meta includes its own prices in this payload and we ignore every one of
 * them: the catalog can be stale, and a price arriving from the client is a
 * price the customer could have changed. Everything is re-priced here.
 */
async function handleCatalogOrder(
  from: string,
  items: CatalogOrderItem[],
) {
  const menu = await getMenu();
  const session = await getSession(from);
  const cart = [...(session.cart || [])];
  let added = 0;
  let overflowed = false;

  for (const raw of items) {
    const parsed = parseCatalogProductId(String(raw.product_retailer_id || ""));
    if (!parsed) {
      console.error(`[WA] catalog id not recognised: ${raw.product_retailer_id}`);
      continue;
    }
    const item = findMenuItemForCatalogPrefix(menu, parsed.prefix);
    if (!item) {
      console.error(`[WA] catalog prefix ${parsed.prefix} matched no menu row`);
      continue;
    }
    const qty = Math.max(1, Math.min(10, Math.floor(Number(raw.quantity) || 1)));
    const unitPrice = unitPriceFor(item, parsed.variant);
    const existingIdx = cart.findIndex((c) => c.menu_item_id === item.id && c.variant === parsed.variant);
    if (cart.length >= WA_CART_MAX && existingIdx < 0) {
      overflowed = true;
      break;
    }
    if (existingIdx >= 0) cart[existingIdx].quantity += qty;
    else {
      cart.push({
        menu_item_id: item.id,
        name: item.name,
        variant: parsed.variant,
        quantity: qty,
        unit_price: unitPrice,
      });
    }
    added += 1;
  }

  if (!added) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return await showFullMenu(from);
  }

  await updateSession(from, {
    cart,
    selected_item_id: null,
    selected_variant: null,
    state: "cart_review",
  });

  if (overflowed) await sendText(from, buildCartLimitMessage(langOf(from)));
  return await showCart(from, cart);
}

async function showQuickReorder(from: string) {
  const snap = await fetchLastOrderSnapshot(from);
  if (!snap) {
    await sendText(from, buildReorderEmptyMessage(langOf(from)));
    return await showFullMenu(from);
  }

  await updateSession(from, {
    cart: snap.cart,
    delivery_address: snap.address,
    delivery_slot_kind: snap.slotKind,
    state: "confirming_last",
  });

  const line = snap.slotKind ? slotLabel(snap.slotKind) : null;
  const buttons = [
    { id: "reuse_last", title: BTN.sameAsLast },
    { id: "change_slot_addr", title: BTN.change },
    { id: "edit_order", title: BTN.editCart },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildReuseLastPrompt(snap.cart, snap.address, line, langOf(from)), buttons);
  return ack();
}

async function quoteCart(
  cart: CartItem[],
  phone: string,
): Promise<{ total: number; offer: { label: string; amount: number } | null; applied: AppliedOffer | null }> {
  const subtotal = cartItemsSubtotal(cart);
  const { applied } = await resolveOfferForCheckout({ subtotal, phone });
  const discount = applied && applied.amount > 0 ? Math.min(subtotal, applied.amount) : 0;
  const total = Math.round(
    computeOrderBreakdownFromItemSubtotal(Math.max(0, subtotal - discount)).computedTotal,
  );
  return {
    total,
    offer: discount > 0 && applied ? { label: applied.label, amount: discount } : null,
    applied: discount > 0 && applied ? applied : null,
  };
}

async function processConfirmOrder(
  from: string,
  session: { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null; delivery_address: string | null },
  paymentMethod: "online" | "cod" = "online",
) {
  const lang = langOf(from);

  if (session.cart.length === 0) {
    await sendText(from, buildCartMessage([], lang));
    return ack();
  }

  const serverDb = createServerSupabase();
  const slotKind = session.delivery_slot_kind;
  if (!session.delivery_date || !slotKind || !isValidSlotKind(slotKind)) {
    await sendText(from, ORDER_CUTOFF_REMINDER);
    return await showDatePicker(from);
  }
  const deliverySlotIso = slotStartIsoFor(session.delivery_date, slotKind);
  if (!isOrderingWindowOpen()) {
    await sendText(from, "Ordering is open 6 AM – 6 PM. Come back when we're open.");
    return ack();
  }
  if (!isSlotBookable(deliverySlotIso)) {
    await sendText(from, ORDER_CUTOFF_REMINDER);
    return await showDatePicker(from);
  }

  const quoted = await quoteCart(session.cart, from);
  const total = quoted.total;
  const applied = quoted.applied;

  if (paymentMethod === "cod") {
    const blocked = await isCodBlocked(serverDb, from).catch(() => false);
    if (blocked || !isCodAllowedForTotal(total)) {
      await sendText(from, buildCodOverLimitReply(total, lang, blocked));
      return await processConfirmOrder(from, session, "online");
    }
  }

  const { data: order, error: orderError } = await serverDb
    .from("orders")
    .insert({
      phone_number: from,
      total_amount: total,
      status: "pending_payment",
      delivery_slot: deliverySlotIso,
      delivery_slot_kind: slotKind,
      delivery_address: session.delivery_address,
      payment_method: paymentMethod,
      payment_status: PaymentStatus.PENDING,
      ...(applied
        ? {
            discount_amount: applied.amount,
            offer_code: applied.code,
            offer_label: applied.label,
          }
        : {}),
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("[WA] Order create error:", orderError?.message);
    await sendText(from, notUnderstoodReply(lang));
    return ack();
  }

  const orderItems = session.cart.map((c) => ({
    order_id: order.id,
    menu_item_id: c.menu_item_id,
    quantity: c.quantity,
    unit_price: c.unit_price,
  }));
  const { error: itemsError } = await serverDb.from("order_items").insert(orderItems);
  if (itemsError) {
    console.error("[WA] Order items insert error:", itemsError.message);
    await serverDb.from("orders").delete().eq("id", order.id);
    await sendText(from, "That order didn't save. Reply with it again and we'll try once more.");
    return ack();
  }

  if (applied) {
    await redeemOffer(serverDb, applied, order.id, from);
  }

  const ref = shortRef(order.id, order.order_number);

  if (paymentMethod === "cod") {
    const marked = await markOrderPaidAndNotify(serverDb, order.id, null);
    if (!marked.ok) {
      console.error("[WA] COD mark paid failed:", marked.error);
      await releaseOffer(serverDb, order.id);
      await serverDb.from("order_items").delete().eq("order_id", order.id);
      await serverDb.from("orders").delete().eq("id", order.id);
      await sendText(
        from,
        "The kitchen didn't get this order, so nothing was placed. Reply with the same order and we'll try again.",
      );
      return ack();
    }
    await resetSession(from);
    await sendText(from, buildCodPlacedMessage(ref, formatInr(total), lang));
    return ack();
  }

  try {
    const { short_url, id: paymentLinkId } = await createPaymentLink(total, order.id, "WhatsApp Customer", from);
    if (paymentLinkId) {
      await serverDb.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", order.id);
    }
    await sendCtaUrl(from, buildPaymentMessage(total, short_url, lang), short_url, BTN.payNow);
    await sendText(from, buildOrderIdPendingPaymentMessage(ref, lang));
  } catch (e) {
    console.error("[WA] payment link failed:", e);
    await releaseOffer(serverDb, order.id);
    await serverDb.from("order_items").delete().eq("order_id", order.id);
    await serverDb.from("orders").delete().eq("id", order.id);
    await sendText(from, "The payment link didn't go out, so this order wasn't placed. Reply with it again.");
    return ack();
  }

  await resetSession(from);
  return ack();
}

const STALE_PENDING_MS = 24 * 60 * 60 * 1000; // 24 hours

async function hasActiveOrder(phone: string): Promise<boolean> {
  try {
    const db = createServerSupabase();
    const { data, error } = await db
      .from("orders")
      .select("id, status, created_at")
      .in("phone_number", phoneVariants(phone))
      .limit(40);
    if (error) return false;
    const now = Date.now();
    return ((data || []) as { id: string; status: string; created_at: string }[]).some((o) => {
      if (["delivered", "cancelled", "rejected"].includes(o.status)) return false;
      // pending_payment older than 24 h = abandoned; don't count as active
      if (o.status === "pending_payment" && now - Date.parse(o.created_at) > STALE_PENDING_MS)
        return false;
      return true;
    });
  } catch {
    return false;
  }
}

async function hasOrders(phone: string): Promise<boolean> {
  try {
    const db = createServerSupabase();
    const { data, error } = await db
      .from("orders")
      .select("id")
      .in("phone_number", phoneVariants(phone))
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && challenge && expected && token === expected) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return new Response("WhatsApp webhook — Vidya's Kitchen", { status: 200 });
}
