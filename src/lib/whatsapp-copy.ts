/**
 * WhatsApp copy — English bot (fun, no emoji) + Tanglish order notifications.
 */

import { publicSiteOrigin } from "./site-url";
import { type CartItem, cartTotal } from "./whatsapp-session";

export const SUPPORT_PHONE_E164 = "+919384020119";
export const SUPPORT_EMAIL = "hello.vidyaskitchen@gmail.com";
export const WA_CART_MAX = 3;

export const ORDER_CUTOFF_REMINDER =
  "_We cook fresh — please order at least 24 hours before delivery. No rush orders, only love._";

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
    `Hey ${name}!`,
    ``,
    `Hungry thoughts detected. You've reached *Vidya's Kitchen* — Sivakasi's home-style gourmet kitchen.`,
    ``,
    `Chicken, mutton, and egg specials. Cooked fresh, against order only. No shortcuts, no sad reheats.`,
    ``,
    ORDER_CUTOFF_REMINDER,
    ``,
    `_Pick an option below._`,
  ].join("\n");
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function buildCategoryListBody(): string {
  return [
    `*What's on the menu?*`,
    ``,
    `Tap the button below and pick a category.`,
    ``,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildCategoryMessage(): string {
  return [
    `*Pick a category:*`,
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
    `Tap below to pick a dish.`,
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
    `Pick a size:`,
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
    return `Your cart is empty. Browse the menu to add something tasty.`;
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
    lines.push(`_WhatsApp cart is limited to ${WA_CART_MAX} items. Use the app for a bigger order._`);
  }

  return lines.join("\n");
}

export function buildCartLimitMessage(): string {
  return [
    `Your WhatsApp cart is full (${WA_CART_MAX} items max here).`,
    ``,
    `Open the app for unlimited items, photos, and live tracking.`,
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
    `*When should we deliver?*`,
    ``,
    ...dates,
    ``,
    `_Reply with a number, or type "tomorrow" / "monday"._`,
  ].join("\n");
}

export function buildSlotPickerMessage(dateStr: string): string {
  return [
    `*${dateStr} — pick a slot:*`,
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
    `Where in Sivakasi should we bring your food?`,
    `Send the full address (area, landmark, etc.)`,
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
    `*Time to pay*`,
    ``,
    `Amount: *Rs ${total}*`,
    ``,
    `Pay via Razorpay (UPI, card, or net banking):`,
    paymentUrl,
    ``,
    `_We confirm your order as soon as payment goes through._`,
    buildAppNudgeFooter(),
  ].join("\n");
}

export function buildOrderIdPendingPaymentMessage(shortId: string): string {
  return [
    `_Order ID: #${shortId}_`,
    ``,
    `_We confirm your order as soon as payment goes through._`,
  ].join("\n");
}

export function buildReorderEmptyMessage(): string {
  return "Couldn't find your past items. _Type *menu* to browse fresh._";
}

// ─── Order Status Notifications (Tanglish, no emoji) ─────────────────────────

export function notifyOrderPaid(shortId: string, slotLine?: string): string {
  return [
    `*Order confirm aayiduchu!* (#${shortId})`,
    ``,
    slotLine ? `*Slot:* ${slotLine}` : "",
    slotLine ? `` : "",
    `Payment vandhuruchu. Kitchen prepare pannum soon.`,
    `Relax pannunga — update pannren.`,
  ].filter((l) => l !== "").join("\n");
}

export function notifyOrderAccepted(shortId: string, slotLine?: string): string {
  return [
    `*Order accept pannitom!* (#${shortId})`,
    ``,
    slotLine ? `*Slot:* ${slotLine}` : "",
    slotLine ? `` : "",
    `Vidya aunty order-a accept pannirukanga.`,
    `Cancel panna 12 hours munnadi time irukku.`,
  ].filter((l) => l !== "").join("\n");
}

export function notifyOrderPreparing(): string {
  return `*Kitchen-la start panrom!*\n\nUnga order prepare aagudhu. Fresh-a varum — konjam wait pannunga.`;
}

export function notifyOrderOutForDelivery(): string {
  return `*Driver varraar!*\n\nOrder eduthutu varanga. Track panna app open pannunga.`;
}

export function notifyOrderDelivered(): string {
  return [
    `*Delivered!* Enjoy your meal.`,
    ``,
    `Eppadi irundhudhu? Rate pannunga:`,
    ``,
    `1. Semma`,
    `2. Nalla irundhuchu`,
    `3. Ok ok`,
    `4. Improve pannalaam`,
    `5. Not great`,
    ``,
    `_Number reply pannunga._`,
  ].join("\n");
}

export function notifyOrderCancelled(shortId: string): string {
  return `Order *#${shortId}* cancel aayiduchu.\n\nProblem irundha reply pannunga — help panrom.`;
}

export function notifyOrderRejected(shortId: string, amtStr: string): string {
  return [
    `Sorry, order *#${shortId}* accept panna mudiyala.`,
    ``,
    `*${amtStr}* full refund initiate pannurom — 5-7 working days.`,
    ``,
    `Inconvenience-ku sorry. Vera help venum-na sollunga.`,
  ].join("\n");
}

// ─── Help & Support ──────────────────────────────────────────────────────────

export function helpAndSupportReply(): string {
  return [
    `*Help & Support*`,
    ``,
    `I'm the Vidya's Kitchen assistant.`,
    `I can help with menu, orders, and tracking.`,
    ``,
    `Need a human? Pick an option below.`,
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
  const lines: string[] = [`*Order again*`, ``, `Last time you ordered:`, ``];

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
    `Full menu with photos, easy cart, live tracking, and order history.`,
    `No download — works in your browser.`,
    ``,
    url,
  ].join("\n");
}

export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
