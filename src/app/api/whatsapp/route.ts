import { NextResponse, after } from "next/server";
import { VidyaAgent, type MenuItem, type Message } from "@/lib/ai/agent";
import { publicSiteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { decodeOrderRatingButtonId } from "@/lib/whatsapp-order-notify";
import { saveOrderRatingByPhone } from "@/lib/order-rating";
import { createPaymentLink } from "@/lib/payments";
import {
  istCalendarYmd,
  istAddCalendarDays,
  slotStartIsoFor,
  isSlotBookable,
  isValidSlotKind,
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import { sendText, sendButtons, sendCtaUrl, sendList, sendCarousel, sendProductList } from "@/lib/whatsapp-send";
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
  buildWelcomeMessage,
  welcomeLogoImageUrl,
  buildCategoryListBody,
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
  buildPwaPromoBody,
  helpAndSupportReply,
  callUsDialReply,
  ratingThanksReply,
  aiFollowupPrompt,
  ORDER_CUTOFF_REMINDER,
  WA_CART_MAX,
  buildAppNudgeFooter,
} from "@/lib/whatsapp-copy";
import { AGAINST_ORDER_CATEGORIES } from "@/lib/menu/against-order";
import { staticMenuItems, staticMenuByCategory } from "@/lib/menu/whatsapp-menu";
import { createAutoLoginToken } from "@/lib/wa-auto-login";
import { detectAndRememberWaLang, langForPhone, type WaLang } from "@/lib/whatsapp-lang";
import {
  fetchLastAddressAndSlot,
  fetchLastOrderSnapshot,
  nextBookableDateForKind,
} from "@/lib/whatsapp-last-order";
import { isCodAllowedForTotal } from "@/lib/cod-policy";
import { isCodBlocked, markOrderPaidAndNotify } from "@/lib/order-transition";
import { PaymentStatus } from "@/lib/order-status";
import {
  whatsappCatalogId,
  catalogProductIdsForRetailer,
  parseCatalogProductId,
  retailerIdForCsvPrefix,
  guessRetailerId,
  publicDishImageUrl,
  CATEGORY_CAROUSEL_IMAGES,
} from "@/lib/whatsapp-catalog";

/**
 * WhatsApp webhook — tap-first lite checkout (Meta primary, Twilio fallback).
 * States: idle → browsing_category → picking_item → picking_variant → picking_qty
 *       → cart_review → confirming_last → picking_date → picking_slot → picking_address
 *       → picking_pay_method → awaiting_payment
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
    if (!interactiveReplyId) detectAndRememberWaLang(from, text);

    const isGreeting = /^(hi|hello|hey|namaste|vanakkam|start|restart)\b/i.test(text);
    const isMenuCmd = /^(menu|browse|show menu|full menu|browse_menu|view_menu)\b/i.test(lower);
    const isCartCmd = /^(cart|my cart|view cart)\b/i.test(lower);
    const isHelpCmd = /^(help|support|help & support|help_support)\b/i.test(lower);
    const isTrackCmd = /^(track|order status|where is my order|my order)\b/i.test(lower);
    const isCallCmd = /^(call|call us|phone)\b/i.test(lower);
    const isAppCmd = /^(app|open app|pwa|install|install app|install_app)\b/i.test(lower);

    if (isGreeting) {
      return await showWelcome(from, profileName);
    }

    after(() => {
      void trackWhatsAppUser(from, profileName?.trim() || "WhatsApp User");
    });

    const session = await getSession(from);

    const resolvedId = await resolveNumbered(from, text);
    if (resolvedId) {
      const dec = decodeOrderRatingButtonId(resolvedId);
      if (dec) {
        const supa = createServerSupabase();
        const r = await saveOrderRatingByPhone(supa, dec.orderId, dec.stars, from);
        if (r.ok) {
          try {
            await updateSession(from, { pending_options: null });
          } catch {
            /* non-critical */
          }
        }
        await sendText(from, r.ok ? ratingThanksReply(langOf(from)) : "Could not save your rating. Please try again.");
        return ack();
      }
    }

    if (catalogProductItems?.length) {
      return await handleCatalogOrder(from, catalogProductItems);
    }

    if (interactiveReplyId) {
      const handled = await handleResolvedId(from, interactiveReplyId, session, profileName);
      if (handled) return handled;
    }

    if (resolvedId) {
      const handled = await handleResolvedId(from, resolvedId, session, profileName);
      if (handled) return handled;
    }

    if (isMenuCmd) {
      await resetSession(from);
      return await showCategoryBrowser(from);
    }
    if (isCartCmd) {
      return await showCart(from, session.cart);
    }
    if (isHelpCmd) {
      return await showHelpSupport(from);
    }
    if (isTrackCmd) {
      return await showTrackOrder(from);
    }
    if (isCallCmd) {
      await sendText(from, callUsDialReply());
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
    case "browse_menu":
    case "view_menu":
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
        await sendText(from, langOf(from) === "tanglish" ? "Cart empty. Munna menu." : "Your cart is empty. Browse the menu first.");
        return ack();
      }
      return await afterCartReady(from, session);
    case "add_more":
      return await showCategoryBrowser(from);
    case "clear_cart":
      await updateSession(from, { cart: [], state: "idle" });
      await sendText(from, langOf(from) === "tanglish" ? "Cart clear. *Hi* solunga." : "Cart cleared. Type *hi* to start again.");
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
      await sendText(from, callUsDialReply());
      return ack();
    case "hs_complaint":
      await updateSession(from, { state: "ai_chat" });
      await sendText(
        from,
        langOf(from) === "tanglish"
          ? "Enna aachu solunga — food, late, wrong item. Naan paakkuren."
          : "Tell us what happened — food, late, wrong item. I'll sort it or loop in the team.",
      );
      return ack();
    case "hs_your_orders":
      return await showOrderHistory(from);
    case "hs_payments":
      return await showPaymentsSummary(from);
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

  await sendText(from, langOf(from) === "tanglish" ? "1, 2, illa 3 — chicken, mutton, egg." : "Reply 1, 2, or 3 — or tap a category.");
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

  await sendText(from, langOf(from) === "tanglish" ? "List-la dish pick pannunga." : "Pick a dish from the list.");
  return ack();
}

async function handlePickingVariant(from: string, text: string, _session: WhatsAppSession) {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);

  let variant: string | null = null;
  if (num === 1 || /500/i.test(lower) || lower === "var_500gm") variant = "500gm";
  else if (num === 2 || /1\s*kg/i.test(lower) || lower === "var_1kg") variant = "1kg";

  const resolvedVar = await resolveNumbered(from, text);
  if (resolvedVar === "var_500gm") variant = "500gm";
  if (resolvedVar === "var_1kg") variant = "1kg";

  if (!variant) {
    await sendText(from, "Tap 500gm or 1kg.");
    return ack();
  }

  return await applyVariant(from, variant);
}

async function handlePickingQty(from: string, text: string, session: WhatsAppSession) {
  let qty = parseInt(text.trim().replace(/^qty_/, ""), 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 10) {
    await sendText(from, langOf(from) === "tanglish" ? "Max 10 per item. 1–3 tap pannunga." : "Max 10 per item. Tap 1, 2, or 3.");
    return ack();
  }
  return await addSelectedItemToCart(from, session, qty);
}

async function handleCartReview(from: string, text: string, session: WhatsAppSession) {
  const num = parseInt(text.trim(), 10);
  const resolved = await resolveNumbered(from, text);

  if (resolved === "checkout" || num === 1) {
    if (session.cart.length === 0) {
      await sendText(from, "Cart is empty. Browse the menu first.");
      return ack();
    }
    return await afterCartReady(from, session);
  }
  if (resolved === "add_more" || num === 2) {
    return await showCategoryBrowser(from);
  }
  if (resolved === "clear_cart" || num === 3) {
    await updateSession(from, { cart: [], state: "idle" });
    await sendText(from, "Cart cleared.");
    return ack();
  }

  await sendText(from, langOf(from) === "tanglish" ? "Checkout, Add more, illa Clear tap pannunga." : "Tap Checkout, Add more, or Clear cart.");
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
  await sendText(from, langOf(from) === "tanglish" ? "Same last time, Change, illa Edit cart." : "Tap Same last time, Change, or Edit cart.");
  return ack();
}

async function handlePickingDate(from: string, text: string, _session: WhatsAppSession) {
  const date = parseDateInput(text);
  if (!date) {
    await sendText(from, langOf(from) === "tanglish" ? "Date tap pannunga, illa tomorrow/monday type pannunga." : "Tap a date, or type tomorrow / monday.");
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
    await sendText(from, "Tap Breakfast, Lunch, or Dinner.");
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
  await sendText(from, langOf(from) === "tanglish" ? "Pay online, Cash, illa Edit tap pannunga." : "Tap Pay online, Cash, or Edit.");
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

  await sendText(from, langOf(from) === "tanglish" ? "Confirm, Cash, illa Edit tap pannunga." : "Tap a button to pay or edit.");
  return ack();
}

async function handleAiChat(from: string, text: string, profileName: string) {
  const agent = new VidyaAgent();
  const result = await agent.processMessage(text, [] as Message[], from, profileName);

  if (result.reply) {
    await sendText(from, result.reply);
  }

  const buttons = [
    { id: "browse_menu", title: "Menu" },
    { id: "help_support", title: "Help" },
    { id: "back_home", title: "Start over" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, aiFollowupPrompt(langOf(from)), buttons);

  await updateSession(from, { state: "idle" });
  return ack();
}

// ─── Shared Flows ──────────────────────────────────────────────────────────

async function showWelcome(from: string, profileName: string) {
  const firstName = profileName?.trim().split(/\s+/)[0];
  const lang = langOf(from);
  const buttons: { id: string; title: string }[] = [
    { id: "browse_menu", title: "Menu" },
    { id: "install_app", title: "Install app" },
    { id: "help_support", title: "Help" },
  ];

  try {
    await sendButtons(from, buildWelcomeMessage(firstName, "new", lang), buttons, {
      headerImageUrl: welcomeLogoImageUrl(),
    });
    console.log(`[WA] Instant welcome sent to ${from}`);
  } catch (e) {
    console.error("[WA] welcome send failed, text fallback:", e);
    try {
      await sendText(from, buildWelcomeMessage(firstName, "new", lang));
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
  const token = await createAutoLoginToken(from, profileName || "Friend");
  const autoLoginUrl = `${publicSiteOrigin()}?wa_token=${token}`;
  await sendCtaUrl(from, buildPwaPromoBody(langOf(from)), autoLoginUrl, "Open app");
  return ack();
}

async function showCategoryBrowser(from: string) {
  const options = [
    { id: "cat_chicken", title: "Chicken" },
    { id: "cat_mutton", title: "Mutton" },
    { id: "cat_egg", title: "Egg" },
  ];
  try {
    await updateSession(from, {
      state: "browsing_category",
      pending_options: options,
    });
  } catch (e) {
    console.error("[WA] showCategoryBrowser updateSession error:", e);
  }

  const lang = langOf(from);
  const cards = [
    { id: "cat_chicken", title: "Chicken", body: "Gravies, pepper, wings.", imageUrl: CATEGORY_CAROUSEL_IMAGES.chicken, buttonTitle: "Chicken" },
    { id: "cat_mutton", title: "Mutton", body: "Curries, keema, stew.", imageUrl: CATEGORY_CAROUSEL_IMAGES.mutton, buttonTitle: "Mutton" },
    { id: "cat_egg", title: "Egg", body: "Egg curry & chalna.", imageUrl: CATEGORY_CAROUSEL_IMAGES.egg, buttonTitle: "Egg" },
  ];
  const carouselOk = await sendCarousel(from, buildCategoryListBody(lang), cards);
  if (carouselOk) return ack();

  await sendList(from, buildCategoryListBody(lang), "View Menu", [
    {
      title: "Categories",
      rows: [
        { id: "cat_chicken", title: "Chicken", description: "Gravies, pepper, and more" },
        { id: "cat_mutton", title: "Mutton", description: "Curries, keema, stew" },
        { id: "cat_egg", title: "Egg", description: "Egg curries" },
      ],
    },
  ]);
  return ack();
}

async function showCategoryItems(from: string, cat: string) {
  const items = await getMenuByCategory(cat);
  if (items.length === 0) {
    await sendText(from, langOf(from) === "tanglish" ? "Indha category empty. Vera try pannunga." : "Nothing in that category right now. Try another one.");
    return ack();
  }

  const lang = langOf(from);
  const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
  const slice = items.slice(0, 10);
  await storeOptions(from, itemOptions(slice));
  await updateSession(from, { state: "picking_item" });

  const catalogId = whatsappCatalogId();
  if (catalogId) {
    const productIds = slice.flatMap((m) => catalogProductIdsForRetailer(guessRetailerId(m)));
    if (productIds.length > 0) {
      const sent = await sendProductList(from, catalogId, catLabel, buildDishListBody(catLabel, lang), [
        { title: catLabel, productRetailerIds: productIds },
      ]);
      if (sent) return ack();
    }
  }

  if (slice.length >= 2) {
    const cards = slice.map((m) => ({
      id: m.id,
      title: m.name.length > 20 ? `${m.name.slice(0, 17)}...` : m.name,
      body: `${m.name}\n500gm Rs ${m.price} · 1kg Rs ${Math.round(m.price * 1.8)}`.slice(0, 160),
      imageUrl: publicDishImageUrl(m),
      buttonTitle: "Add",
    }));
    const carouselOk = await sendCarousel(from, buildCarouselBody(catLabel, lang), cards);
    if (carouselOk) return ack();
  }

  let body = buildDishListBody(catLabel, lang);
  if (items.length > 10) {
    body += `\n\n_Showing top 10. Full menu with photos in the app._\n${buildAppNudgeFooter(lang)}`;
  }
  const rows = slice.map((m) => ({
    id: m.id,
    title: m.name.length > 24 ? `${m.name.slice(0, 21)}...` : m.name,
    description: `500gm Rs${m.price} / 1kg Rs${Math.round(m.price * 1.8)}`,
  }));
  await sendList(from, body, "Pick Dish", [{ title: catLabel, rows }]);
  return ack();
}

async function showVariantPicker(from: string, item: MenuItem) {
  const lang = langOf(from);
  const buttons = [
    { id: "var_500gm", title: "500gm" },
    { id: "var_1kg", title: "1kg" },
  ];
  await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
  await storeOptions(from, buttons);
  await sendButtons(from, buildVariantMessage(item.name, item.price, lang), buttons, {
    headerImageUrl: publicDishImageUrl(item),
  });
  return ack();
}

async function applyVariant(from: string, variant: string) {
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
    await sendText(from, langOf(from) === "tanglish" ? "Item kedaikala. Menu-la pick pannunga." : "Couldn't find that item. Pick from the menu.");
    await updateSession(from, { state: "idle" });
    return ack();
  }

  const variant = session.selected_variant || "500gm";
  const unitPrice = variant === "1kg" ? Math.round(item.price * 1.8) : item.price;

  const newItem: CartItem = {
    menu_item_id: item.id,
    name: item.name,
    variant,
    quantity: qty,
    unit_price: unitPrice,
  };

  const cart = [...(session.cart || [])];
  const existingIdx = cart.findIndex((c) => c.menu_item_id === item.id && c.variant === variant);
  if (cart.length >= WA_CART_MAX && existingIdx < 0) {
    await sendText(from, buildCartLimitMessage(langOf(from)));
    return ack();
  }

  if (existingIdx >= 0) {
    cart[existingIdx].quantity += qty;
  } else {
    cart.push(newItem);
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
    { id: "checkout", title: "Checkout" },
    { id: "add_more", title: "Add more" },
    { id: "clear_cart", title: "Clear cart" },
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
    const slotLine = last.slotKind
      ? `${last.slotKind.charAt(0).toUpperCase() + last.slotKind.slice(1)} — next free matching slot`
      : null;
    const buttons = [
      { id: "reuse_last", title: "Same last time" },
      { id: "change_slot_addr", title: "Change" },
      { id: "edit_order", title: "Edit cart" },
    ];
    await storeOptions(from, buttons);
    await sendButtons(from, buildReuseLastPrompt(session.cart, last.address, slotLine, langOf(from)), buttons);
    return ack();
  }
  return await showDatePicker(from);
}

async function showDatePicker(from: string) {
  const rows = upcomingDateRows();
  await updateSession(from, { state: "picking_date", pending_options: rows.map((r) => ({ id: r.id, title: r.title })) });
  await sendList(from, buildDatePickerMessage(langOf(from)), "Pick date", [{ title: "Delivery date", rows }]);
  return ack();
}

async function applyDeliveryDate(from: string, ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    await sendText(from, "Tap a date from the list.");
    return ack();
  }
  const buttons = [
    { id: "slot_breakfast", title: "Breakfast" },
    { id: "slot_lunch", title: "Lunch" },
    { id: "slot_dinner", title: "Dinner" },
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
      await sendText(from, `That slot needs 24 hours.\n\n${ORDER_CUTOFF_REMINDER}`);
      return await showDatePicker(from);
    }
  }

  await updateSession(from, { delivery_slot_kind: slotKind, state: "picking_address" });

  const lastAddr = session.delivery_address || (await fetchLastAddressAndSlot(from)).address;
  if (lastAddr) {
    await updateSession(from, { delivery_address: lastAddr });
    const buttons = [
      { id: "reuse_address", title: "Same address" },
      { id: "new_address", title: "New address" },
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

async function finishAddress(from: string, session: WhatsAppSession | { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null }, address: string) {
  if (!address || address.length < 5) {
    await updateSession(from, { state: "picking_address" });
    await sendText(from, buildAddressPrompt(langOf(from)));
    return ack();
  }

  await updateSession(from, { delivery_address: address, state: "awaiting_payment" });
  const dateStr = session.delivery_date ? dateLabel(session.delivery_date) : "TBD";
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
  const buttons = [
    { id: "pay_online", title: "Pay online" },
    { id: "pay_cod", title: "Cash" },
    { id: "edit_order", title: "Edit" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, body, buttons);
  return ack();
}

async function offerPayOrConfirm(from: string, session: WhatsAppSession) {
  const total = cartGrandTotal(session.cart);
  await updateSession(from, { state: "picking_pay_method" });
  const buttons = [
    { id: "pay_online", title: "Pay online" },
    { id: "pay_cod", title: "Cash" },
    { id: "edit_order", title: "Edit" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildPayMethodPrompt(total, langOf(from), { overLimit: !isCodAllowedForTotal(total) }), buttons);
  return ack();
}

async function handlePayCodTap(from: string, session: WhatsAppSession) {
  const total = cartGrandTotal(session.cart);
  const serverDb = createServerSupabase();
  const blocked = await isCodBlocked(serverDb, from).catch(() => false);
  if (blocked || !isCodAllowedForTotal(total)) {
    const buttons = [
      { id: "pay_online", title: "Pay online" },
      { id: "edit_order", title: "Edit" },
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
        { id: "hs_track", title: "Track" },
        { id: "hs_call", title: "Call us" },
        { id: "install_app", title: "Install app" },
      ]
    : [
        { id: "hs_your_orders", title: "Your orders" },
        { id: "hs_call", title: "Call us" },
        { id: "install_app", title: "Install app" },
      ];
  await storeOptions(from, options.slice(0, 3));
  await sendButtons(from, helpAndSupportReply(langOf(from)), options.slice(0, 3));
  return ack();
}

async function showTrackOrder(from: string) {
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, status, created_at, total_amount")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(5);

  type OrderRow = { id: string; status: string; created_at: string; total_amount: number | null };
  const active = ((orders || []) as OrderRow[]).filter((o) => !["delivered", "cancelled", "rejected"].includes(o.status));

  if (!active.length) {
    const buttons = [
      { id: "browse_menu", title: "Menu" },
      { id: "help_support", title: "Help" },
    ];
    await storeOptions(from, buttons);
    await sendButtons(
      from,
      langOf(from) === "tanglish" ? "Active order illa. Menu-la start pannalam." : "No active orders. Tap Menu when you're hungry.",
      buttons,
    );
    return ack();
  }

  const lines = active.map(
    (o: OrderRow, i: number) =>
      `${i + 1}. #${String(o.id).slice(0, 8).toUpperCase()} — *${o.status}* — ₹${o.total_amount ?? "—"}`,
  );

  const buttons = [{ id: "help_support", title: "Help" }, { id: "browse_menu", title: "Menu" }];
  await storeOptions(from, buttons);
  await sendButtons(
    from,
    `*Active orders*\n\n${lines.join("\n")}\n\n_We'll ping you when it moves._`,
    buttons,
  );
  return ack();
}

async function showOrderHistory(from: string) {
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, status, created_at, total_amount")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(8);

  type HistRow = { id: string; status: string; created_at: string; total_amount: number | null };
  if (!orders?.length) {
    await sendText(from, langOf(from) === "tanglish" ? "History illa. Menu tap pannunga." : "No order history yet. Tap Menu for the first one.");
    return ack();
  }

  const lines = (orders as HistRow[]).map(
    (o: HistRow, i: number) =>
      `${i + 1}. #${String(o.id).slice(0, 8).toUpperCase()} — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}`,
  );

  const buttons = [{ id: "browse_menu", title: "Menu" }, { id: "back_home", title: "Home" }];
  await storeOptions(from, buttons);
  await sendButtons(from, `*Your orders*\n\n${lines.join("\n")}`, buttons);
  return ack();
}

async function showPaymentsSummary(from: string) {
  const { data: orders } = await createServerSupabase()
    .from("orders")
    .select("id, status, total_amount, created_at")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(10);

  type PayRow = { id: string; status: string; total_amount: number | null; created_at: string };
  if (!orders?.length) {
    await sendText(from, "No payment history on this number yet.");
    return ack();
  }

  const lines = (orders as PayRow[]).map((o: PayRow) => {
    const short = String(o.id).slice(0, 8).toUpperCase();
    const icon = o.status === "paid" ? "✅" : o.status === "pending_payment" ? "⏳" : "•";
    return `${icon} #${short} — ₹${o.total_amount ?? "—"} — _${o.status}_`;
  });

  const buttons = [{ id: "browse_menu", title: "Menu" }, { id: "back_home", title: "Home" }];
  await storeOptions(from, buttons);
  await sendButtons(from, `*Payments*\n\n${lines.join("\n")}`, buttons);
  return ack();
}

function findMenuItemForCatalogPrefix(menu: MenuItem[], prefix: string): MenuItem | undefined {
  const retailer = retailerIdForCsvPrefix(prefix);
  return menu.find((m) => {
    const rid = guessRetailerId(m);
    return rid === retailer || rid === prefix || m.id === retailer || m.id === prefix;
  });
}

async function handleCatalogOrder(
  from: string,
  items: { product_retailer_id?: string; quantity?: number }[],
) {
  const menu = await getMenu();
  const session = await getSession(from);
  const cart = [...(session.cart || [])];
  let added = 0;

  for (const raw of items) {
    const parsed = parseCatalogProductId(String(raw.product_retailer_id || ""));
    if (!parsed) continue;
    const item = findMenuItemForCatalogPrefix(menu, parsed.prefix);
    if (!item) continue;
    const qty = Math.max(1, Math.min(3, Math.floor(Number(raw.quantity) || 1)));
    const unitPrice = parsed.variant === "1kg" ? Math.round(item.price * 1.8) : item.price;
    const existingIdx = cart.findIndex((c) => c.menu_item_id === item.id && c.variant === parsed.variant);
    if (cart.length >= WA_CART_MAX && existingIdx < 0) break;
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
    await sendText(
      from,
      langOf(from) === "tanglish"
        ? "Adhu dish match aagala. Menu-la card tap pannunga."
        : "Couldn't match that catalog dish. Tap Menu and pick from the cards.",
    );
    return await showCategoryBrowser(from);
  }

  await updateSession(from, {
    cart,
    selected_item_id: null,
    selected_variant: null,
    state: "cart_review",
  });
  return await showCart(from, cart);
}

async function showQuickReorder(from: string) {
  const snap = await fetchLastOrderSnapshot(from);
  if (!snap) {
    await sendText(from, buildReorderEmptyMessage(langOf(from)));
    return ack();
  }

  await updateSession(from, {
    cart: snap.cart,
    delivery_address: snap.address,
    delivery_slot_kind: snap.slotKind,
    state: "confirming_last",
  });

  const slotLine = snap.slotKind
    ? `${snap.slotKind.charAt(0).toUpperCase() + snap.slotKind.slice(1)} — next free matching slot`
    : null;
  const buttons = [
    { id: "reuse_last", title: "Same last time" },
    { id: "change_slot_addr", title: "Change" },
    { id: "edit_order", title: "Edit cart" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, buildReuseLastPrompt(snap.cart, snap.address, slotLine, langOf(from)), buttons);
  return ack();
}

async function processConfirmOrder(
  from: string,
  session: { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null; delivery_address: string | null },
  paymentMethod: "online" | "cod" = "online",
) {
  if (session.cart.length === 0) {
    await sendText(from, langOf(from) === "tanglish" ? "Cart empty. Menu munna." : "Cart is empty. Browse the menu first.");
    return ack();
  }

  // Packaging + delivery + GST included, so the row, the Razorpay link, and the
  // quote the customer already accepted are all the same number.
  const total = cartGrandTotal(session.cart);
  const serverDb = createServerSupabase();

  if (paymentMethod === "cod") {
    const blocked = await isCodBlocked(serverDb, from).catch(() => false);
    if (blocked || !isCodAllowedForTotal(total)) {
      await sendText(
        from,
        langOf(from) === "tanglish"
          ? "Cash this order-ku illa. Pay online tap pannunga."
          : "Cash isn't available on this order. Please pay online.",
      );
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
    await sendText(from, langOf(from) === "tanglish" ? "Order create aagala. Try again." : "Could not create your order. Please try again.");
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

  const shortId = String(order.id).slice(0, 8).toUpperCase();

  if (paymentMethod === "cod") {
    const marked = await markOrderPaidAndNotify(serverDb, order.id, null);
    if (!marked.ok) {
      console.error("[WA] COD mark paid failed:", marked.error);
      await sendText(
        from,
        langOf(from) === "tanglish"
          ? `Order #${shortId} in — cash door-la. Kitchen-ku theriyum.`
          : `Order #${shortId} is in. Pay cash at the door. Kitchen's been told.`,
      );
    }
    return ack();
  }

  const { short_url, id: paymentLinkId } = await createPaymentLink(total, order.id, "WhatsApp Customer", from);
  if (paymentLinkId) {
    await serverDb.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", order.id);
  }

  await sendCtaUrl(from, buildPaymentMessage(total, short_url, langOf(from)), short_url, "Pay now");
  await sendText(from, buildOrderIdPendingPaymentMessage(shortId, langOf(from)));

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
    return ((data || []) as { id: string; status: string }[]).some((o) => !["delivered", "cancelled", "rejected"].includes(o.status));
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

  return new Response("WhatsApp webhook — Vidya's Kitchen lite checkout", { status: 200 });
}
