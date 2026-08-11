/**
 * WhatsApp copy — English only, warm and respectful.
 */

import { publicSiteOrigin } from "./site-url";
import { type CartItem, cartTotal } from "./whatsapp-session";

export const SUPPORT_PHONE_E164 = "+919384020119";
export const SUPPORT_EMAIL = "hello.vidyaskitchen@gmail.com";
export const WA_CART_MAX = 3;

export const ORDER_CUTOFF_REMINDER =
  "_We cook fresh — please order at least 24 hours before delivery. We do not accept rush orders._";

export function buildAppNudgeFooter(): string {
  return "_For photos, deals, and the full menu, tap Open App or visit vidyaskitchenhome.com_";
}

export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png?v=2`;
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function buildWelcomeMessage(firstName?: string): string {
  const name = firstName ? `*${firstName}*` : "there";
  return [
    `Hello ${name}!`,
    ``,
    `Welcome to *Vidya's Kitchen* — Sivakasi's home-style gourmet kitchen.`,
    ``,
    `We serve chicken, mutton, and egg specials, cooked fresh against order. Every dish is made with care — no shortcuts.`,
    ``,
    ORDER_CUTOFF_REMINDER,
    ``,
    `_Please choose an option below._`,
  ].join("\n");
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function buildCategoryListBody(): string {
  return [
    `*What's on the menu?*`,
    ``,
    `Tap the button below and choose a category.`,
    ``,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildCategoryMessage(): string {
  return [
    `*Choose a category:*`,
    ``,
    `1. Chicken`,
    `2. Mutton`,
    `3. Egg`,
    ``,
    `_Reply with the number._`,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildDishListBody(categoryLabel: string): string {
  return [
    `*${categoryLabel} specials*`,
    `(Prices shown: 500gm / 1kg)`,
    ``,
    `Tap below to choose a dish.`,
  ].join("\n");
}

export function buildMenuMessage(
  items: { name: string; price: number; category?: string }[],
): string {
  const categories = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  }

  const lines: string[] = [`*Vidya's Kitchen Menu*`, ``];

  for (const [cat, catItems] of categories) {
    lines.push(`*${cat.charAt(0).toUpperCase() + cat.slice(1)}*`);
    for (const item of catItems) {
      lines.push(`  ${item.name}`);
      lines.push(`  _500gm Rs ${item.price} · 1kg Rs ${Math.round(item.price * 1.8)}_`);
    }
    lines.push(``);
  }

  lines.push(ORDER_CUTOFF_REMINDER);
  lines.push(`_Sivakasi delivery only._`);
  lines.push(`_Reply with a dish name to order._`);

  return lines.join("\n");
}

// ─── Item Variants ───────────────────────────────────────────────────────────

export function buildVariantMessage(itemName: string, price500gm: number): string {
  const price1kg = Math.round(price500gm * 1.8);
  return [
    `*${itemName}*`,
    ``,
    `Please choose a size:`,
    ``,
    `1. 500gm — *Rs ${price500gm}*`,
    `2. 1kg — *Rs ${price1kg}*`,
    ``,
    `_Reply with 1 or 2._`,
  ].join("\n");
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export function buildCartMessage(cart: CartItem[]): string {
  if (cart.length === 0) {
    return `Your cart is empty. Please browse the menu to add items.`;
  }

  const lines: string[] = [`*Your cart*`, ``];

  cart.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} (${item.variant})`);
    lines.push(`   ${item.quantity}x — Rs ${item.unit_price * item.quantity}`);
  });

  lines.push(``);
  lines.push(`*Total: Rs ${cartTotal(cart)}*`);
  lines.push(``);
  lines.push(`1. Checkout`);
  lines.push(`2. Add more`);
  lines.push(`3. Clear cart`);
  lines.push(``);
  lines.push(`_Reply with a number._`);

  if (cart.length >= WA_CART_MAX) {
    lines.push(``);
    lines.push(`_WhatsApp cart is limited to ${WA_CART_MAX} items. Please use the app for larger orders._`);
  }

  return lines.join("\n");
}

export function buildCartLimitMessage(): string {
  return [
    `Your WhatsApp cart is full (${WA_CART_MAX} items maximum here).`,
    ``,
    `Please open the app for unlimited items, photos, and live tracking.`,
    ``,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildItemAddedMessage(name: string, variant: string, qty: number): string {
  return `Added *${name}* (${variant}) x ${qty} to your cart.`;
}

// ─── Delivery Slot ───────────────────────────────────────────────────────────

export function buildDatePickerMessage(): string {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
    dates.push(`${i}. ${label}`);
  }

  return [
    `*When would you like delivery?*`,
    ``,
    ...dates,
    ``,
    `_Reply with a number, or type "tomorrow" or "monday"._`,
  ].join("\n");
}

export function buildSlotPickerMessage(dateStr: string): string {
  return [
    `*${dateStr} — please choose a slot:*`,
    ``,
    `1. Breakfast (8am – 10am)`,
    `2. Lunch (12pm – 2pm)`,
    `3. Dinner (7pm – 9pm)`,
    ``,
    `_Reply with 1, 2, or 3._`,
  ].join("\n");
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function buildAddressPrompt(): string {
  return [
    `*Delivery address*`,
    ``,
    `Where in Sivakasi should we deliver your order?`,
    `Please send the full address (area, landmark, and so on).`,
    ``,
    `_Example: 42, Gandhi Nagar, near Sivakasi bus stand_`,
  ].join("\n");
}

// ─── Order Summary ───────────────────────────────────────────────────────────

export function buildOrderSummaryMessage(
  cart: CartItem[],
  dateStr: string,
  slotKind: string,
  address: string,
): string {
  const total = cartTotal(cart);
  const lines: string[] = [`*Order summary*`, ``];

  cart.forEach((item) => {
    lines.push(`${item.name} (${item.variant}) x ${item.quantity} — Rs ${item.unit_price * item.quantity}`);
  });

  lines.push(``);
  lines.push(`*Total: Rs ${total}*`);
  lines.push(``);
  lines.push(`*${dateStr} · ${slotKind.charAt(0).toUpperCase() + slotKind.slice(1)}*`);
  lines.push(`${address}`);
  lines.push(``);
  lines.push(`Tap *Confirm & Pay* or edit your order.`);

  return lines.join("\n");
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function buildPaymentMessage(total: number, paymentUrl: string): string {
  return [
    `*Payment*`,
    ``,
    `Amount: *Rs ${total}*`,
    ``,
    `Please pay via Razorpay (UPI, card, or net banking):`,
    paymentUrl,
    ``,
    `_We will confirm your order as soon as payment is received._`,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildOrderIdPendingPaymentMessage(shortId: string): string {
  return [
    `_Order ID: #${shortId}_`,
    ``,
    `_We will confirm your order as soon as payment is received._`,
  ].join("\n");
}

export function buildReorderEmptyMessage(): string {
  return "We could not find your past items. _Type *menu* to browse the menu._";
}

// ─── Order Status Notifications ──────────────────────────────────────────────

export function notifyOrderPaid(shortId: string, slotLine?: string): string {
  return [
    `*Order confirmed* (#${shortId})`,
    ``,
    slotLine ? `*Delivery slot:* ${slotLine}` : "",
    slotLine ? `` : "",
    `Thank you — we have received your payment. Our kitchen will begin preparing your order shortly.`,
    `We will keep you updated on the status.`,
  ].filter((l) => l !== "").join("\n");
}

export function notifyOrderAccepted(shortId: string, slotLine?: string): string {
  return [
    `*Order accepted* (#${shortId})`,
    ``,
    slotLine ? `*Delivery slot:* ${slotLine}` : "",
    slotLine ? `` : "",
    `Your order has been accepted by our kitchen.`,
    `If you need to cancel, please do so at least 12 hours before your delivery slot.`,
  ].filter((l) => l !== "").join("\n");
}

export function notifyOrderPreparing(): string {
  return [
    `*Preparation started*`,
    ``,
    `Your order is now being prepared in our kitchen. Thank you for your patience — it will be worth the wait.`,
  ].join("\n");
}

export function notifyOrderOutForDelivery(): string {
  return [
    `*Out for delivery*`,
    ``,
    `Your order is on its way. You can track it in the app.`,
  ].join("\n");
}

export function notifyOrderDelivered(): string {
  return [
    `*Delivered*`,
    ``,
    `We hope you enjoy your meal. We would appreciate your feedback:`,
    ``,
    `1. Excellent`,
    `2. Good`,
    `3. Okay`,
    `4. Could be better`,
    `5. Not satisfied`,
    ``,
    `_Please reply with a number._`,
  ].join("\n");
}

export function notifyOrderCancelled(shortId: string): string {
  return [
    `Order *#${shortId}* has been cancelled.`,
    ``,
    `If you have any questions, please reply and we will be happy to help.`,
  ].join("\n");
}

export function notifyOrderRejected(shortId: string, amtStr: string): string {
  return [
    `We are sorry — we were unable to accept order *#${shortId}*.`,
    ``,
    `A full refund of *${amtStr}* has been initiated and should reach you within 5–7 working days.`,
    ``,
    `We apologise for the inconvenience. Please let us know if we can assist you further.`,
  ].join("\n");
}

// ─── Help & Support ──────────────────────────────────────────────────────────

export function helpAndSupportReply(): string {
  return [
    `*Help & Support*`,
    ``,
    `I am the Vidya's Kitchen assistant.`,
    `I can help with the menu, orders, and tracking.`,
    ``,
    `If you would like to speak with our team, please choose an option below.`,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function callUsDialReply(): string {
  return [
    `*Call us*`,
    ``,
    `${SUPPORT_PHONE_E164}`,
    ``,
    `Email: ${SUPPORT_EMAIL}`,
  ].join("\n");
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

export function buildReorderMessage(items: { name: string; price: number }[]): string {
  const lines: string[] = [`*Order again*`, ``, `Your previous order included:`, ``];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} — Rs ${item.price}`);
  });

  lines.push(``);
  lines.push(`_Reply with a number, or type "menu" for the full list._`);

  return lines.join("\n");
}

// ─── PWA Promo ───────────────────────────────────────────────────────────────

export function buildPwaPromoMessage(phone: string, name: string, autoLoginUrl?: string): string {
  const url = autoLoginUrl || `${publicSiteOrigin()}?phone=${phone}&name=${encodeURIComponent(name)}`;
  return [
    `*Open the Vidya's Kitchen app*`,
    ``,
    `Browse the full menu with photos, manage your cart easily, track orders live, and view your order history.`,
    `No download required — it works in your browser.`,
    ``,
    url,
  ].join("\n");
}

export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
