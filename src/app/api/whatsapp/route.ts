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
} from "@/lib/whatsapp-send";
import { fromWhatsAppFrom } from "@/lib/twilio-whatsapp";
import { fromMetaWebhook } from "@/lib/meta-whatsapp";
import {
  getSession,
  updateSession,
  resetSession,
  type WhatsAppSession,
} from "@/lib/whatsapp-session";
import { cartGrandTotal, type CartItem } from "@/lib/whatsapp-cart";
import {
  BTN,
  buildWelcomeMessage,
  welcomeLogoImageUrl,
  buildMenuHeader,
  buildFullMenuBody,
  buildCategoryListBody,
  buildCategoryMessage,
  buildDishListBody,
  buildVariantMessage,
  buildQtyMessage,
  buildCartMessage,
  buildCartLimitMessage,
  buildItemAddedMessage,
  buildDatePickerMessage,
  buildSlotPickerMessage,
  buildAddressPrompt,
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
  helpAndSupportReply,
  callUsDialReply,
  languagePickerBody,
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
import {
  detectWaLang,
  loadWaLang,
  saveWaLang,
  langForPhone,
  type WaLang,
} from "@/lib/whatsapp-lang";
import {
  fetchLastAddressAndSlot,
  fetchLastOrderSnapshot,
  nextBookableDateForKind,
} from "@/lib/whatsapp-last-order";
import { isCodAllowedForTotal } from "@/lib/cod-policy";
import { isCodBlocked, markOrderPaidAndNotify } from "@/lib/order-transition";
import { PaymentStatus, formatOrderRef } from "@/lib/order-status";
import { hasAppInstalledSignal } from "@/lib/whatsapp-app-signal";
import { unitPriceFor, packPricesFor, packPriceLine, formatInr, type PackSize } from "@/lib/menu/dish-pricing";
import {
  buildProposal,
  isProposalStillValid,
  repriceProposal,
  type OrderProposal,
} from "@/lib/ai/order-proposal";
import {
  whatsappCatalogId,
  catalogProductIdsForRetailer,
  catalogMenuSections,
  catalogSectionForCategory,
  categoryDisplayLabel,
  parseCatalogProductId,
  retailerIdForCsvPrefix,
  guessRetailerId,
  publicDishImageUrl,
  CATEGORY_CAROUSEL_IMAGES,
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
  const num = parseInt(text.trim(), 10);
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
  return items.map((m) => ({ id: m.id, title: m.name }));
}

function shortRef(orderId: string, orderNumber?: number | null): string {
  return formatOrderRef(orderNumber ?? null, orderId).replace(/^#/, "");
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let body = "";
    let profileName = "";
    let messageId = "";

    let interactiveReplyId: string | null = null;
    let catalogProductItems: { product_retailer_id?: string; quantity?: number }[] | null = null;

    if (contentType.includes("application/json")) {
      const json = await req.json();

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
            body = interactiveReplyId || interactive.button_reply?.title || "";
          } else if (interactive?.type === "list_reply") {
            interactiveReplyId = interactive.list_reply?.id || null;
            body = interactiveReplyId || interactive.list_reply?.title || "";
          } else if (interactive?.type === "nfm_reply") {
            interactiveReplyId = null;
            body = interactive.nfm_reply?.body || "";
          }
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Interactive] From=${from} Id=${interactiveReplyId} Body="${body}"`);
        } else if (message && message.type === "order") {
          from = fromMetaWebhook(message.from);
          const products = (message.order?.product_items || []) as { product_retailer_id?: string; quantity?: number }[];
          catalogProductItems = products;
          body = products[0]?.product_retailer_id || "catalog_order";
          profileName = contact?.profile?.name || "";
          messageId = message.id || "";
          console.log(`[Meta WA Catalog] From=${from} items=${products.length}`);
        } else {
          return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        }
      } else if (json.From || json.Body) {
        from = fromWhatsAppFrom(json.From || "");
        body = json.Body || "";
        profileName = json.ProfileName || "";
        console.log(`[Twilio WA JSON] From=${from} Body="${body}" Name=${profileName}`);
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = fromWhatsAppFrom(formData.get("From")?.toString() || "");
      body = formData.get("Body")?.toString() || "";
      profileName = formData.get("ProfileName")?.toString() || "";
      console.log(`[Twilio WA Form] From=${from} Body="${body}" Name=${profileName}`);
    }

    if (!from || (!body && !catalogProductItems?.length)) {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const text = body.trim();
    const lower = text.toLowerCase();

    // Fills the synchronous cache the copy builders read. Null means this
    // number has never picked a language.
    const storedLang = await loadWaLang(from);

    const session = await getSession(from);

    // Language choice, before anything else can use it.
    if (interactiveReplyId === "lang_en" || interactiveReplyId === "lang_tanglish") {
      return await applyLanguageChoice(from, interactiveReplyId === "lang_en" ? "en" : "tanglish", profileName);
    }

    // Asked once, and only when they are not mid-order — interrupting someone
    // at the payment step to ask about language would be its own bug.
    if (storedLang === null && session.state === "idle" && !catalogProductItems?.length) {
      return await showLanguagePicker(from, profileName, text);
    }

    const isGreeting = /^(hi|hello|hey|namaste|vanakkam|start|restart)\b/i.test(text);
    const isMenuCmd = /^(menu|browse|show menu|full menu|browse_menu|view_menu)\b/i.test(lower);
    const isCartCmd = /^(cart|my cart|view cart)\b/i.test(lower);
    const isHelpCmd = /^(help|support|help & support|help_support)\b/i.test(lower);
    const isTrackCmd = /^(track|order status|where is my order|my order)\b/i.test(lower);
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

    if (isMenuCmd) {
      await updateSession(from, { state: "browsing_category", proposal: null });
      return await showFullMenu(from);
    }
    if (isCartCmd) {
      return await showCart(from, session.cart);
    }
    if (isLangCmd) {
      return await showLanguagePicker(from, profileName, text);
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
        return await handleBrowsingCategory(from, text);

      case "picking_item":
        return await handlePickingItem(from, text);

      case "picking_variant":
        return await handlePickingVariant(from, text, session);

      case "picking_qty":
        return await handlePickingQty(from, text, session);

      case "cart_review":
        return await handleCartReview(from, text, session);

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

async function showLanguagePicker(from: string, profileName: string, incoming: string) {
  const firstName = profileName?.trim().split(/\s+/)[0];
  // Their own words only decide which button reads first, never the answer.
  const guess = detectWaLang(incoming);
  const buttons =
    guess === "tanglish"
      ? [
          { id: "lang_tanglish", title: BTN.tanglish },
          { id: "lang_en", title: BTN.english },
        ]
      : [
          { id: "lang_en", title: BTN.english },
          { id: "lang_tanglish", title: BTN.tanglish },
        ];

  await storeOptions(from, buttons);
  await sendButtons(from, languagePickerBody(firstName), buttons, {
    headerImageUrl: welcomeLogoImageUrl(),
  });
  return ack();
}

async function applyLanguageChoice(from: string, lang: WaLang, profileName: string) {
  await saveWaLang(from, lang);
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
  if (id.startsWith("qty_")) {
    const qty = parseInt(id.slice(4), 10);
    if (qty >= 1 && qty <= 10) return await addSelectedItemToCart(from, session, qty);
  }

  switch (id) {
    case "lang_en":
      return await applyLanguageChoice(from, "en", profileName);
    case "lang_tanglish":
      return await applyLanguageChoice(from, "tanglish", profileName);
    case "hs_language":
      return await showLanguagePicker(from, profileName, "");
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
      return await showCategoryBrowser(from);
    case "clear_cart":
      await updateSession(from, { cart: [], state: "idle" });
      await sendText(from, buildCartMessage([], langOf(from)));
      return ack();
    case "reuse_last":
      return await applyLastAddressAndSlot(from, session);
    case "change_slot_addr":
      return await showDatePicker(from);
    case "reuse_address":
      return await finishAddress(from, session, session.delivery_address || (await fetchLastAddressAndSlot(from)).address || "");
    case "new_address":
      await updateSession(from, { state: "picking_address", delivery_address: null });
      await sendText(from, buildAddressPrompt(langOf(from)));
      return ack();
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
    case "back_home":
      await resetSession(from);
      return await showWelcome(from, profileName);
    case "hs_call":
      await sendText(from, callUsDialReply(langOf(from)));
      return ack();
    case "hs_complaint":
      await updateSession(from, { state: "ai_chat" });
      await sendText(from, complaintPrompt(langOf(from)));
      return ack();
    case "hs_your_orders":
      return await showOrderHistory(from);
    case "hs_payments":
      return await showPaymentsSummary(from);
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

  if (matched) {
    return await showVariantPicker(from, matched);
  }

  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function handleBrowsingCategory(from: string, text: string) {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);

  let cat: string | null = null;
  if (num === 1 || /chicken/i.test(lower)) cat = "chicken";
  else if (num === 2 || /mutton/i.test(lower)) cat = "mutton";
  else if (num === 3 || /egg/i.test(lower)) cat = "egg";

  if (cat) {
    return await showCategoryItems(from, cat);
  }

  await sendText(from, buildCategoryMessage(langOf(from)));
  return ack();
}

async function handlePickingItem(from: string, text: string) {
  const num = parseInt(text, 10);
  const menu = await getMenu();

  const resolved = await resolveNumbered(from, text);
  const sess = await getSession(from);
  const itemId = resolved || (num > 0 && sess.pending_options ? sess.pending_options[num - 1]?.id : null);

  if (itemId) {
    const item = menu.find((m) => m.id === itemId);
    if (item) return await showVariantPicker(from, item);
  }

  const matched = findItemByName(menu, text);
  if (matched) return await showVariantPicker(from, matched);

  await sendText(from, notUnderstoodReply(langOf(from)));
  return ack();
}

async function handlePickingVariant(from: string, text: string, _session: WhatsAppSession) {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);

  let variant: PackSize | null = null;
  if (num === 1 || /500/i.test(lower) || lower === "var_500gm") variant = "500gm";
  else if (num === 2 || /1\s*kg/i.test(lower) || lower === "var_1kg") variant = "1kg";

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
  let qty = parseInt(text.trim().replace(/^qty_/, ""), 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 10) {
    await sendText(from, buildQtyMessage(session.selected_variant || "500gm", langOf(from)));
    return ack();
  }
  return await addSelectedItemToCart(from, session, qty);
}

async function handleCartReview(from: string, text: string, session: WhatsAppSession) {
  const num = parseInt(text.trim(), 10);
  const resolved = await resolveNumbered(from, text);

  if (resolved === "checkout" || num === 1) {
    if (session.cart.length === 0) {
      await sendText(from, buildCartMessage([], langOf(from)));
      return ack();
    }
    return await afterCartReady(from, session);
  }
  if (resolved === "add_more" || num === 2) {
    return await showCategoryBrowser(from);
  }
  if (resolved === "clear_cart" || num === 3) {
    await updateSession(from, { cart: [], state: "idle" });
    await sendText(from, buildCartMessage([], langOf(from)));
    return ack();
  }

  await sendText(from, notUnderstoodReply(langOf(from)));
  return ack();
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
  await sendText(from, notUnderstoodReply(langOf(from)));
  return ack();
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
  if (text.length < 5) {
    await sendText(from, buildAddressPrompt(langOf(from)));
    return ack();
  }
  return await finishAddress(from, session, text.trim());
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

  await sendText(from, notUnderstoodReply(langOf(from)));
  return ack();
}

// ─── Conversational ordering ───────────────────────────────────────────────

async function handleAiChat(from: string, text: string, profileName: string) {
  const session = await getSession(from);
  const history = session.recent_turns || [];

  const agent = new VidyaAgent();
  const result = await agent.processMessage(text, history as Message[], from, profileName);

  const turns: NonNullable<WhatsAppSession["recent_turns"]> = [
    ...history,
    { role: "user" as const, content: text },
    ...(result.reply ? [{ role: "assistant" as const, content: result.reply }] : []),
  ].slice(-8);

  if (result.reply) {
    await sendText(from, result.reply);
  }

  // A draft means they were trying to order. Price it here — the model has
  // never seen a price and is not allowed to quote one.
  if (result.proposalDraft) {
    await updateSession(from, { recent_turns: turns });
    return await presentProposal(from, result.proposalDraft);
  }

  const buttons = [
    { id: "browse_menu", title: BTN.menu },
    { id: "help_support", title: BTN.help },
    { id: "back_home", title: BTN.startOver },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, aiFollowupPrompt(langOf(from)), buttons);

  await updateSession(from, { state: "idle", recent_turns: turns });
  return ack();
}

/** Price and rule-check a draft, then either ask for what's missing or show it. */
async function presentProposal(from: string, draft: NonNullable<Awaited<ReturnType<VidyaAgent["processMessage"]>>["proposalDraft"]>) {
  const lang = langOf(from);
  const menu = await getMenu();
  const last = await fetchLastAddressAndSlot(from);

  const result = buildProposal({
    menu,
    draft,
    lastAddress: last.address,
    lastSlotKind: last.slotKind as DeliverySlotKind | null,
  });

  if (!result.ok && result.kind === "rejected") {
    await updateSession(from, { state: "idle", proposal: null });
    await sendText(from, result.reason);
    return await showFullMenu(from);
  }

  if (!result.ok) {
    // One question at a time, as taps wherever a tap makes sense.
    await updateSession(from, { state: "ai_chat", proposal: null });
    const ask = buildProposalAskMessage(result.field, lang);

    if (result.field === "size") {
      const buttons = [
        { id: "var_500gm", title: BTN.size500 },
        { id: "var_1kg", title: BTN.size1kg },
      ];
      const only = result.dishOptions?.[0];
      if (only) {
        await updateSession(from, { selected_item_id: only.id, state: "picking_variant" });
        return await showVariantPicker(from, only);
      }
      await storeOptions(from, buttons);
      await sendButtons(from, ask, buttons);
      return ack();
    }

    if (result.field === "dish" && result.dishOptions?.length) {
      await updateSession(from, { state: "picking_item" });
      await storeOptions(from, itemOptions(result.dishOptions));
      await sendList(from, ask, "Pick a dish", [
        {
          title: "Did you mean",
          rows: result.dishOptions.slice(0, 10).map((m) => ({
            id: m.id,
            title: m.name.length > 24 ? `${m.name.slice(0, 21)}...` : m.name,
            description: packPriceLine(m, " / "),
          })),
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
  await updateSession(from, { state: "confirming_proposal", proposal });

  const buttons = [
    { id: "confirm_proposal", title: BTN.confirmOrder },
    { id: "cancel_proposal", title: BTN.startOver },
  ];
  await storeOptions(from, buttons);
  await sendButtons(
    from,
    buildProposalMessage(
      proposal.cart,
      dateLabel(proposal.deliveryDate),
      slotLabel(proposal.slotKind),
      proposal.address,
      proposal.paymentMethod === "cod" ? "Cash on delivery" : "Pay online",
      lang,
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
async function homeButtons(from: string): Promise<{ id: string; title: string }[]> {
  const [installed, active, returning] = await Promise.all([
    hasAppInstalledSignal(from),
    hasActiveOrder(from),
    hasOrders(from),
  ]);

  const buttons: { id: string; title: string }[] = [{ id: "browse_menu", title: BTN.menu }];
  if (active) buttons.push({ id: "track_order", title: BTN.track });
  else if (installed && returning) buttons.push({ id: "quick_reorder", title: BTN.orderAgain });
  else if (installed) buttons.push({ id: "open_app", title: BTN.openApp });
  else buttons.push({ id: "install_app", title: BTN.installApp });

  buttons.push({ id: "help_support", title: BTN.help });
  return buttons;
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
  const token = await createAutoLoginToken(from, profileName || "Friend");
  const autoLoginUrl = `${publicSiteOrigin()}?wa_token=${token}`;
  // Already installed? Then this is just "open it", not a sales pitch.
  const installed = await hasAppInstalledSignal(from);
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
async function showFullMenu(from: string) {
  const lang = langOf(from);
  await updateSession(from, { state: "browsing_category" });

  const catalogId = whatsappCatalogId();
  if (catalogId) {
    const { sections, truncated } = catalogMenuSections();
    const sent = await sendProductList(
      from,
      catalogId,
      buildMenuHeader(lang),
      buildFullMenuBody(lang, { truncated }),
      sections,
      "Vidya's Kitchen, Sivakasi",
    );
    if (sent) return ack();
    console.error("[WA] product_list failed for the full menu — falling back to categories.");
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
  const cards = [
    {
      id: "cat_chicken",
      title: BTN.chicken,
      body: "Pepper, chilly, mom's recipe, wings.",
      imageUrl: CATEGORY_CAROUSEL_IMAGES.chicken,
      buttonTitle: BTN.chicken,
    },
    {
      id: "cat_mutton",
      title: BTN.mutton,
      body: "Curries, keema, stew, chukka.",
      imageUrl: CATEGORY_CAROUSEL_IMAGES.mutton,
      buttonTitle: BTN.mutton,
    },
    {
      id: "cat_egg",
      title: BTN.egg,
      body: "Egg curry and egg chalna.",
      imageUrl: CATEGORY_CAROUSEL_IMAGES.egg,
      buttonTitle: BTN.egg,
    },
  ];
  const carouselOk = await sendCarousel(from, buildCategoryListBody(lang), cards);
  if (carouselOk) return ack();

  await sendList(from, buildCategoryListBody(lang), "View menu", [
    {
      title: "Categories",
      rows: [
        { id: "cat_chicken", title: BTN.chicken, description: "Gravies, pepper, wings" },
        { id: "cat_mutton", title: BTN.mutton, description: "Curries, keema, stew" },
        { id: "cat_egg", title: BTN.egg, description: "Egg curry and chalna" },
      ],
    },
  ]);
  return ack();
}

async function showCategoryItems(from: string, cat: string) {
  const items = await getMenuByCategory(cat);
  const lang = langOf(from);
  const catLabel = categoryDisplayLabel(cat);

  if (items.length === 0) {
    await sendText(from, buildCategoryMessage(lang));
    return ack();
  }

  const slice = items.slice(0, 10);
  await storeOptions(from, itemOptions(slice));
  await updateSession(from, { state: "picking_item" });

  const catalogId = whatsappCatalogId();
  if (catalogId) {
    const section = catalogSectionForCategory(cat);
    if (section) {
      const sent = await sendProductList(from, catalogId, catLabel, buildDishListBody(catLabel, lang), [section]);
      if (sent) return ack();
      console.error(`[WA] product_list failed for ${cat} — trying the carousel.`);
    }
  }

  if (slice.length >= 2) {
    const cards = slice.map((m) => ({
      id: m.id,
      title: m.name.length > 20 ? `${m.name.slice(0, 17)}...` : m.name,
      body: `${m.name}\n${packPriceLine(m)}`.slice(0, 160),
      imageUrl: publicDishImageUrl(m),
      buttonTitle: "Choose",
    }));
    const carouselOk = await sendCarousel(from, buildCarouselBody(catLabel, lang), cards);
    if (carouselOk) return ack();
    console.error(`[WA] carousel failed for ${cat} — falling back to a list.`);
  }

  let body = buildDishListBody(catLabel, lang);
  if (items.length > 10) {
    body += `\n\n${buildAppNudgeFooter(lang)}`;
  }
  const rows = slice.map((m) => ({
    id: m.id,
    title: m.name.length > 24 ? `${m.name.slice(0, 21)}...` : m.name,
    description: packPriceLine(m, " / "),
  }));
  await sendList(from, body, "Pick a dish", [{ title: catLabel, rows }]);
  return ack();
}

async function showVariantPicker(from: string, item: MenuItem) {
  const lang = langOf(from);
  const buttons = [
    { id: "var_500gm", title: BTN.size500 },
    { id: "var_1kg", title: BTN.size1kg },
  ];
  await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildVariantMessage(item.name, packPricesFor(item), lang), buttons, {
    headerImageUrl: publicDishImageUrl(item),
  });
  return ack();
}

async function applyVariant(from: string, variant: PackSize) {
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
  await sendList(from, buildDatePickerMessage(langOf(from)), "Pick a day", [{ title: "Delivery day", rows }]);
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
  await updateSession(from, { delivery_date: ymd, state: "picking_slot" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildSlotPickerMessage(dateLabel(ymd), langOf(from)), buttons);
  return ack();
}

async function applySlot(from: string, session: WhatsAppSession, slotKind: DeliverySlotKind) {
  const date = session.delivery_date;
  if (date) {
    const slotIso = slotStartIsoFor(date, slotKind);
    if (!isSlotBookable(slotIso)) {
      await sendText(from, ORDER_CUTOFF_REMINDER);
      return await showDatePicker(from);
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

  await sendText(from, buildAddressPrompt(langOf(from)));
  return ack();
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
      await updateSession(from, { state: "picking_address" });
      await sendText(from, buildAddressPrompt(langOf(from)));
      return ack();
    }
  }

  if (address) await updateSession(from, { delivery_address: address });
  return await showDatePicker(from);
}

async function finishAddress(
  from: string,
  session: WhatsAppSession | { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null },
  address: string,
) {
  if (!address || address.length < 5) {
    await updateSession(from, { state: "picking_address" });
    await sendText(from, buildAddressPrompt(langOf(from)));
    return ack();
  }

  await updateSession(from, { delivery_address: address, state: "awaiting_payment" });
  const dateStr = session.delivery_date ? dateLabel(session.delivery_date) : "To be confirmed";
  const summary = buildOrderSummaryMessage(
    session.cart,
    dateStr,
    session.delivery_slot_kind || "lunch",
    address,
    langOf(from),
  );
  return await showSummaryButtons(from, session.cart, summary);
}

async function showSummaryButtons(from: string, cart: CartItem[], summary: string) {
  const total = cartGrandTotal(cart);
  const overLimit = !isCodAllowedForTotal(total);
  const body = overLimit ? `${summary}\n\n${buildCodOverLimitMention(langOf(from))}` : summary;
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
  await sendButtons(from, body, buttons);
  return ack();
}

async function offerPayOrConfirm(from: string, session: WhatsAppSession) {
  const total = cartGrandTotal(session.cart);
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
  const total = cartGrandTotal(session.cart);
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
        { id: "hs_language", title: BTN.language },
      ]
    : [
        { id: "hs_your_orders", title: BTN.yourOrders },
        { id: "hs_call", title: BTN.callUs },
        { id: "hs_language", title: BTN.language },
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
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(5);

  const active = ((orders || []) as OrderRow[]).filter(
    (o) => !["delivered", "cancelled", "rejected"].includes(o.status),
  );

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
    .eq("phone_number", from)
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
    .eq("phone_number", from)
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
  items: { product_retailer_id?: string; quantity?: number }[],
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

  // Packaging + delivery + GST included, so the row, the Razorpay link, and the
  // quote the customer already accepted are all the same number.
  const total = cartGrandTotal(session.cart);
  const serverDb = createServerSupabase();

  if (paymentMethod === "cod") {
    const blocked = await isCodBlocked(serverDb, from).catch(() => false);
    if (blocked || !isCodAllowedForTotal(total)) {
      await sendText(from, buildCodOverLimitReply(total, lang, blocked));
      return await processConfirmOrder(from, session, "online");
    }
  }

  const slotKind = (session.delivery_slot_kind || "lunch") as DeliverySlotKind;
  const deliverySlotIso = session.delivery_date
    ? slotStartIsoFor(session.delivery_date, slotKind)
    : new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

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
  }

  await resetSession(from);

  const ref = shortRef(order.id, order.order_number);

  if (paymentMethod === "cod") {
    const marked = await markOrderPaidAndNotify(serverDb, order.id, null);
    if (!marked.ok) {
      console.error("[WA] COD mark paid failed:", marked.error);
      await sendText(from, buildCodPlacedMessage(ref, formatInr(total), lang));
    }
    return ack();
  }

  const { short_url, id: paymentLinkId } = await createPaymentLink(total, order.id, "WhatsApp Customer", from);
  if (paymentLinkId) {
    await serverDb.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", order.id);
  }

  await sendCtaUrl(from, buildPaymentMessage(total, short_url, lang), short_url, BTN.payNow);
  await sendText(from, buildOrderIdPendingPaymentMessage(ref, lang));

  return ack();
}

async function hasActiveOrder(phone: string): Promise<boolean> {
  try {
    const db = createServerSupabase();
    const { data, error } = await db
      .from("orders")
      .select("id, status")
      .eq("phone_number", phone)
      .limit(20);
    if (error) return false;
    return ((data || []) as { id: string; status: string }[]).some(
      (o) => !["delivered", "cancelled", "rejected"].includes(o.status),
    );
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
      .eq("phone_number", phone)
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
