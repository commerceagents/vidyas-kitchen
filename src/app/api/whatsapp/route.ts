import { NextResponse } from "next/server";
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
  type DeliverySlotKind,
} from "@/lib/delivery-slots";
import {
  sendText,
  sendButtons,
  sendCtaUrl,
  fromWhatsAppFrom,
} from "@/lib/twilio-whatsapp";
import {
  getSession,
  updateSession,
  resetSession,
  cartTotal,
  type CartItem,
  type SessionState,
} from "@/lib/whatsapp-session";
import {
  buildWelcomeMessage,
  buildMenuMessage,
  buildCategoryMessage,
  buildVariantMessage,
  buildCartMessage,
  buildItemAddedMessage,
  buildDatePickerMessage,
  buildSlotPickerMessage,
  buildAddressPrompt,
  buildOrderSummaryMessage,
  buildPaymentMessage,
  buildReorderMessage,
  buildPwaPromoMessage,
  helpAndSupportReply,
  callUsDialReply,
  ORDER_CUTOFF_REMINDER,
} from "@/lib/whatsapp-copy";
import { AGAINST_ORDER_CATEGORIES } from "@/lib/menu/against-order";
import { createAutoLoginToken } from "@/lib/wa-auto-login";

/**
 * TWILIO WHATSAPP WEBHOOK — Full State Machine
 * States: idle -> browsing_category -> picking_item -> picking_variant -> picking_qty
 *       -> cart_review -> picking_date -> picking_slot -> picking_address -> awaiting_payment
 */

function ack() {
  return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });
}

/** Numbered reply resolver - uses session for persistence across serverless instances */
async function storeOptions(phone: string, opts: { id: string; title: string }[]) {
  try {
    await updateSession(phone, { pending_options: opts });
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
  const { data } = await supabase
    .from("menu_items")
    .select("*")
    .in("category", [...AGAINST_ORDER_CATEGORIES])
    .eq("is_available", true)
    .order("price", { ascending: true });
  return (data || []) as MenuItem[];
}

async function getMenuByCategory(cat: string): Promise<MenuItem[]> {
  const { data } = await supabase
    .from("menu_items")
    .select("*")
    .eq("category", cat)
    .eq("is_available", true)
    .order("price", { ascending: true });
  return (data || []) as MenuItem[];
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
  const lower = text.toLowerCase().trim();
  if (lower === "1" || /breakfast/i.test(lower)) return "breakfast";
  if (lower === "2" || /lunch/i.test(lower)) return "lunch";
  if (lower === "3" || /dinner/i.test(lower)) return "dinner";
  return null;
}

/** Build options for items in a category for numbered replies */
function itemOptions(items: MenuItem[]): { id: string; title: string }[] {
  return items.map((m) => ({ id: m.id, title: m.name }));
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let body = "";
    let profileName = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = fromWhatsAppFrom(formData.get("From")?.toString() || "");
      body = formData.get("Body")?.toString() || "";
      profileName = formData.get("ProfileName")?.toString() || "";
    } else {
      const json = await req.json();
      from = fromWhatsAppFrom(json.From || "");
      body = json.Body || "";
      profileName = json.ProfileName || "";
    }

    if (!from || !body) return ack();

    console.log(`[WA] From=${from} Body="${body}" Name=${profileName}`);

    const text = body.trim();
    const lower = text.toLowerCase();
    const session = await getSession(from);

    // ── Global Commands (reset, escape hatches) ─────────────────────────────
    const isGreeting = /^(hi|hello|hey|namaste|vanakkam|start|restart)\b/i.test(text);
    const isMenuCmd = /^(menu|browse|show menu|full menu)\b/i.test(lower);
    const isCartCmd = /^(cart|my cart|view cart)\b/i.test(lower);
    const isHelpCmd = /^(help|support|help & support|help_support)\b/i.test(lower);
    const isTrackCmd = /^(track|order status|where is my order|my order)\b/i.test(lower);
    const isCallCmd = /^(call|call us|phone)\b/i.test(lower);
    const isAppCmd = /^(app|open app|pwa|install)\b/i.test(lower);

    // Upsert customer
    const agent = new VidyaAgent();
    await agent.upsertCustomer(from, profileName?.trim() || "WhatsApp User");

    // ── Rating check (works in any state) ────────────────────────────────
    const resolvedId = await resolveNumbered(from, text);
    if (resolvedId) {
      const dec = decodeOrderRatingButtonId(resolvedId);
      if (dec) {
        const supa = createServerSupabase();
        const r = await saveOrderRatingByPhone(supa, dec.orderId, dec.stars, from);
        await sendText(from, r.ok ? "🙏 Thank you for the rating! Nandri!" : "Rating save aagala, try again please.");
        return ack();
      }
    }

    // ── Greeting → Welcome ──────────────────────────────────────────────
    if (isGreeting) {
      await resetSession(from);
      const firstName = profileName?.trim().split(/\s+/)[0];
      const welcomeText = buildWelcomeMessage(firstName);

      const hasActive = await hasActiveOrder(from);
      const returning = await hasOrders(from);

      const buttons: { id: string; title: string }[] = [
        { id: "browse_menu", title: "Browse Menu" },
      ];
      if (hasActive) {
        buttons.push({ id: "track_order", title: "Track Order" });
      } else if (returning) {
        buttons.push({ id: "quick_reorder", title: "Order Again" });
      } else {
        buttons.push({ id: "open_app", title: "Open App" });
      }
      buttons.push({ id: "help_support", title: "Help & Support" });

      await storeOptions(from, buttons);
      await sendButtons(from, welcomeText, buttons);
      return ack();
    }

    // ── Resolved numbered reply mapping ─────────────────────────────────
    if (resolvedId) {
      const handled = await handleResolvedId(from, resolvedId, session, profileName);
      if (handled) return handled;
    }

    // ── Global escape commands ──────────────────────────────────────────
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
      const token = await createAutoLoginToken(from, profileName || "Friend");
      const autoLoginUrl = `${publicSiteOrigin()}?wa_token=${token}`;
      await sendText(from, buildPwaPromoMessage(from, profileName || "Friend", autoLoginUrl));
      return ack();
    }

    // ── State Machine ───────────────────────────────────────────────────
    switch (session.state) {
      case "idle":
        return await handleIdle(from, text, session, profileName);

      case "browsing_category":
        return await handleBrowsingCategory(from, text, session);

      case "picking_item":
        return await handlePickingItem(from, text, session);

      case "picking_variant":
        return await handlePickingVariant(from, text, session);

      case "picking_qty":
        return await handlePickingQty(from, text, session);

      case "cart_review":
        return await handleCartReview(from, text, session);

      case "picking_date":
        return await handlePickingDate(from, text, session);

      case "picking_slot":
        return await handlePickingSlot(from, text, session);

      case "picking_address":
        return await handlePickingAddress(from, text, session);

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

async function handleResolvedId(from: string, id: string, session: { cart: CartItem[]; state: SessionState; delivery_date: string | null; delivery_slot_kind: string | null; delivery_address: string | null }, profileName: string): Promise<Response | null> {
  switch (id) {
    case "browse_menu":
      return await showCategoryBrowser(from);
    case "track_order":
      return await showTrackOrder(from);
    case "open_app": {
      const token = await createAutoLoginToken(from, profileName || "Friend");
      const autoUrl = `${publicSiteOrigin()}?wa_token=${token}`;
      await sendText(from, buildPwaPromoMessage(from, profileName || "Friend", autoUrl));
      return ack();
    }
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
    case "checkout":
      if (session.cart.length === 0) {
        await sendText(from, "Cart empty-a irukku! Menu browse pannu first. 🛒");
        return ack();
      }
      await updateSession(from, { state: "picking_date" });
      await sendText(from, buildDatePickerMessage());
      return ack();
    case "add_more":
      return await showCategoryBrowser(from);
    case "clear_cart":
      await updateSession(from, { cart: [], state: "idle" });
      await sendText(from, "🗑 Cart clear aayiduchu! Fresh-a start pannalaam.");
      return ack();
    case "confirm_order":
      return await processConfirmOrder(from, session);
    case "edit_order":
      return await showCart(from, session.cart);
    case "back_home":
      await resetSession(from);
      await sendText(from, "_Type *hi* to start fresh!_");
      return ack();
    case "hs_track":
      return await showTrackOrder(from);
    case "hs_call":
      await sendText(from, callUsDialReply());
      return ack();
    case "hs_complaint":
      await updateSession(from, { state: "ai_chat" });
      await sendText(from, "Enna problem? Type pannu, naan paarthukren. 🙏");
      return ack();
    case "hs_your_orders":
      return await showOrderHistory(from);
    case "hs_payments":
      return await showPaymentsSummary(from);
    default:
      return null;
  }
}

async function handleIdle(from: string, text: string, session: { cart: CartItem[] }, profileName: string) {
  const menu = await getMenu();
  const matched = findItemByName(menu, text);

  if (matched) {
    await updateSession(from, { selected_item_id: matched.id, state: "picking_variant" });
    await sendText(from, buildVariantMessage(matched.name, matched.price));
    storeOptions(from, [
      { id: "var_500gm", title: "500gm" },
      { id: "var_1kg", title: "1kg" },
    ]);
    return ack();
  }

  // Fallback to AI chat
  await updateSession(from, { state: "ai_chat" });
  return await handleAiChat(from, text, profileName);
}

async function handleBrowsingCategory(from: string, text: string, session: { cart: CartItem[] }) {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);

  let cat: string | null = null;
  if (num === 1 || /chicken/i.test(lower)) cat = "chicken";
  else if (num === 2 || /mutton/i.test(lower)) cat = "mutton";
  else if (num === 3 || /egg/i.test(lower)) cat = "egg";

  if (cat) {
    return await showCategoryItems(from, cat);
  }

  await sendText(from, "1, 2, or 3 reply pannu — or category name type pannu! 🍽");
  return ack();
}

async function handlePickingItem(from: string, text: string, session: { cart: CartItem[] }) {
  const num = parseInt(text, 10);
  const menu = await getMenu();

  const resolved = await resolveNumbered(from, text);
  const sess = await getSession(from);
  const itemId = resolved || (num > 0 && sess.pending_options ? sess.pending_options[num - 1]?.id : null);

  if (itemId) {
    const item = menu.find((m) => m.id === itemId);
    if (item) {
      await updateSession(from, { selected_item_id: item.id, state: "picking_variant" });
      await sendText(from, buildVariantMessage(item.name, item.price));
      await storeOptions(from, [
        { id: "var_500gm", title: "500gm" },
        { id: "var_1kg", title: "1kg" },
      ]);
      return ack();
    }
  }

  const matched = findItemByName(menu, text);
  if (matched) {
    await updateSession(from, { selected_item_id: matched.id, state: "picking_variant" });
    await sendText(from, buildVariantMessage(matched.name, matched.price));
    await storeOptions(from, [
      { id: "var_500gm", title: "500gm" },
      { id: "var_1kg", title: "1kg" },
    ]);
    return ack();
  }

  await sendText(from, "Dish number or name reply pannu! List-la irundhu choose pannu. 🍛");
  return ack();
}

async function handlePickingVariant(from: string, text: string, session: { cart: CartItem[]; selected_item_id: string | null }) {
  const lower = text.toLowerCase().trim();
  const num = parseInt(text, 10);

  let variant: string | null = null;
  if (num === 1 || /500/i.test(lower) || lower === "var_500gm") variant = "500gm";
  else if (num === 2 || /1\s*kg/i.test(lower) || lower === "var_1kg") variant = "1kg";

  const resolvedVar = await resolveNumbered(from, text);
  if (resolvedVar === "var_500gm") variant = "500gm";
  if (resolvedVar === "var_1kg") variant = "1kg";

  if (!variant) {
    await sendText(from, "1 (500gm) or 2 (1kg) reply pannu! 🍛");
    return ack();
  }

  await updateSession(from, { selected_variant: variant, state: "picking_qty" });
  await sendText(from, `👍 *${variant}* selected! Quantity enna? (1, 2, 3...)\n\n_Default 1, number reply pannu._`);
  return ack();
}

async function handlePickingQty(from: string, text: string, session: { cart: CartItem[]; selected_item_id: string | null; selected_variant: string | null }) {
  let qty = parseInt(text.trim(), 10);
  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 10) {
    await sendText(from, "Maximum 10 per item! Reasonable-a sollu 😅");
    return ack();
  }

  const menu = await getMenu();
  const item = menu.find((m) => m.id === session.selected_item_id);
  if (!item) {
    await sendText(from, "Item kaanala! Menu-la irundhu select pannu.");
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

  const addedMsg = buildItemAddedMessage(item.name, variant, qty);
  await sendText(from, addedMsg);

  // Show cart with options
  return await showCart(from, cart);
}

async function handleCartReview(from: string, text: string, session: { cart: CartItem[] }) {
  const num = parseInt(text.trim(), 10);
  const resolved = await resolveNumbered(from, text);

  if (resolved === "checkout" || num === 1) {
    if (session.cart.length === 0) {
      await sendText(from, "Cart empty! Menu browse pannu first.");
      return ack();
    }
    await updateSession(from, { state: "picking_date" });
    await sendText(from, buildDatePickerMessage());
    return ack();
  }
  if (resolved === "add_more" || num === 2) {
    return await showCategoryBrowser(from);
  }
  if (resolved === "clear_cart" || num === 3) {
    await updateSession(from, { cart: [], state: "idle" });
    await sendText(from, "🗑 Cart clear aayiduchu!");
    return ack();
  }

  await sendText(from, "1 (Checkout), 2 (Add more), or 3 (Clear cart) reply pannu! 🛒");
  return ack();
}

async function handlePickingDate(from: string, text: string, session: { cart: CartItem[] }) {
  const date = parseDateInput(text);
  if (!date) {
    await sendText(from, "Date number (1-5) or day name (tomo, monday) reply pannu! 📅");
    return ack();
  }

  const dateLabel = new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  await updateSession(from, { delivery_date: date, state: "picking_slot" });
  await sendText(from, buildSlotPickerMessage(dateLabel));
  await storeOptions(from, [
    { id: "slot_breakfast", title: "Breakfast" },
    { id: "slot_lunch", title: "Lunch" },
    { id: "slot_dinner", title: "Dinner" },
  ]);
  return ack();
}

async function handlePickingSlot(from: string, text: string, session: { cart: CartItem[]; delivery_date: string | null }) {
  let slotKind: DeliverySlotKind | null = parseSlotInput(text);

  const resolved = await resolveNumbered(from, text);
  if (resolved === "slot_breakfast") slotKind = "breakfast";
  if (resolved === "slot_lunch") slotKind = "lunch";
  if (resolved === "slot_dinner") slotKind = "dinner";

  if (!slotKind) {
    await sendText(from, "1 (Breakfast), 2 (Lunch), or 3 (Dinner) reply pannu! ⏰");
    return ack();
  }

  if (session.delivery_date) {
    const slotIso = slotStartIsoFor(session.delivery_date, slotKind);
    if (!isSlotBookable(slotIso)) {
      await sendText(from, `⚠️ Andha slot-ku minimum 24 hours irukanum!\n\n${ORDER_CUTOFF_REMINDER}\n\nVera date try pannu.`);
      await updateSession(from, { state: "picking_date" });
      await sendText(from, buildDatePickerMessage());
      return ack();
    }
  }

  await updateSession(from, { delivery_slot_kind: slotKind, state: "picking_address" });
  await sendText(from, buildAddressPrompt());
  return ack();
}

async function handlePickingAddress(from: string, text: string, session: { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null }) {
  if (text.length < 5) {
    await sendText(from, "Full address sollu please! (area, landmark, etc.) 📍");
    return ack();
  }

  const address = text.trim();
  await updateSession(from, { delivery_address: address, state: "awaiting_payment" });

  const dateLabel = session.delivery_date
    ? new Date(`${session.delivery_date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : "TBD";

  const summaryMsg = buildOrderSummaryMessage(
    session.cart,
    dateLabel,
    session.delivery_slot_kind || "lunch",
    address,
  );

  await storeOptions(from, [
    { id: "confirm_order", title: "Confirm & Pay" },
    { id: "edit_order", title: "Edit Order" },
  ]);

  await sendButtons(from, summaryMsg, [
    { id: "confirm_order", title: "Confirm & Pay" },
    { id: "edit_order", title: "Edit Order" },
  ]);
  return ack();
}

async function handleAwaitingPayment(from: string, text: string, session: { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null; delivery_address: string | null }) {
  const resolved = await resolveNumbered(from, text);
  const lower = text.toLowerCase().trim();

  if (resolved === "confirm_order" || lower === "1" || /confirm|pay|yes/i.test(lower)) {
    return await processConfirmOrder(from, session);
  }
  if (resolved === "edit_order" || lower === "2" || /edit|change/i.test(lower)) {
    return await showCart(from, session.cart);
  }

  await sendText(from, "1 (Confirm & Pay) or 2 (Edit Order) reply pannu! 📋");
  return ack();
}

async function handleAiChat(from: string, text: string, profileName: string) {
  const agent = new VidyaAgent();
  const result = await agent.processMessage(text, [] as Message[], from, profileName);

  if (result.reply) {
    await sendText(from, result.reply);
  }

  const buttons = [
    { id: "browse_menu", title: "Browse Menu" },
    { id: "help_support", title: "Help & Support" },
    { id: "back_home", title: "Start Over" },
  ];
  await storeOptions(from, buttons);
  await sendButtons(from, "_Vera enna help venum?_", buttons);

  await updateSession(from, { state: "idle" });
  return ack();
}

// ─── Shared Flows ──────────────────────────────────────────────────────────

async function showCategoryBrowser(from: string) {
  try {
    await updateSession(from, { state: "browsing_category" });
  } catch (e) {
    console.error("[WA] showCategoryBrowser updateSession error:", e);
  }
  try {
    await updateSession(from, { pending_options: [
      { id: "cat_chicken", title: "Chicken" },
      { id: "cat_mutton", title: "Mutton" },
      { id: "cat_egg", title: "Egg" },
    ] });
  } catch (e) {
    console.error("[WA] storeOptions error (non-critical):", e);
  }
  await sendText(from, buildCategoryMessage());
  return ack();
}

async function showCategoryItems(from: string, cat: string) {
  const items = await getMenuByCategory(cat);
  if (items.length === 0) {
    await sendText(from, "Andha category-la items illai right now! Vera category try pannu.");
    return ack();
  }

  const emojiMap: Record<string, string> = { chicken: "🍗", mutton: "🐑", egg: "🥚" };
  const emoji = emojiMap[cat] || "🍽";
  const lines = items.map((m, i) => `${i + 1}. ${m.name}\n   _500gm — ₹${m.price} · 1kg — ₹${Math.round(m.price * 1.8)}_`);

  const msg = [
    `${emoji} *${cat.charAt(0).toUpperCase() + cat.slice(1)} Specials*`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
    ...lines,
    ``,
    `_Dish number or name reply pannu!_`,
  ].join("\n");

  await storeOptions(from, itemOptions(items));
  await updateSession(from, { state: "picking_item" });
  await sendText(from, msg);
  return ack();
}

async function showCart(from: string, cart: CartItem[]) {
  await updateSession(from, { state: "cart_review" });
  const msg = buildCartMessage(cart);
  await storeOptions(from, [
    { id: "checkout", title: "Checkout" },
    { id: "add_more", title: "Add More" },
    { id: "clear_cart", title: "Clear Cart" },
  ]);
  await sendText(from, msg);
  return ack();
}

async function showHelpSupport(from: string) {
  const hasActive = await hasActiveOrder(from);
  const options: { id: string; title: string }[] = [];
  if (hasActive) options.push({ id: "hs_track", title: "Track Order" });
  options.push(
    { id: "hs_your_orders", title: "Your Orders" },
    { id: "hs_call", title: "Call Us" },
    { id: "hs_complaint", title: "Raise Complaint" },
    { id: "hs_payments", title: "Payments" },
  );
  await storeOptions(from, options);
  await sendButtons(from, helpAndSupportReply(), options);
  return ack();
}

async function showTrackOrder(from: string) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, created_at, total_amount")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(5);

  type OrderRow = { id: string; status: string; created_at: string; total_amount: number | null };
  const active = ((orders || []) as OrderRow[]).filter((o) => !["delivered", "cancelled"].includes(o.status));

  if (!active.length) {
    await sendText(from, "📦 Active orders onnum illai! Order panna menu browse pannu.\n\n_Type *menu* to browse._");
    return ack();
  }

  const lines = active.map(
    (o: OrderRow, i: number) =>
      `${i + 1}. #${String(o.id).slice(0, 8).toUpperCase()} — *${o.status}* — ₹${o.total_amount ?? "—"}`,
  );

  await sendText(from, `📦 *Active Orders*\n\n${lines.join("\n")}\n\n_Status update varum, wait pannu! 🙌_`);
  return ack();
}

async function showOrderHistory(from: string) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, created_at, total_amount")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(8);

  type HistRow = { id: string; status: string; created_at: string; total_amount: number | null };
  if (!orders?.length) {
    await sendText(from, "📋 Orders history illai. First order pannu! _Type *menu* to browse._");
    return ack();
  }

  const lines = (orders as HistRow[]).map(
    (o: HistRow, i: number) =>
      `${i + 1}. #${String(o.id).slice(0, 8).toUpperCase()} — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}`,
  );

  const buttons = [{ id: "browse_menu", title: "Browse Menu" }, { id: "back_home", title: "Home" }];
  await storeOptions(from, buttons);
  await sendButtons(from, `📋 *Your Orders*\n\n${lines.join("\n")}`, buttons);
  return ack();
}

async function showPaymentsSummary(from: string) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(10);

  type PayRow = { id: string; status: string; total_amount: number | null; created_at: string };
  if (!orders?.length) {
    await sendText(from, "💳 Payment history illai.");
    return ack();
  }

  const lines = (orders as PayRow[]).map((o: PayRow) => {
    const short = String(o.id).slice(0, 8).toUpperCase();
    const icon = o.status === "paid" ? "✅" : o.status === "pending_payment" ? "⏳" : "•";
    return `${icon} #${short} — ₹${o.total_amount ?? "—"} — _${o.status}_`;
  });

  const buttons = [{ id: "browse_menu", title: "Browse Menu" }, { id: "back_home", title: "Home" }];
  await storeOptions(from, buttons);
  await sendButtons(from, `💳 *Payments*\n\n${lines.join("\n")}`, buttons);
  return ack();
}

async function showQuickReorder(from: string) {
  const { data: pastOrders } = await supabase
    .from("orders")
    .select("*, order_items(menu_items(*))")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!pastOrders?.length) {
    await sendText(from, "Past orders illai! Fresh-a start pannalaam. _Type *menu*._");
    return ack();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (pastOrders as any[])
    .flatMap((o: any) => ((o.order_items as any[]) || []).map((oi: any) => oi.menu_items))
    .filter(Boolean) as { id: string; name: string; price: number }[];
  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values()).slice(0, 5);

  if (unique.length === 0) {
    await sendText(from, "Past items kaanala! _Type *menu* to browse fresh._");
    return ack();
  }

  const reorderItems = unique.map((m) => ({ name: m.name, price: m.price }));
  const opts = unique.map((m) => ({ id: m.id, title: m.name }));
  await storeOptions(from, opts);
  await updateSession(from, { state: "picking_item" });
  await sendText(from, buildReorderMessage(reorderItems));
  return ack();
}

async function processConfirmOrder(from: string, session: { cart: CartItem[]; delivery_date: string | null; delivery_slot_kind: string | null; delivery_address: string | null }) {
  if (session.cart.length === 0) {
    await sendText(from, "Cart empty! Menu browse pannu first.");
    return ack();
  }

  const total = cartTotal(session.cart);
  const slotKind = (session.delivery_slot_kind || "lunch") as DeliverySlotKind;
  const deliverySlotIso = session.delivery_date
    ? slotStartIsoFor(session.delivery_date, slotKind)
    : new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  // Create order in Supabase
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      phone_number: from,
      total_amount: total,
      status: "pending_payment",
      delivery_slot: deliverySlotIso,
      delivery_slot_kind: slotKind,
      delivery_address: session.delivery_address,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("[WA] Order create error:", orderError?.message);
    await sendText(from, "Order create panna mudiyala! Try again please. 🙏");
    return ack();
  }

  // Insert order items
  const orderItems = session.cart.map((c) => ({
    order_id: order.id,
    menu_item_id: c.menu_item_id,
    quantity: c.quantity,
    unit_price: c.unit_price,
  }));
  await supabase.from("order_items").insert(orderItems);

  // Create payment link
  const { short_url, id: paymentLinkId } = await createPaymentLink(total, order.id, "WhatsApp Customer", from);
  if (paymentLinkId) {
    await supabase.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", order.id);
  }

  // Reset session
  await resetSession(from);

  // Send payment message
  await sendText(from, buildPaymentMessage(total, short_url));
  await sendText(from, `_Order ID: #${String(order.id).slice(0, 8).toUpperCase()}_\n\n_Payment aana udan, we'll confirm your order!_ ✅`);

  return ack();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function hasActiveOrder(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("orders")
    .select("id, status")
    .eq("phone_number", phone)
    .limit(20);
  return ((data || []) as { id: string; status: string }[]).some((o) => !["delivered", "cancelled"].includes(o.status));
}

async function hasOrders(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("phone_number", phone)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function GET() {
  return new Response("Twilio WhatsApp webhook active — v2 state machine", { status: 200 });
}
