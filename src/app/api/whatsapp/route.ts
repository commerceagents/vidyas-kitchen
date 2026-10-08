import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, after } from "next/server";
import { VidyaAgent, type MenuItem, type Message } from "@/lib/ai/agent";
import { kitchenCallPageUrl, publicSiteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { decodeOrderRatingButtonId } from "@/lib/whatsapp-order-notify";
import { saveOrderRatingByPhone, saveOrderRatingCommentByPhone } from "@/lib/order-rating";
import {
  readStaleOrderContext,
  staleNoticeAlreadySent,
  turnsWithStaleOrder,
} from "@/lib/whatsapp-stale-order";
import { createPaymentLink } from "@/lib/payments";
import {
  istCalendarYmd,
  istAddCalendarDays,
  istWeekdayIndex,
  slotStartIsoFor,
  isSlotBookable,
  isValidSlotKind,
  isOrderingWindowOpen,
  formatSlotLineForCustomer,
  slotWindowEnded,
  bookableSlotSections,
  DELIVERY_SLOT_DEFS,
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import {
  sendText,
  sendButtons,
  sendCtaUrl,
  sendList,
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
import { cartGrandTotal, cartItemsSubtotal, getCartSummary, type CartItem } from "@/lib/whatsapp-cart";
import {
  BTN,
  buildUsualChangeMessage,
  buildUsualListBody,
  buildUsualPayNote,
  buildUsualTeaseLine,
  buildVoiceNoteFallback,
  buildWelcomeMessage,
  conversationalRoll,
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
  buildPaymentAsk,
  buildProposalAskMessage,
  buildProposalExpiredMessage,
  buildRatingCommentPrompt,
  buildActiveOrdersMessage,
  buildOrderHistoryMessage,
  buildPaymentsMessage,
  buildOpenAppBody,
  buildPwaPromoBody,
  buildCodPlacedMessage,
  buildDishChoicePrompt,
  buildMoreDaysBody,
  buildSlotListBody,
  dishPickedAside,
  complaintPrompt,
  complaintReceivedReply,
  complaintPickOrdersReply,
  complaintPickItemReply,
  complaintAboutReply,
  escalateHumanReply,
  interruptCancelledMessage,
  interruptClarifyMessage,
  interruptMenuAside,
  buildCurrentOrdersMessage,
  interruptStillOpenMessage,
  olderOrderAskReply,
  olderOrderArrivedReply,
  olderOrderButtons,
  type OlderOrderKind,
  helpAndSupportReply,
  HELP_LIST_ROWS,
  buildRefundAnswer,
  buildCancelPolicyAnswer,
  buildCancelClosedAnswer,
  buildCancelConfirmAsk,
  buildCancelDoneAnswer,
  buildNothingToCancelAnswer,
  buildDriverAnswer,
  buildOfferAnswer,
  buildAddressOnFileAnswer,
  buildBestSellerAnswer,
  buildSpicyAnswer,
  buildBotAnswer,
  buildPresenceAnswer,
  buildResubscribeAnswer,
  callUsDialReply,
  type KitchenCallOrder,
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
import { choiceButtonTitle, formatFullDishName } from "@/lib/dish-name";
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
import { computeOrderBreakdownFromItemSubtotal, type OrderFeeOptions } from "@/lib/order-pricing";
import { loadDeliveryPromoSettings } from "@/lib/delivery-promo";
import { allMenuDishes, KITCHEN_PICK_DISH_IDS } from "@/lib/menu/best-selling";
import { redeemOffer, releaseOffer, resolveOfferForCheckout } from "@/lib/offers-server";
import type { AppliedOffer } from "@/lib/offers";
import { isCodBlocked, markOrderPaidAndNotify, transitionOrderStatusInDb } from "@/lib/order-transition";
import { OrderStatus, PaymentStatus, formatOrderRef } from "@/lib/order-status";
import { supportOrderNumber, supportTopic } from "@/lib/whatsapp-support";
import { resolveOrderItemWeight } from "@/lib/menu/order-item-weight";
import {
  buildComplaintRecord,
  complaintDishLine,
  complaintItemRows,
  complaintOrderRow,
  complaintWriteAction,
  parseComplaintAction,
  matchComplaintItemIndex,
  matchComplaintOrderFromText,
  parseComplaintChoice,
  looksLikeFoodOrder,
  looksLikeNewOrder,
  prefersConversationalPath,
  shouldStoreComplaint,
  type ComplaintItem,
} from "@/lib/whatsapp-complaint";
import { loadActiveFestival } from "@/lib/menu/festival-dishes";
import { hasAppInstalledSignal } from "@/lib/whatsapp-app-signal";
import { logWhatsAppMessage, type WaMessageKind } from "@/lib/whatsapp-message-log";
import { unitPriceFor, packPricesFor, packPriceLine, formatInr, allDishPricing, dishPricingForRetailerId, pickCanonicalRows, type DishPricing, type PackSize } from "@/lib/menu/dish-pricing";
import {
  applyFastLaneDefaults,
  applySpokenCheckout,
  applySpokenDate,
  applySpokenFamily,
  applySpokenSize,
  buildProposal,
  dishChoiceQuery,
  dishQueryCategory,
  filterDishChoicesByIdentifyingWords,
  fillDraftFromReply,
  notedDeliveryDate,
  isProposalStillValid,
  listDraftGaps,
  looksLikeCompoundOrder,
  parseDateText,
  parseHour,
  parsePackSize,
  parsePackQuantities,
  parsePaymentMethod,
  parseSpokenQuantity,
  parseSlotWord,
  repriceProposal,
  slotKindForHour,
  type OrderProposal,
  type ProposalDraft,
} from "@/lib/ai/order-proposal";
import { resolveCartIntent } from "@/lib/ai/cart-intent";
import { phraseReply } from "@/lib/ai/phrase-reply";
import { transcribeWhatsAppAudio } from "@/lib/whatsapp-voice";
import { closeDishChoices } from "@/lib/menu/embeddings";
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
  asksForMenu,
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
  whatsappCatalogId,
  catalogPackDrawers,
} from "@/lib/whatsapp-catalog";
import {
  dishPickerFromMenuRow,
  dishPickerFromPricing,
  sendDishPicker,
} from "@/lib/whatsapp-dish-picker";

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
      const current = istWeekdayIndex();
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

type ComplaintOrder = {
  id: string;
  ref: string;
  meal: string;
  day: string;
  when: string;
  items: ComplaintItem[];
};

async function readComplaintAction(from: string): Promise<string | null> {
  const { data, error } = await createServerSupabase()
    .from("users")
    .select("whatsapp_pending_action")
    .in("phone_number", phoneVariants(from));
  if (error) {
    console.error("[WA] complaint arm", error);
    return null;
  }
  for (const row of data || []) {
    const action = String((row as { whatsapp_pending_action?: string | null }).whatsapp_pending_action || "");
    if (parseComplaintAction(action)) return action;
  }
  return null;
}

async function setComplaintAction(from: string, action: string | null) {
  const db = createServerSupabase();
  const { error } = await db
    .from("users")
    .update({ whatsapp_pending_action: action })
    .in("phone_number", phoneVariants(from))
    .like("whatsapp_pending_action", "complaint%");
  if (error) console.error("[WA] complaint pending_action failed:", error);
  if (!action) return;
  const { error: upsertError } = await db
    .from("users")
    .upsert({ phone_number: from, whatsapp_pending_action: action }, { onConflict: "phone_number" });
  if (upsertError) console.error("[WA] complaint pending_action upsert failed:", upsertError);
}

async function clearComplaintArm(from: string) {
  await setComplaintAction(from, null);
}

function complaintWhen(row: OrderDetailRow): { meal: string; day: string; when: string } {
  const kind = String(row.delivery_slot_kind || "").toLowerCase();
  const meal = kind === "breakfast" || kind === "lunch" || kind === "dinner" ? kind[0].toUpperCase() + kind.slice(1) : "";
  const source = row.delivery_slot || row.created_at;
  const date = source ? new Date(source) : null;
  const day =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
      : "";
  return { meal, day, when: [meal, day].filter(Boolean).join(" · ") };
}

function complaintItemsOf(row: OrderDetailRow): ComplaintItem[] {
  return (Array.isArray(row.order_items) ? row.order_items : []).flatMap((item) => {
    const name = joinedDishName(item);
    if (!name) return [];
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unit = Number(item.unit_price);
    const weight = resolveOrderItemWeight({
      name,
      unitPrice: Number.isFinite(unit) ? unit : 0,
      menuItemId: item.menu_item_id,
    });
    return [{ name, weight, qty }];
  });
}

function toComplaintOrder(row: OrderDetailRow): ComplaintOrder {
  const when = complaintWhen(row);
  return {
    id: row.id,
    ref: formatOrderRef(row.order_number, row.id),
    meal: when.meal,
    day: when.day,
    when: when.when,
    items: complaintItemsOf(row),
  };
}

async function loadComplaintOrders(from: string): Promise<ComplaintOrder[]> {
  const { data, error } = await createServerSupabase()
    .from("orders")
    .select(
      "id, order_number, status, delivery_slot, delivery_slot_kind, created_at, order_items(quantity, unit_price, menu_item_id, menu_items(name))",
    )
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    console.error("[WA] complaint orders", error);
    return [];
  }
  return ((data || []) as OrderDetailRow[])
    .filter((row) => row.status && !["cancelled", "rejected"].includes(String(row.status)))
    .slice(0, 8)
    .map(toComplaintOrder);
}

async function loadComplaintOrder(from: string, orderId: string): Promise<ComplaintOrder | null> {
  const { data, error } = await createServerSupabase()
    .from("orders")
    .select(
      "id, order_number, status, phone_number, delivery_slot, delivery_slot_kind, created_at, order_items(quantity, unit_price, menu_item_id, menu_items(name))",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[WA] complaint order", error);
    return null;
  }
  const row = data as OrderDetailRow & { phone_number?: string | null };
  const owned = phoneVariants(from).includes(String(row.phone_number || ""));
  const last10 = from.replace(/\D/g, "").slice(-10);
  const rowLast10 = String(row.phone_number || "").replace(/\D/g, "").slice(-10);
  if (!owned && last10 !== rowLast10) return null;
  return toComplaintOrder(row);
}

function complaintTargetItems(order: ComplaintOrder, itemIndex: number | "all" | null): ComplaintItem[] {
  if (itemIndex === "all" || itemIndex == null) return order.items;
  const one = order.items[itemIndex];
  return one ? [one] : order.items;
}

function readComplaintDraft(turns: WhatsAppSession["recent_turns"]): string | null {
  const raw = [...(turns || [])].reverse().find((turn) => turn.content.startsWith(VK_COMPLAINT_NOTE_PREFIX));
  const note = raw?.content.slice(VK_COMPLAINT_NOTE_PREFIX.length).trim() || "";
  return note || null;
}

async function fileComplaint(
  from: string,
  order: ComplaintOrder | null,
  itemIndex: number | "all" | null,
  note: string,
) {
  const items = order ? complaintTargetItems(order, itemIndex) : [];
  const body = order
    ? buildComplaintRecord({ ref: order.ref, when: order.when, items }, note)
    : note.trim().slice(0, 2000);
  const detail = order ? [order.ref, complaintDishLine(items)].filter(Boolean).join(", ") : "";
  const { error } = await createServerSupabase().from("customer_complaints").insert({
    phone_number: from,
    body,
  });
  if (error) {
    console.error("[WA] save complaint", error);
    await sendText(
      from,
      "I heard you, and I couldn't file that just now. Please send it once more, or call the kitchen.",
    );
    return ack();
  }
  await clearComplaintArm(from);
  const session = await getSession(from);
  await updateSession(from, {
    state: "idle",
    pending_options: null,
    selected_item_id: null,
    selected_variant: null,
    recent_turns: (session.recent_turns || []).filter((turn) => !turn.content.startsWith(VK_COMPLAINT_NOTE_PREFIX)),
  });
  await sendText(from, complaintReceivedReply(detail || undefined, langOf(from)));
  return ack();
}

async function askComplaintNote(from: string, order: ComplaintOrder, itemIndex: number | "all") {
  const session = await getSession(from);
  const draft = readComplaintDraft(session.recent_turns);
  const items = complaintTargetItems(order, itemIndex);
  const index = items.length === order.items.length ? "all" : itemIndex;
  if (draft) return await fileComplaint(from, order, index, draft);
  await setComplaintAction(from, complaintWriteAction(order.id, index));
  await updateSession(from, {
    state: "ai_chat",
    pending_options: null,
    selected_item_id: null,
    selected_variant: null,
  });
  await sendText(
    from,
    complaintAboutReply({
      ref: order.ref,
      when: order.when,
      dishes: complaintDishLine(items),
    }),
  );
  return ack();
}

async function showComplaintOrders(from: string, orders: ComplaintOrder[]) {
  const rows = orders.map((order) => complaintOrderRow(order));
  await setComplaintAction(from, "complaint_pick");
  await updateSession(from, {
    state: "ai_chat",
    pending_options: null,
    selected_item_id: null,
    selected_variant: null,
  });
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  await sendList(from, complaintPickOrdersReply(langOf(from)), "Which order", [{ title: "Orders", rows }]);
  return ack();
}

async function showComplaintItems(from: string, order: ComplaintOrder) {
  const rows = complaintItemRows(order);
  await setComplaintAction(from, `complaint_item:${order.id}`);
  await updateSession(from, { state: "ai_chat", selected_item_id: null, selected_variant: null });
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  await sendList(from, complaintPickItemReply(order.ref, langOf(from)), "Which dish", [{ title: "Dishes", rows }]);
  return ack();
}

async function focusComplaintOrder(from: string, order: ComplaintOrder) {
  if (order.items.length > 1) return await showComplaintItems(from, order);
  return await askComplaintNote(from, order, order.items.length === 1 ? 0 : "all");
}

async function confirmStaleArrived(from: string) {
  const session = await getSession(from);
  const ctx = readStaleOrderContext(session.recent_turns);
  if (ctx?.orderId) {
    const result = await transitionOrderStatusInDb(createServerSupabase(), ctx.orderId, OrderStatus.DELIVERED, {
      notifyCustomer: false,
    });
    if (!result.ok) {
      console.error("[WA] stale arrived could not mark delivered", ctx.orderId, result.error);
    }
  }
  await sendText(from, olderOrderArrivedReply());
  return ack();
}

async function beginStaleComplaint(from: string) {
  const session = await getSession(from);
  const ctx = readStaleOrderContext(session.recent_turns);
  if (ctx?.orderId) {
    const order = await loadComplaintOrder(from, ctx.orderId);
    if (order) return await askComplaintNote(from, order, "all");
  }
  return await beginComplaint(from);
}

async function beginComplaint(from: string) {
  const orders = await loadComplaintOrders(from);
  if (orders.length === 0) {
    await setComplaintAction(from, "complaint");
    await updateSession(from, {
      state: "ai_chat",
      pending_options: null,
      selected_item_id: null,
      selected_variant: null,
    });
    await sendText(from, complaintPrompt(langOf(from)));
    return ack();
  }
  return await showComplaintOrders(from, orders);
}

async function applyComplaintChoice(from: string, choice: NonNullable<ReturnType<typeof parseComplaintChoice>>) {
  const order = await loadComplaintOrder(from, choice.orderId);
  if (!order) {
    await sendText(from, "I couldn't match that to one of your orders. Pick it from the list once more.");
    return await beginComplaint(from);
  }
  if (choice.kind === "order") return await focusComplaintOrder(from, order);
  if (choice.kind === "all") return await askComplaintNote(from, order, "all");
  return await askComplaintNote(from, order, choice.itemIndex);
}

/**
 * The next free-text line after "Something wrong" is the complaint. A dish
 * name in that line must not reopen the menu. A list of orders has to be
 * tapped first, so a typed line is not filed against the wrong ticket.
 */
async function captureArmedComplaint(from: string, text: string): Promise<Response | null> {
  const action = await readComplaintAction(from);
  const phase = parseComplaintAction(action);
  if (!phase) return null;
  if (!shouldStoreComplaint(text)) {
    await clearComplaintArm(from);
    return null;
  }
  if (phase.phase === "pick") {
    const orders = await loadComplaintOrders(from);
    if (orders.length === 0) return await beginComplaint(from);
    const matched = matchComplaintOrderFromText(text, orders);
    if (matched) return await focusComplaintOrder(from, matched);
    return await showComplaintOrders(from, orders);
  }
  if (phase.phase === "item") {
    const order = await loadComplaintOrder(from, phase.orderId);
    if (!order) return await beginComplaint(from);
    const itemPick = matchComplaintItemIndex(text, order.items);
    if (itemPick != null) return await askComplaintNote(from, order, itemPick);
    return await showComplaintItems(from, order);
  }

  const note = text.trim().slice(0, 2000);
  if (!phase.orderId) {
    const orders = await loadComplaintOrders(from);
    if (orders.length > 0) {
      const session = await getSession(from);
      const turns = [
        ...(session.recent_turns || []).filter((turn) => !turn.content.startsWith(VK_COMPLAINT_NOTE_PREFIX)),
        { role: "user" as const, content: `${VK_COMPLAINT_NOTE_PREFIX}${note}` },
      ].slice(-16);
      await updateSession(from, { recent_turns: turns });
      return await showComplaintOrders(from, orders);
    }
  }
  const order = phase.orderId ? await loadComplaintOrder(from, phase.orderId) : null;
  return await fileComplaint(from, order, phase.itemIndex, note);
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

type OrderItemJoin = {
  quantity?: number | null;
  unit_price?: number | null;
  menu_item_id?: string | null;
  menu_items?: { name?: string | null } | { name?: string | null }[] | null;
};

type OrderDetailRow = {
  id: string;
  order_number?: number | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  delivery_address?: string | null;
  created_at?: string | null;
  order_items?: OrderItemJoin[] | null;
};

function joinedDishName(item: OrderItemJoin): string {
  const menu = item.menu_items;
  const raw = Array.isArray(menu) ? menu[0]?.name : menu?.name;
  return formatFullDishName(String(raw || "")).trim();
}

function paymentPhrase(method: string | null | undefined, paymentStatus: string | null | undefined): string {
  const m = String(method || "").toLowerCase();
  const p = String(paymentStatus || "").toLowerCase();
  if (m === "cod" || m === "cash") return p === "paid" ? "Cash, collected" : "Cash on delivery";
  if (m === "online") return p === "paid" ? "Paid online" : "Pay online";
  if (p === "paid") return "Paid";
  if (p === "pending") return "Payment still open";
  return "";
}

async function currentOrderCards(from: string) {
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select(
      "id, order_number, status, payment_method, payment_status, total_amount, delivery_slot, delivery_slot_kind, delivery_address, created_at, order_items(quantity, unit_price, menu_items(name))",
    )
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(5);

  return ((orders || []) as OrderDetailRow[])
    .filter((row) => row.status && !["cancelled", "rejected"].includes(row.status))
    .slice(0, 3)
    .map((row) => {
      const items = (Array.isArray(row.order_items) ? row.order_items : []).flatMap((item) => {
        const name = joinedDishName(item);
        if (!name) return [];
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unit = Number(item.unit_price);
        const line = Number.isFinite(unit) && unit > 0 ? formatInr(unit * qty) : "";
        return [{ name, qty, line }];
      });
      const when =
        formatSlotLineForCustomer(row.delivery_slot, row.delivery_slot_kind) ||
        (row.created_at
          ? `Placed ${new Date(row.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}`
          : "");
      return {
        ref: formatOrderRef(row.order_number, row.id),
        status: STATUS_DETAIL[row.status || ""] || String(row.status || "").replace(/_/g, " "),
        payment: paymentPhrase(row.payment_method, row.payment_status),
        total: row.total_amount != null ? formatInr(Number(row.total_amount)) : "",
        when,
        address: String(row.delivery_address || "").trim(),
        items,
      };
    });
}

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
    const session = await getSession(from);
    if (!staleNoticeAlreadySent(session.recent_turns, row.id, olderKind)) {
      const buttons = olderOrderButtons(olderKind);
      await updateSession(from, {
        pending_options: buttons,
        recent_turns: turnsWithStaleOrder(session.recent_turns, row.id, olderKind),
      });
      await storeOptions(from, buttons);
      await sendButtons(from, olderOrderAskReply(ref, slotLine, olderKind), buttons);
    }
    return ack();
  }

  const statusPhrase = STATUS_DETAIL[row.status] ?? `status: ${row.status.replace(/_/g, " ")}`;
  const slotSuffix = slotLine ? `\n\nDelivery: ${slotLine}` : "";

  const body = `*Order #${ref}* is ${statusPhrase}${slotSuffix}\n\nTap below to follow it live or share your location with the driver.`;
  await sendCtaUrl(from, body, `${trackBase}${row.id}`, BTN.track);
  return ack();
}

const VK_DRAFT_PREFIX = "__vk_draft__:";
const VK_COMPLAINT_NOTE_PREFIX = "__vk_complaint__:";
const VK_USUAL_PAY_PREFIX = "__vk_usual_pay__:";

function isHiddenTurn(content: string): boolean {
  return (
    content.startsWith(VK_DRAFT_PREFIX) ||
    content.startsWith(VK_COMPLAINT_NOTE_PREFIX) ||
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

function lastAssistantText(turns: WhatsAppSession["recent_turns"]): string | null {
  const chat = chatTurns(turns);
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i].role === "assistant" && chat[i].content.trim()) return chat[i].content;
  }
  return null;
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

/** Draft hidden turns are stripped before save; rebuild from the priced proposal when needed. */
function proposalDraftFromSession(session: WhatsAppSession): ProposalDraft | null {
  const stored = readStoredDraft(session.recent_turns);
  if (stored) return stored;
  const proposal = session.proposal;
  if (!proposal) return null;
  return {
    items: proposal.cart.map((item) => ({
      dish: item.name,
      size: item.variant,
      quantity: item.quantity,
    })),
    date: proposal.deliveryDate,
    slot: proposal.slotKind,
    address: proposal.address,
    payment: proposal.paymentMethod === "cod" ? "cash" : "online",
  };
}

/** Open conversational order draft — cart checkout uses the session cart instead. */
function readOpenDraft(session: WhatsAppSession): ProposalDraft | null {
  if (session.cart.length > 0) return null;
  return readStoredDraft(session.recent_turns) ?? proposalDraftFromSession(session);
}

async function continueDraftOrder(
  from: string,
  draft: ProposalDraft,
  sourceText?: string | null,
): Promise<Response> {
  await updateSession(from, { state: "ai_chat" });
  return await presentProposal(from, draft, sourceText);
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
  /^(add_|addmore_|szsec_|sz500_|sz1kg_|var_|book_|cat_|qty_|rm_|uq_|date_|slot_|stale_|order_|lang_|hs_|browse_|view_|track_|help_|quick_|reuse_|change_|new_|clear_|checkout|confirm_|cancel_|pay_|edit_|back_|open_|install_|change_proposal_)/;

function isBotReplyId(value: string): boolean {
  const id = String(value || "").trim();
  if (!id) return false;
  if (BOT_REPLY_ID.test(id)) return true;
  // Carousel quick replies carry menu-item UUIDs from semantic search.
  return /^[0-9a-f-]{36}$/i.test(id);
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
function pendingDishListRow(option: { id: string; title: string }, menu: MenuItem[]) {
  if (option.id.startsWith("add_")) {
    const pricing = dishPricingForRetailerId(option.id.slice(4));
    const name = pricing ? formatFullDishName(pricing.name) : option.title;
    return {
      id: option.id,
      title: name.slice(0, 24),
      description: pricing
        ? `500gm ${formatInr(pricing.prices["500gm"])} · 1kg ${formatInr(pricing.prices["1kg"])}`.slice(0, 72)
        : undefined,
    };
  }
  const item = menu.find((row) => row.id === option.id);
  const pricing = item ? dishPricingForRetailerId(item.retailer_id || "") : null;
  const name = item ? formatFullDishName(item.name) : option.title;
  return {
    id: option.id,
    title: name.slice(0, 24),
    description: pricing
      ? `500gm ${formatInr(pricing.prices["500gm"])} · 1kg ${formatInr(pricing.prices["1kg"])}`.slice(0, 72)
      : undefined,
  };
}

async function replyUnreadableTap(from: string): Promise<void> {
  const session = await getSession(from);
  const dishes = session.pending_options || [];
  if (dishes.length > 0) {
    const menu = await getMenu();
    await sendList(
      from,
      "Oops — that tap stayed on your phone and never reached the kitchen. Pick the dish here, and I'll ask 500gm or 1kg.",
      "Pick a dish",
      [{ title: "On the cards", rows: dishes.slice(0, 10).map((option) => pendingDishListRow(option, menu)) }],
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
        } else if (message && (message.type === "audio" || message.type === "voice")) {
          from = fromMetaWebhook(message.from);
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          const mediaId =
            (message.audio as { id?: string } | undefined)?.id ||
            (message.voice as { id?: string } | undefined)?.id ||
            "";
          const transcribed = mediaId ? await transcribeWhatsAppAudio(mediaId) : null;
          if (transcribed) {
            body = transcribed;
            inboundKind = "text";
            console.log(`[Meta WA Voice] From=${from} Text="${transcribed.slice(0, 120)}"`);
          } else {
            inboundKind = "media";
            body = "[voice note]";
            await logWhatsAppMessage({
              phone: from,
              direction: "in",
              kind: inboundKind,
              body,
              payload: { type: message.type, profileName: profileName || undefined },
              provider: "meta",
              waMessageId: messageId || null,
            });
            await sendText(from, buildVoiceNoteFallback(langOf(from)));
            return ack();
          }
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

    if (
      !interactiveReplyId &&
      /^(choose size|select|add)$/i.test(text) &&
      (session.pending_options?.length || 0) > 0
    ) {
      const pending = session.pending_options!;
      if (pending.length === 1) {
        return await handleResolvedId(from, pending[0].id, session, profileName);
      }
      await replyUnreadableTap(from);
      return ack();
    }

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
      if (session.state === "ai_chat") await clearComplaintArm(from);
      const handled = await handleResolvedId(from, interactiveReplyId, session, profileName);
      if (handled) return handled;
    }

    if (resolvedId) {
      const handled = await handleResolvedId(from, resolvedId, session, profileName);
      if (handled) return handled;
    }

    if (!interactiveReplyId && !resolvedId) {
      if (session.state === "ai_chat") {
        const filed = await captureArmedComplaint(from, text);
        if (filed) return filed;
      }
      const supported = await answerSupport(from, text, session, profileName);
      if (supported) return supported;
    }

    if (isPendingState(session.state) && !interactiveReplyId && !resolvedId) {
      const diverted = await handleInterrupt(from, text, session, profileName);
      if (diverted) return diverted;
    }

    // Structured taps beat the conversational lane — "menu" and "track my order"
    // must not fall through to the AI cart path.
    if (!interactiveReplyId && !resolvedId) {
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
        return await showCallKitchen(from);
      }
      if (isAppCmd) {
        return await showInstallApp(from, profileName);
      }
      if (asksForMenu(text)) {
        await updateSession(from, { state: "browsing_category", proposal: null });
        return await showFullMenu(from);
      }
      if (classifyTurn(text, session.state).intent === "complaint") {
        return await beginComplaint(from);
      }
    }

    if (
      !interactiveReplyId &&
      !resolvedId &&
      prefersConversationalPath(text) &&
      (session.state === "idle" || session.state === "browsing_category" || session.state === "ai_chat")
    ) {
      await updateSession(from, { state: "ai_chat" });
      return await handleAiChat(from, text, profileName);
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

      case "picking_proposal_address":
        return await handlePickingProposalAddress(from, text, session);

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
  const complaintChoice = parseComplaintChoice(id);
  if (complaintChoice) return await applyComplaintChoice(from, complaintChoice);
  if (id.startsWith("date_")) {
    return await applyDeliveryDate(from, id.replace(/^date_/, ""));
  }
  const moreDays = id.match(/^slots_after_(\d{4}-\d{2}-\d{2})$/);
  if (moreDays) return await showBookableSlots(from, null, moreDays[1]);
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
  if (id.startsWith("hscancel_")) {
    return await confirmSupportCancel(from, id.slice("hscancel_".length));
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
    case "addr_map": {
      const fresh = await getSession(from);
      if (fresh.state === "picking_proposal_address") return await askForProposalMapPin(from);
      return await askForMapPin(from);
    }
    case "confirm_proposal":
      return await confirmProposal(from, session);
    case "change_proposal_address":
      return await askForProposalAddress(from);
    case "cancel_proposal":
      await updateSession(from, { proposal: null, state: "idle" });
      return await showFullMenu(from);
    case "confirm_order":
      return await payFromDraftOrCart(from, session, "online");
    case "pay_online": {
      const open = readOpenDraft(session);
      if (open) return await continueDraftOrder(from, { ...open, payment: "online" });
      return await payFromDraftOrCart(from, session, "online");
    }
    case "pay_cod": {
      const open = readOpenDraft(session);
      if (open) return await continueDraftOrder(from, { ...open, payment: "cash" });
      return await payFromDraftOrCart(from, session, "cod");
    }
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
      return await showCallKitchen(from);
    case "hs_refund":
      return await showRefundAnswer(from);
    case "hs_cancel":
      return await showCancelChoice(from, "");
    case "hs_complaint":
      return await beginComplaint(from);
    case "hs_your_orders":
      return await showOrderHistory(from);
    case "hs_payments":
      return await showPaymentsSummary(from);
    case "stale_issue":
      return await beginComplaint(from);
    case "stale_missing":
      return await beginStaleComplaint(from);
    case "stale_latest":
      return await showTrackOrder(from);
    case "stale_again":
      return await showQuickReorder(from);
    case "stale_arrived":
      return await confirmStaleArrived(from);
    case "stale_call":
      return await showCallKitchen(from);
    case "rating_skip":
      await updateSession(from, { state: "idle", rating_order_id: null });
      await sendText(from, ratingThanksReply(langOf(from)));
      return ack();
    default: {
      const menu = await getMenu();
      const item = menu.find((m) => m.id === id);
      if (item && (session.state === "picking_item" || readStoredDraft(session.recent_turns))) {
        return await continuePickedDish(from, session, item);
      }
      if (item) return await showVariantPicker(from, item);
      return null;
    }
  }
}

async function handleIdle(from: string, text: string, session: { cart: CartItem[] }, profileName: string) {
  const menu = await getMenu();
  const matched = findItemByName(menu, text);

  if (matched && !looksLikeCompoundOrder(text) && session.cart.length === 0) {
    await updateSession(from, { state: "ai_chat", selected_item_id: matched.id });
    return await continuePickedDish(from, await getSession(from), matched);
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

/** Fast lane: dish picked → size (if needed) → confirm card. Qty defaults to 1. */
async function showFastSizePicker(from: string, item: MenuItem) {
  const lang = langOf(from);
  const prices = packPricesFor(item);
  const buttons = [
    { id: "var_500gm", title: BTN.size500 },
    { id: "var_1kg", title: BTN.size1kg },
  ];
  await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildVariantMessage(formatFullDishName(item.name), prices, lang), buttons);
  return ack();
}

async function continuePickedDish(from: string, session: WhatsAppSession, item: MenuItem) {
  const draft = readOpenDraft(session);
  const size =
    parsePackSize(String(draft?.items?.[0]?.size || "")) ||
    parsePackSize(String(draft?.items?.[0]?.dish || ""));

  if (size) {
    await sendText(from, dishPickedAside(item.name, lastAssistantText(session.recent_turns)));
    const next: ProposalDraft = {
      ...(draft || {}),
      items: [
        {
          dish: item.name,
          size,
          quantity: Math.max(1, Math.floor(Number(draft?.items?.[0]?.quantity) || 1)),
        },
      ],
    };
    await updateSession(from, { selected_item_id: item.id, state: "ai_chat" });
    return await continueDraftOrder(from, next);
  }

  await sendText(from, dishPickedAside(item.name, lastAssistantText(session.recent_turns)));
  return await showFastSizePicker(from, item);
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
  const stored = session.cart.length === 0 ? readStoredDraft(session.recent_turns) : null;
  // "1 500gm" during checkout stays on this order. Passing the typed line back
  // in would look like a fresh "chicken gravy" request and show the dish list again.
  if (packs.length > 0 && session.selected_item_id && stored) {
    const menu = await getMenu();
    const item = menu.find((row) => row.id === session.selected_item_id);
    if (item) {
      const draft: ProposalDraft = {
        ...stored,
        items: packs.map((pack) => ({
          dish: item.name,
          size: pack.size,
          quantity: pack.quantity,
        })),
      };
      return await presentProposal(from, draft);
    }
  }
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

async function removeMatchedLine(from: string, menuItemId: string, variant: string, said?: string) {
  const session = await getSession(from);
  const hit = session.cart.find((line) => line.menu_item_id === menuItemId && line.variant === variant);
  if (!hit) {
    await sendText(from, buildNotInCartMessage());
    return await showCart(from, session.cart);
  }
  const next = removeLines(session.cart, [hit]);
  await dropCartDraft(from, session, next);
  const spoken = await phraseReply({
    cart: getCartSummary(next),
    matchedDish: null,
    conversationState: "cart_review",
    customerMessage: said || "remove",
    removed: [{ name: hit.name, variant: hit.variant, qty: hit.quantity }],
  });
  await sendText(from, spoken || buildLineRemovedMessage(hit.name, hit.variant));
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
      if (target?.kind === "rm") return await removeMatchedLine(from, target.menuId, target.variant, text);
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
    return await removeMatchedLine(from, match.hits[0].menu_item_id, match.hits[0].variant, text);
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
  const updated: { name: string; variant: string; qty: number }[] = [];
  if (plan.keep) {
    const keepLine = next.find(
      (line) => line.menu_item_id === hit.menu_item_id && parsePackSize(line.variant) === plan.keep?.size,
    );
    if (keepLine) {
      next = setLineQty(next, keepLine, plan.keep.quantity);
      updated.push({ name: keepLine.name, variant: keepLine.variant, qty: plan.keep.quantity });
    }
  }
  const removedLine = await phraseReply({
    cart: getCartSummary(next),
    matchedDish: null,
    conversationState: "cart_review",
    customerMessage: plan.itemReference || "remove",
    removed: [{ name: hit.name, variant: hit.variant, qty: hit.quantity }],
    updated,
  });
  const notes = [removedLine || buildLineRemovedMessage(hit.name, hit.variant)];
  if (!removedLine) {
    for (const line of updated) notes.push(buildLineUpdatedMessage(line.name, line.variant, line.qty));
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
    case "picking_proposal_address":
      return "Which saved address should we use?";
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
    case "picking_item":
      return "Which dish?";
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

  if (session.state === "picking_item") {
    const menu = await getMenu();
    const trimmed = text.trim();
    const asNumber = /^([1-9]|10)$/.test(trimmed);
    const named = !asNumber && findItemByName(menu, trimmed);
    if (asNumber || named) {
      await rememberInterrupt(from, session, 0);
      return null;
    }
    const spoken = notedDeliveryDate({}, text);
    const slot = parseSlotWord(text);
    const short = trimmed.split(/\s+/).filter(Boolean).length <= 6;
    if (short && (spoken || slot) && !dishQueryCategory(text) && !named) {
      const stored = readStoredDraft(session.recent_turns) || {};
      const next: ProposalDraft = { ...stored };
      if (spoken) next.date = spoken;
      if (slot) next.slot = slot;
      await rememberInterrupt(from, session, 0);
      return await presentProposal(from, next, text);
    }
  }

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
      recent_turns: withInterrupt(session.recent_turns, session.state, 0),
    });
    return await beginComplaint(from);
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
    const cards = await currentOrderCards(from);
    // They asked for their orders. Do not reopen the dish list that was waiting.
    await updateSession(from, {
      state: "idle",
      pending_options: null,
      proposal: null,
      selected_item_id: null,
      selected_variant: null,
      recent_turns: chatTurns(session.recent_turns).slice(-8),
    });
    await sendText(from, buildCurrentOrdersMessage(cards));
    return ack();
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

  // A full order sentence during checkout — not menu, track, or help side questions.
  if (looksLikeFoodOrder(text) || looksLikeNewOrder(text)) {
    await rememberInterrupt(from, session, 0);
    await updateSession(from, { state: "ai_chat" });
    return await handleAiChat(from, text, _profileName);
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
  const result = await agent.processMessage(
    text,
    turnsForAgent(session.recent_turns),
    from,
    profileName,
    JSON.stringify(getCartSummary(session.cart)),
    session.state,
  );
  const turns: SessionTurns = [
    ...chatTurns(session.recent_turns),
    { role: "user", content: text },
    ...(result.reply ? [{ role: "assistant" as const, content: result.reply }] : []),
    ...sessionNotes(session.recent_turns),
  ].slice(-20);

  if (result.proposalDraft && session.cart.length === 0) {
    await updateSession(from, { recent_turns: turnsWithDraft(turns, result.proposalDraft) });
    return { kind: "done", response: await presentProposal(from, result.proposalDraft, text) };
  }

  if (!result.reply) return { kind: "skip" };
  await updateSession(from, { state: "ai_chat", recent_turns: turns });
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
  if (state === "picking_proposal_address") return await askForProposalAddress(from);
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
  if (state === "picking_item") {
    const draft = readStoredDraft(session.recent_turns);
    if (draft) return await presentProposal(from, draft);
    return await showCategoryBrowser(from);
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
  if (
    resolved === "change_proposal_address" ||
    /\b(change|different|new|vera)\b[\s\S]{0,24}\b(address|door|veedu|location)\b/i.test(lower) ||
    /\b(address|door|veedu|location)\b[\s\S]{0,24}\b(change|different|new|vera)\b/i.test(lower)
  ) {
    return await askForProposalAddress(from);
  }
  // Anything else is a correction — hand it back to the model with the draft
  // still in view rather than making them start again.
  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function handlePickingDate(from: string, text: string, session: WhatsAppSession) {
  const draft = readOpenDraft(session);
  if (draft) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(draft, text, last.address || session.delivery_address);
    if (filled.changed) return await continueDraftOrder(from, filled.draft, text);
    const ymd = parseDateInput(text) || parseDateText(text);
    if (ymd) return await continueDraftOrder(from, { ...draft, date: ymd }, text);
    return await continueDraftOrder(from, draft, text);
  }

  const date = parseDateInput(text) || parseDateText(text);
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

  const draft = readOpenDraft(session);
  if (draft) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(draft, text, last.address || session.delivery_address);
    if (filled.changed) return await continueDraftOrder(from, filled.draft, text);
    if (slotKind) return await continueDraftOrder(from, { ...draft, slot: slotKind }, text);
    return await continueDraftOrder(from, draft, text);
  }

  if (!slotKind) {
    await sendText(from, buildProposalAskMessage("slot", langOf(from)));
    return ack();
  }

  return await applySlot(from, session, slotKind);
}

async function handlePickingAddress(from: string, text: string, session: WhatsAppSession) {
  const draft = readOpenDraft(session);
  if (draft) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(draft, text, last.address || session.delivery_address);
    if (filled.changed) return await continueDraftOrder(from, filled.draft, text);
    if (text.length >= 5) return await continueDraftOrder(from, { ...draft, address: text.trim() }, text);
  }

  if (text.length < 5) return await askForAddress(from);
  const check = checkTypedAddress(text);
  if (check.status !== "ok") {
    await sendText(from, check.message);
    return await askForMapPin(from);
  }
  return await finishAddress(from, session, text.trim());
}

async function handlePickingProposalAddress(from: string, text: string, _session: WhatsAppSession) {
  if (text.length < 5) return await askForProposalAddress(from);
  return await updateProposalAddress(from, text.trim());
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
  const draft = proposalDraftFromSession(fresh);

  if (
    draft &&
    (session.state === "ai_chat" ||
      session.state === "confirming_proposal" ||
      session.state === "picking_proposal_address")
  ) {
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
  const draft = readOpenDraft(session);
  if (draft) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(draft, text, last.address || session.delivery_address);
    if (filled.changed) return await continueDraftOrder(from, filled.draft, text);
    const pay = parsePaymentMethod(text);
    if (pay) {
      return await continueDraftOrder(from, { ...draft, payment: pay === "cod" ? "cash" : "online" }, text);
    }
  }

  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();
  if (resolved === "pay_online" || /online|upi|razor|pay now/i.test(lower)) {
    return await payFromDraftOrCart(from, session, "online");
  }
  if (resolved === "pay_cod" || /cash|cod/i.test(lower)) {
    return await payFromDraftOrCart(from, session, "cod");
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
    const dish = formatFullDishName(String(item.dish || "")).trim();
    if (!dish) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const size = parsePackSize(String(item.size || "")) || parsePackSize(dish);
    lines.push(`${dish} × ${qty}${size ? ` (${size})` : ""}`);
  }
  const date = notedDeliveryDate(draft);
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
  const spokenFamily = dishQueryCategory(text);
  const storedFamily = dishQueryCategory((stored?.items || []).map((item) => item.dish).filter(Boolean).join(" "));
  if (spokenFamily && spokenFamily !== storedFamily) {
    const base = stored || { items: [{ dish: spokenFamily }] };
    return await presentProposal(from, applySpokenFamily(base, text), text);
  }
  if (stored) {
    const last = await fetchLastAddressAndSlot(from);
    const filled = fillDraftFromReply(stored, text, last.address || session.delivery_address);
    if (filled.changed) return await presentProposal(from, filled.draft, text);
    // Same dish family again ("I want mutton gravy is it available?") must
    // reopen the picker, not tell them the cart is empty.
    if (looksLikeFoodOrder(text)) return await presentProposal(from, filled.draft, text);
  } else if (looksLikeFoodOrder(text)) {
    const family = spokenFamily || dishQueryCategory(text);
    const base = { items: [{ dish: family || text }] };
    return await presentProposal(from, applySpokenFamily(base, text), text);
  } else if (parsePackSize(text) && session.selected_item_id) {
    return await applyVariant(from, parsePackSize(text)!);
  }

  const agent = new VidyaAgent();
  const result = await agent.processMessage(
    text,
    turnsForAgent(history),
    from,
    profileName,
    JSON.stringify(getCartSummary(session.cart)),
    session.state,
  );

  const turns: NonNullable<WhatsAppSession["recent_turns"]> = [
    ...history,
    { role: "user" as const, content: text },
    ...(result.reply ? [{ role: "assistant" as const, content: result.reply }] : []),
  ].slice(-20);

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

  await updateSession(from, { state: "ai_chat", recent_turns: turns });
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
  incoming: ProposalDraft,
  sourceText?: string | null,
) {
  const lang = langOf(from);
  const menu = await getMenu();
  const last = await fetchLastAddressAndSlot(from);
  const session = await getSession(from);
  const lastAddress = last.address || session.delivery_address;
  const lastSlotKind = (last.slotKind || session.delivery_slot_kind) as DeliverySlotKind | null;
  const usualProfile = await fetchUsualProfile(from).catch(() => null);
  let draft = applyFastLaneDefaults(
    applySpokenFamily(applySpokenCheckout(incoming, sourceText), sourceText),
    {
      lastAddress,
      lastSlotKind,
      lastPayment: usualProfile?.payment ?? null,
    },
  );
  const proposalInput = {
    menu,
    sourceText,
    lastAddress,
    lastSlotKind,
  };

  let preparedChoices: MenuItem[] | null = null;
  let result = buildProposal({ ...proposalInput, draft });
  if (!result.ok && result.kind === "missing" && result.field === "dish") {
    const draftDish = (draft.items || []).map((item) => item.dish).filter(Boolean).join(" ");
    const query = dishChoiceQuery(draftDish, sourceText);
    const family = dishQueryCategory(query) || dishQueryCategory(sourceText || "") || dishQueryCategory(draftDish);
    const options = pickCanonicalRows(filterDishChoicesByIdentifyingWords(await closeDishChoices(menu, query, family), query));
    preparedChoices = options;
    if (options.length === 1) {
      const named: ProposalDraft = {
        ...draft,
        items: (draft.items || []).map((item, index) =>
          index === 0 ? { ...item, dish: options[0].name } : item,
        ),
      };
      const again = buildProposal({ ...proposalInput, draft: named });
      if (again.ok || again.kind !== "missing" || again.field !== "dish") {
        draft = named;
        result = again;
      }
    }
  }

  const turns = turnsWithDraft(session.recent_turns, draft);

  if (!result.ok && result.kind === "rejected") {
    if (result.code === "too_soon") {
      await updateSession(from, { state: "ai_chat", proposal: null, recent_turns: turns });
      return await showBookableSlots(from, result.tooSoon);
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
    const avoid = lastAssistantText(session.recent_turns);
    const ask = buildProposalAskMessage(result.field, lang, avoid, conversationalRoll(from, result.field));

    if (result.field === "size") {
      const buttons = [
        { id: "var_500gm", title: BTN.size500 },
        { id: "var_1kg", title: BTN.size1kg },
      ];
      const only = result.dishOptions?.[0];
      await updateSession(from, {
        selected_item_id: only?.id ?? session.selected_item_id,
        state: "ai_chat",
        recent_turns: turns,
      });
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "dish") {
      const draftDish = (draft.items || []).map((item) => item.dish).filter(Boolean).join(" ");
      const query = dishChoiceQuery(draftDish, sourceText);
      const family = dishQueryCategory(query) || dishQueryCategory(sourceText || "") || dishQueryCategory(draftDish);
      const rawOptions = preparedChoices ?? (await closeDishChoices(menu, query, family));
      const options = pickCanonicalRows(filterDishChoicesByIdentifyingWords(rawOptions, query));
      if (options.length === 1) {
        const named: ProposalDraft = {
          ...draft,
          items: (draft.items || []).map((item, index) =>
            index === 0 ? { ...item, dish: options[0].name } : item,
          ),
        };
        return await presentProposal(from, named, sourceText);
      }
      if (options.length > 0) {
        const statedSize = parsePackSize(sourceText || "");
        const pick = options.slice(0, 10);
        const prompt = buildDishChoicePrompt(family, avoid, conversationalRoll(from, "dish"));
        await updateSession(from, {
          state: "ai_chat",
          recent_turns: turns,
        });
        const entries = pick
          .map((item) => dishPickerFromMenuRow(item))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        const section = family === "mutton"
          ? (/\bgravy\b/i.test(query) ? "Mutton gravy" : "Mutton")
          : family === "egg"
            ? "Egg"
            : family === "chicken"
              ? (/\b(wings?|dry)\b/i.test(query) ? "Chicken" : "Chicken gravy")
              : "Dishes";
        await sendDishPicker(from, prompt, entries, {
          listButton: "View options",
          sectionTitle: section,
          statedSize,
        });
        await storeOptions(
          from,
          entries.map((entry) => ({ id: entry.id, title: entry.name })),
        );
        return ack();
      }
      await sendLookalikeCarousel(from, query);
      return ack();
    }

    if (result.field === "slot") {
      const buttons = [
        { id: "slot_breakfast", title: BTN.breakfast },
        { id: "slot_lunch", title: BTN.lunch },
        { id: "slot_dinner", title: BTN.dinner },
      ];
      await updateSession(from, { state: "ai_chat", recent_turns: turns });
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "date") {
      const quickDates = upcomingDateRows().slice(0, 3);
      const buttons = quickDates.map((row) => ({ id: row.id, title: row.title.slice(0, 20) }));
      await updateSession(from, { state: "ai_chat", recent_turns: turns });
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "address") {
      const saved = (await fetchUsualProfile(from).catch(() => null))?.addresses ?? [];
      if (saved.length > 0) {
        await updateSession(from, { state: "picking_proposal_address", recent_turns: turns });
        return await askForProposalAddress(from);
      }
      await sendText(from, ask);
      return ack();
    }

    if (result.field === "payment") {
      const buttons = [
        { id: "pay_online", title: BTN.payOnline },
        { id: "pay_cod", title: BTN.payCash },
      ];
      await updateSession(from, { state: "ai_chat", recent_turns: turns });
      await storeOptions(from, buttons);
      await sendButtons(from, buildPaymentAsk(understoodOrderLines(draft), lang), buttons);
      return ack();
    }

    await sendText(from, ask);
    return ack();
  }

  const proposal = result.proposal;
  await updateSession(from, {
    state: "confirming_proposal",
    proposal,
    recent_turns: [...chatTurns(turns), ...sessionNotes(turns)].slice(-10),
  });

  const buttons = [
    { id: "confirm_proposal", title: BTN.confirmOrder },
    { id: "change_proposal_address", title: BTN.changeAddress },
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
      quoted.feeOpts,
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

function savedAddressRows(addresses: string[]) {
  return [
    ...addresses.slice(0, 8).map((address, index) => ({
      id: `addr_${index}`,
      title: clipLabel(address, 24),
      description: clipLabel(address, 72),
    })),
    { id: "addr_map", title: "Choose on map", description: "Drop a pin. No need to type it." },
  ];
}

async function askForAddress(from: string) {
  await updateSession(from, { state: "picking_address" });
  const profile = await fetchUsualProfile(from).catch(() => null);
  const saved = profile?.addresses ?? [];
  if (saved.length === 0) return await askForMapPin(from);

  const rows = savedAddressRows(saved);
  await sendList(from, buildAddressChoicesMessage(langOf(from)), "Address", [
    { title: "Deliver to", rows },
  ]);
  await storeOptions(
    from,
    rows.map((row) => ({ id: row.id, title: row.title })),
  );
  return ack();
}

async function askForProposalMapPin(from: string) {
  await updateSession(from, { state: "picking_proposal_address" });
  await sendLocationRequest(from, buildMapPinPrompt(langOf(from)));
  return ack();
}

async function askForProposalAddress(from: string) {
  const session = await getSession(from);
  if (!session.proposal && !proposalDraftFromSession(session)) {
    return await askForAddress(from);
  }
  await updateSession(from, { state: "picking_proposal_address" });
  const profile = await fetchUsualProfile(from).catch(() => null);
  const saved = profile?.addresses ?? [];
  if (saved.length === 0) return await askForProposalMapPin(from);

  const rows = savedAddressRows(saved);
  await sendList(from, buildAddressChoicesMessage(langOf(from)), "Address", [
    { title: "Deliver to", rows },
  ]);
  await storeOptions(
    from,
    rows.map((row) => ({ id: row.id, title: row.title })),
  );
  return ack();
}

async function updateProposalAddress(from: string, address: string) {
  if (!address || address.length < 5) return await askForProposalAddress(from);

  const pinLabel = /^Pinned location \(/.test(address);
  if (!pinLabel) {
    const check = checkTypedAddress(address);
    if (check.status !== "ok") {
      await sendText(from, check.message);
      return await askForProposalMapPin(from);
    }
  }

  const session = await getSession(from);
  const draft = proposalDraftFromSession(session);
  if (!draft) {
    await updateSession(from, { state: "idle", proposal: null });
    return await showFullMenu(from);
  }

  await updateSession(from, { delivery_address: address });
  return await presentProposal(from, { ...draft, address }, address);
}

async function useSavedAddress(from: string, index: number) {
  const profile = await fetchUsualProfile(from);
  const address = profile?.addresses[index];
  const session = await getSession(from);
  if (!address) {
    if (session.state === "picking_proposal_address") return await askForProposalAddress(from);
    return await askForAddress(from);
  }
  if (session.state === "picking_proposal_address") {
    return await updateProposalAddress(from, address);
  }
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
  const session = await getSession(from);
  const avoid = lastAssistantText(session.recent_turns);
  const roll = conversationalRoll(from, "welcome");

  const [active, returning, profile] = await Promise.all([
    hasActiveOrder(from),
    hasOrders(from),
    fetchUsualProfile(from).catch(() => null),
  ]);
  const kind = active ? "active" : returning ? "returning" : "new";
  const buttons = await homeButtons(from);
  const usualTease =
    kind === "returning" && profile?.dishes[0]
      ? buildUsualTeaseLine(profile.dishes[0].name, profile.dishes[0].variant, avoid, roll)
      : null;
  const welcome = buildWelcomeMessage(firstName, kind, lang, avoid, roll, usualTease);

  try {
    await sendButtons(from, welcome, buttons, {
      headerImageUrl: welcomeLogoImageUrl(),
    });
    console.log(`[WA] Welcome (${kind}) sent to ${from}`);
  } catch (e) {
    console.error("[WA] welcome send failed, text fallback:", e);
    try {
      await sendText(from, welcome);
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
  const menu = await getMenu();
  const matches = await closeDishChoices(menu, query, category);
  const heading = await new VidyaAgent().writeMissingDishLine(query, category);
  const entries = (
    matches.length > 0
      ? matches.map((item) => dishPickerFromMenuRow(item))
      : lookalikeDishes(query).map(dishPickerFromPricing)
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (entries.length === 0) {
    await sendText(from, heading);
    return;
  }
  await storeOptions(
    from,
    entries.map((entry) => ({ id: entry.id, title: entry.name })),
  );
  await sendDishPicker(from, heading, entries, {
    listButton: "See dishes",
    sectionTitle: category ? categoryDisplayLabel(category) : "House favourites",
  });
}

async function showBookableSlots(
  from: string,
  tooSoon?: { label: string; when: string; range: string } | null,
  afterYmd?: string | null,
) {
  const { sections } = bookableSlotSections(afterYmd);
  const rows = sections.flatMap((section) => section.rows);
  if (rows.length === 0) {
    await sendText(from, tooSoon ? buildSlotListBody(tooSoon) : "No open slots in the next few weeks. Message us and we'll sort a time.");
    return ack();
  }
  const session = await getSession(from);
  const avoid = lastAssistantText(session.recent_turns);
  const body = afterYmd ? buildMoreDaysBody(avoid) : buildSlotListBody(tooSoon, avoid);
  await storeOptions(from, rows.map((row) => ({ id: row.id, title: row.title })));
  await sendList(from, body, "Pick a slot", sections);
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
  const session = await getSession(from);
  if (session.cart.length === 0) {
    await updateSession(from, { state: "ai_chat" });
    return await continuePickedDish(from, await getSession(from), item);
  }
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
  const dishes = dishesInCategory(category).slice(0, 10);
  if (dishes.length === 0) {
    await sendText(from, notUnderstoodReply(langOf(from)));
    return ack();
  }
  const entries = dishes.map((dish) => ({
    ...dishPickerFromPricing(dish),
    id: `${variant === "1kg" ? "sz1kg" : "sz500"}_${dish.retailerId}`,
  }));
  await storeOptions(from, entries.map((entry) => ({ id: entry.id, title: entry.name })));
  const heading = `${categoryDisplayLabel(category)} (${variant})`;
  await sendDishPicker(from, `${heading}\nSwipe the cards and tap Add.`, entries, {
    listButton: "Menu",
    sectionTitle: heading,
    statedSize: variant,
  });
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
    const label = categoryDisplayLabel(category);
    const body = `${label}\nSwipe the cards, tap Add, then pick 500gm or 1kg.`;
    const entries = dishes.map(dishPickerFromPricing);
    await sendDishPicker(from, body, entries, {
      listButton: "View menu",
      sectionTitle: label,
    });
    sent = true;
    shown.push(...dishes);
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
    const entries = dishes.map(dishPickerFromPricing);
    await sendDishPicker(from, `${catLabel}\nSwipe the cards, tap Add, then pick 500gm or 1kg.`, entries, {
      listButton: "View menu",
      sectionTitle: catLabel,
    });
    return ack();
  }

  const slice = pickCanonicalRows(items).slice(0, 10);
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
  const feeOpts = { deliveryPromo: await loadDeliveryPromoSettings() };
  await sendButtons(from, buildCartMessage(cart, lang, feeOpts), buttons);
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
    const feeOpts = { deliveryPromo: await loadDeliveryPromoSettings() };
    await sendButtons(from, buildReuseLastPrompt(session.cart, last.address, line, langOf(from), feeOpts), buttons);
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
  const session = await getSession(from);
  const draft = readOpenDraft(session);
  if (draft) return await continueDraftOrder(from, { ...draft, date: ymd });

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
  const draft = readOpenDraft(session);
  if (draft) return await continueDraftOrder(from, { ...draft, slot: slotKind });

  const date = session.delivery_date;
  if (date) {
    const slotIso = slotStartIsoFor(date, slotKind);
    if (!isSlotBookable(slotIso)) {
      const def = DELIVERY_SLOT_DEFS[slotKind];
      return await showBookableSlots(from, {
        label: def.label,
        when: dateLabel(date),
        range: def.rangeLabel,
      });
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
    quoted.feeOpts,
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

/**
 * Pay taps during a draft checkout have no cart yet. The dish, size, and day
 * live on the stored draft. Treating that tap as a cart checkout said the
 * cart was empty and dropped the order.
 */
async function payFromDraftOrCart(
  from: string,
  session: WhatsAppSession,
  method: "online" | "cod",
): Promise<Response> {
  if (session.cart.length === 0) {
    const draft = readStoredDraft(session.recent_turns);
    const hasDish = (draft?.items || []).some((item) => String(item?.dish || "").trim());
    if (draft && hasDish) {
      return await presentProposal(from, {
        ...draft,
        payment: method === "cod" ? "cash" : "online",
      });
    }
  }
  if (method === "cod") return await handlePayCodTap(from, session);
  return await processConfirmOrder(from, session, method);
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

function dishNamesFromOrderItems(items: unknown): string {
  const rows = Array.isArray(items) ? items : [];
  const names = rows
    .map((row) => {
      const menu = (row as { menu_items?: { name?: string | null } | { name?: string | null }[] | null }).menu_items;
      const raw = Array.isArray(menu) ? menu[0]?.name : menu?.name;
      return raw ? formatFullDishName(String(raw)) : "";
    })
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length === 0) return "Your order";
  if (unique.length <= 2) return unique.join(", ");
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

function orderedOnLabel(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

async function recentKitchenCallOrders(from: string): Promise<KitchenCallOrder[]> {
  const { data } = await createServerSupabase()
    .from("orders")
    .select("id, order_number, created_at, order_items(menu_items(name))")
    .in("phone_number", phoneVariants(from))
    .order("created_at", { ascending: false })
    .limit(4);
  return ((data || []) as {
    id: string;
    order_number?: number | null;
    created_at?: string | null;
    order_items?: unknown;
  }[]).map((row) => ({
    ref: formatOrderRef(row.order_number, row.id),
    dishes: dishNamesFromOrderItems(row.order_items),
    orderedOn: orderedOnLabel(row.created_at),
  }));
}

async function showCallKitchen(from: string) {
  const orders = await recentKitchenCallOrders(from).catch(() => [] as KitchenCallOrder[]);
  await sendCtaUrl(from, callUsDialReply(langOf(from), orders), kitchenCallPageUrl(), "Call the kitchen", {
    footer: "Opens the Phone app",
  });
  return ack();
}

async function showHelpSupport(from: string) {
  await storeOptions(
    from,
    HELP_LIST_ROWS.map((row) => ({ id: row.id, title: row.title })),
  );
  await sendList(from, helpAndSupportReply(langOf(from)), "Get help", [{ title: "Help", rows: HELP_LIST_ROWS }]);
  return ack();
}

type SupportOrderRow = {
  id: string;
  order_number?: number | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  refund_status?: string | null;
  total_amount?: number | null;
  cancellation_deadline?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_last_lat?: number | null;
  driver_last_lng?: number | null;
};

async function supportOrders(from: string): Promise<SupportOrderRow[]> {
  const db = createServerSupabase();
  const phones = phoneVariants(from);
  const full =
    "id, order_number, status, payment_method, payment_status, refund_status, total_amount, cancellation_deadline, delivery_slot, delivery_slot_kind, delivery_lat, delivery_lng, driver_name, driver_phone, driver_last_lat, driver_last_lng";
  const first = await db.from("orders").select(full).in("phone_number", phones).order("created_at", { ascending: false }).limit(5);
  if (!first.error) return (first.data || []) as SupportOrderRow[];
  const slim = await db
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, total_amount, delivery_slot, delivery_slot_kind")
    .in("phone_number", phones)
    .order("created_at", { ascending: false })
    .limit(5);
  return (slim.data || []) as SupportOrderRow[];
}

function supportRef(row: SupportOrderRow): string {
  return formatOrderRef(row.order_number, row.id);
}

function cancelWindowOpen(row: SupportOrderRow, now = Date.now()): boolean {
  const status = String(row.status || "").toLowerCase();
  if (["cancelled", "rejected", "delivered", "undelivered"].includes(status)) return false;
  if (status === "pending_payment") return true;
  const deadline = row.cancellation_deadline ? Date.parse(row.cancellation_deadline) : NaN;
  return Number.isFinite(deadline) && now < deadline;
}

async function answerSupport(
  from: string,
  text: string,
  session: WhatsAppSession,
  profileName: string,
): Promise<Response | null> {
  const topic = supportTopic(text);
  if (!topic) return null;
  await updateSession(from, {
    pending_options: null,
    selected_item_id: null,
    selected_variant: null,
  });
  if (topic === "help") {
    await updateSession(from, { state: "idle" });
    return await showHelpSupport(from);
  }
  if (topic === "cancel_placed") {
    await updateSession(from, { state: "idle" });
    return await showCancelChoice(from, text);
  }
  if (topic === "resubscribe") {
    await updateSession(from, { state: "idle" });
    return await applyMarketingOptIn(from);
  }
  if (topic === "call") {
    await updateSession(from, { state: "idle" });
    return await showCallKitchen(from);
  }
  if (topic === "track") {
    await updateSession(from, { state: "idle" });
    return await showTrackOrder(from);
  }
  if (topic === "refund") {
    await updateSession(from, { state: "idle" });
    return await showRefundAnswer(from);
  }
  if (topic === "cancel_policy") {
    await updateSession(from, { state: "idle" });
    await sendText(from, buildCancelPolicyAnswer(langOf(from)));
    return ack();
  }
  if (topic === "driver") {
    await updateSession(from, { state: "idle" });
    return await showDriverAnswer(from);
  }
  if (topic === "offers") {
    await updateSession(from, { state: "idle" });
    return await showOfferAnswer(from);
  }
  if (topic === "address") {
    await updateSession(from, { state: "idle" });
    const profile = await fetchUsualProfile(from).catch(() => null);
    await sendText(from, buildAddressOnFileAnswer(profile?.addresses?.[0] ?? null));
    return ack();
  }
  if (topic === "bot") {
    await updateSession(from, { state: "idle" });
    await sendText(from, buildBotAnswer());
    return ack();
  }
  if (topic === "presence") {
    await updateSession(from, { state: "idle" });
    await sendText(from, buildPresenceAnswer());
    return ack();
  }
  if (topic === "best_seller") {
    await updateSession(from, { state: "idle" });
    const pick = allMenuDishes().find((d) => d.id === KITCHEN_PICK_DISH_IDS[0]);
    await sendText(from, buildBestSellerAnswer(pick?.name ?? "Mom's Recipe Chicken Gravy"));
    return ack();
  }
  if (topic === "spicy") {
    await updateSession(from, { state: "idle" });
    await sendText(from, buildSpicyAnswer());
    return ack();
  }

  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function showRefundAnswer(from: string) {
  const orders = await supportOrders(from);
  const hit = orders.find((row) =>
    ["initiated", "refunded", "refund_failed"].includes(String(row.refund_status || "").toLowerCase()),
  );
  await sendText(
    from,
    buildRefundAnswer(
      hit
        ? {
            ref: supportRef(hit),
            refundStatus: hit.refund_status || null,
            payment: String(hit.payment_method || ""),
            total: hit.total_amount != null ? formatInr(Number(hit.total_amount)) : "",
          }
        : null,
    ),
  );
  return ack();
}

async function showCancelChoice(from: string, text: string) {
  const wanted = supportOrderNumber(text);
  let orders = await supportOrders(from);
  if (wanted && !orders.some((row) => Number(row.order_number) === wanted)) {
    const { data } = await createServerSupabase()
      .from("orders")
      .select("id, order_number, status, payment_method, payment_status, refund_status, total_amount, cancellation_deadline, delivery_slot, delivery_slot_kind")
      .in("phone_number", phoneVariants(from))
      .eq("order_number", wanted)
      .order("created_at", { ascending: false })
      .limit(1);
    orders = ((data || []) as SupportOrderRow[]).concat(orders);
  }
  const row = wanted
    ? orders.find((item) => Number(item.order_number) === wanted)
    : orders.find((item) => item.status && !["cancelled", "rejected", "delivered"].includes(String(item.status)));
  if (!row) {
    await sendText(from, buildNothingToCancelAnswer());
    return ack();
  }
  const ref = supportRef(row);
  if (!cancelWindowOpen(row)) {
    await sendText(from, buildCancelClosedAnswer(ref));
    return ack();
  }
  const when = formatSlotLineForCustomer(row.delivery_slot, row.delivery_slot_kind);
  const buttons = [
    { id: `hscancel_${row.id}`, title: "Cancel this order" },
    { id: "hs_call", title: "Call the kitchen" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildCancelConfirmAsk(ref, when ? `Booked for ${when}.` : "The cooking window is still open."), buttons);
  return ack();
}

async function confirmSupportCancel(from: string, orderId: string) {
  const db = createServerSupabase();
  const { data } = await db
    .from("orders")
    .select("id, order_number, status, phone_number, payment_method, payment_status, total_amount, cancellation_deadline")
    .eq("id", orderId)
    .maybeSingle();
  const row = data as (SupportOrderRow & { phone_number?: string | null }) | null;
  const owns =
    row &&
    String(row.phone_number || "").replace(/\D/g, "").slice(-10) === from.replace(/\D/g, "").slice(-10);
  if (!row || !owns) {
    await sendText(from, buildNothingToCancelAnswer());
    return ack();
  }
  const ref = supportRef(row);
  if (!cancelWindowOpen(row)) {
    await sendText(from, buildCancelClosedAnswer(ref));
    return ack();
  }
  const result = await transitionOrderStatusInDb(db, row.id, OrderStatus.CANCELLED, { notifyCustomer: false });
  if (!result.ok) {
    await sendText(from, buildCancelClosedAnswer(ref));
    return ack();
  }
  const { data: after } = await db
    .from("orders")
    .select("refund_status, payment_method, payment_status, total_amount")
    .eq("id", row.id)
    .maybeSingle();
  const refundStatus = String((after as { refund_status?: string | null } | null)?.refund_status || "").toLowerCase();
  const method = String((after as { payment_method?: string | null } | null)?.payment_method || row.payment_method || "").toLowerCase();
  const paid = String((after as { payment_status?: string | null } | null)?.payment_status || row.payment_status || "").toLowerCase() === "paid";
  const total = Number((after as { total_amount?: number | null } | null)?.total_amount ?? row.total_amount);
  const amount = Number.isFinite(total) && total > 0 ? formatInr(total) : "";
  const moneyLine =
    method === "cod" || method === "cash" || !paid
      ? "You have not been charged."
      : refundStatus === "refunded"
        ? `A full refund of *${amount}* is going back to the same UPI or card. Food, packaging, delivery, and GST.`
        : refundStatus === "refund_failed"
          ? "The refund did not start. Call the kitchen and they will raise it."
          : refundStatus === "initiated"
            ? `The refund has started${amount ? ` for *${amount}*` : ""}. It goes back to the original payment.`
            : "You have not been charged.";
  await sendText(from, buildCancelDoneAnswer(ref, moneyLine));
  return ack();
}

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function showDriverAnswer(from: string) {
  const orders = await supportOrders(from);
  const row = orders.find((item) => item.status && !["cancelled", "rejected", "delivered"].includes(String(item.status)));
  if (!row) {
    await sendText(from, buildDriverAnswer({ ref: null, name: null, phone: null, km: null, status: null }));
    return ack();
  }
  const lat = Number(row.driver_last_lat);
  const lng = Number(row.driver_last_lng);
  const doorLat = Number(row.delivery_lat);
  const doorLng = Number(row.delivery_lng);
  const km =
    [lat, lng, doorLat, doorLng].every((n) => Number.isFinite(n) && n !== 0) ? kmBetween(lat, lng, doorLat, doorLng) : null;
  const phone = String(row.driver_phone || "").replace(/\D/g, "").slice(-10);
  await sendText(
    from,
    buildDriverAnswer({
      ref: supportRef(row),
      name: String(row.driver_name || "").trim() || null,
      phone: phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : null,
      km,
      status: row.status || null,
    }),
  );
  return ack();
}

async function showOfferAnswer(from: string) {
  const festival = await loadActiveFestival(createServerSupabase()).catch(() => null);
  const pct = festival ? Math.round(Number(festival.discount_override) || 0) : 0;
  const until = festival?.date_end
    ? new Date(`${festival.date_end}T12:00:00+05:30`).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      })
    : "";
  await sendText(
    from,
    buildOfferAnswer(festival && pct > 0 ? { name: festival.name, pct, until } : null),
  );
  return ack();
}

async function applyMarketingOptIn(from: string) {
  try {
    const { error } = await createServerSupabase()
      .from("users")
      .upsert({ phone_number: from, marketing_opt_out: false }, { onConflict: "phone_number" });
    if (error) throw error;
  } catch (e) {
    console.error("[WA] marketing opt-in failed:", e);
  }
  await sendText(from, buildResubscribeAnswer());
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
  const feeOpts = { deliveryPromo: await loadDeliveryPromoSettings() };
  await sendButtons(from, buildReuseLastPrompt(snap.cart, snap.address, line, langOf(from), feeOpts), buttons);
  return ack();
}

async function quoteCart(
  cart: CartItem[],
  phone: string,
): Promise<{
  total: number;
  offer: { label: string; amount: number } | null;
  applied: AppliedOffer | null;
  feeOpts: OrderFeeOptions;
}> {
  const subtotal = cartItemsSubtotal(cart);
  const deliveryPromo = await loadDeliveryPromoSettings();
  const feeOpts = { deliveryPromo };
  const { applied } = await resolveOfferForCheckout({ subtotal, phone });
  const discount = applied && applied.amount > 0 ? Math.min(subtotal, applied.amount) : 0;
  const total = Math.round(
    computeOrderBreakdownFromItemSubtotal(Math.max(0, subtotal - discount), feeOpts).computedTotal,
  );
  return {
    total,
    offer: discount > 0 && applied ? { label: applied.label, amount: discount } : null,
    applied: discount > 0 && applied ? applied : null,
    feeOpts,
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
