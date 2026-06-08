/**
 * WhatsApp bot copy — Tanglish (Tamil+English) tone with beautiful formatting.
 * Warm, fun, home-chef vibes from Sivakasi.
 */

import { publicSiteOrigin } from "./site-url";
import { type CartItem, cartTotal, cartSummary } from "./whatsapp-session";

export const SUPPORT_PHONE_E164 = "+919384020119";
export const SUPPORT_EMAIL = "hello.vidyaskitchen@gmail.com";

export const ORDER_CUTOFF_REMINDER =
  "_🕐 Fresh-a cook panrom, so minimum 24 hours munnadiye order panunga! Rush illama, love-oda samaipom._";

export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png?v=2`;
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function buildWelcomeMessage(firstName?: string): string {
  const name = firstName ? `*${firstName}*` : "friend";
  return [
    `🙏 Vanakkam ${name}!`,
    ``,
    `Welcome to *Vidya's Kitchen* 🍽`,
    `_Sivakasi's favourite home-style gourmet kitchen_`,
    ``,
    `━━━━━━━━━━━━━━━━━━━`,
    `🍗 Chicken · 🐑 Mutton · 🥚 Egg`,
    `Fresh-a, against-order-a samaikrom!`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
    ORDER_CUTOFF_REMINDER,
    ``,
    `_Enna pananum? Pick one below 👇_`,
  ].join("\n");
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function buildMenuMessage(
  items: { name: string; price: number; category?: string }[],
): string {
  const emojiMap: Record<string, string> = {
    chicken: "🍗",
    mutton: "🐑",
    egg: "🥚",
  };

  const categories = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  }

  const lines: string[] = [
    `✨ *Vidya's Kitchen Menu* ✨`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  for (const [cat, catItems] of categories) {
    const emoji = emojiMap[cat.toLowerCase()] || "🍽";
    lines.push(`${emoji} *${cat.charAt(0).toUpperCase() + cat.slice(1)} Specials*`);
    lines.push(`─────────────────`);
    for (const item of catItems) {
      lines.push(`  ▸ ${item.name}`);
      lines.push(`    _500gm — ₹${item.price} · 1kg — ₹${Math.round(item.price * 1.8)}_`);
    }
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(ORDER_CUTOFF_REMINDER);
  lines.push(``);
  lines.push(`📍 _Sivakasi delivery only_`);
  lines.push(``);
  lines.push(`_Dish name reply pannu, naan help panren! 🙌_`);

  return lines.join("\n");
}

// ─── Category Browser ────────────────────────────────────────────────────────

export function buildCategoryMessage(): string {
  return [
    `🍽 *Enna saapdalaam?*`,
    ``,
    `1. 🍗 Chicken Dishes`,
    `2. 🐑 Mutton Dishes`,
    `3. 🥚 Egg Dishes`,
    ``,
    `_Number reply pannu to browse!_`,
  ].join("\n");
}

// ─── Item Variants ───────────────────────────────────────────────────────────

export function buildVariantMessage(itemName: string, price500gm: number): string {
  const price1kg = Math.round(price500gm * 1.8);
  return [
    `🍛 *${itemName}*`,
    ``,
    `Choose your size:`,
    ``,
    `1. 500gm — *₹${price500gm}*`,
    `2. 1kg — *₹${price1kg}*`,
    ``,
    `_Number reply pannu!_`,
  ].join("\n");
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export function buildCartMessage(cart: CartItem[]): string {
  if (cart.length === 0) {
    return `🛒 Cart empty-a irukku! Menu browse panni items add pannu.`;
  }

  const lines: string[] = [
    `🛒 *Your Cart*`,
    `━━━━━━━━━━━━━━━━━━━`,
  ];

  cart.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} (${item.variant})`);
    lines.push(`   ${item.quantity}× — ₹${item.unit_price * item.quantity}`);
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*Total: ₹${cartTotal(cart)}*`);
  lines.push(``);
  lines.push(`1. ✅ Checkout`);
  lines.push(`2. ➕ Add more items`);
  lines.push(`3. 🗑 Clear cart`);
  lines.push(``);
  lines.push(`_Number reply pannu!_`);

  return lines.join("\n");
}

export function buildItemAddedMessage(name: string, variant: string, qty: number): string {
  return `✅ *${name}* (${variant}) × ${qty} cart-la add aayiduchu! 🎉`;
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
    `📅 *Eppo deliver pananum?*`,
    ``,
    ...dates,
    ``,
    `_Date number reply pannu! (or type like "tomo", "monday")_`,
  ].join("\n");
}

export function buildSlotPickerMessage(dateStr: string): string {
  return [
    `⏰ *${dateStr} — which meal slot?*`,
    ``,
    `1. 🌅 Breakfast (8am – 10am)`,
    `2. ☀️ Lunch (12pm – 2pm)`,
    `3. 🌙 Dinner (7pm – 9pm)`,
    ``,
    `_Number reply pannu!_`,
  ].join("\n");
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function buildAddressPrompt(): string {
  return [
    `📍 *Delivery address sollu!*`,
    ``,
    `Sivakasi-la enga deliver pananum?`,
    `Full address type pannu (area, landmark, etc.)`,
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
  const slotEmoji: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };
  const total = cartTotal(cart);

  const lines: string[] = [
    `📋 *Order Summary*`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  cart.forEach((item) => {
    lines.push(`▸ ${item.name} (${item.variant}) × ${item.quantity} — ₹${item.unit_price * item.quantity}`);
  });

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*Total: ₹${total}*`);
  lines.push(``);
  lines.push(`${slotEmoji[slotKind] || "📅"} *${dateStr} · ${slotKind.charAt(0).toUpperCase() + slotKind.slice(1)}*`);
  lines.push(`📍 ${address}`);
  lines.push(``);
  lines.push(`1. ✅ Confirm & Pay`);
  lines.push(`2. ✏️ Edit order`);
  lines.push(``);
  lines.push(`_Confirm pannunga, payment link varum!_`);

  return lines.join("\n");
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function buildPaymentMessage(total: number, paymentUrl: string): string {
  return [
    `💳 *Payment Time!*`,
    `━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Amount: *₹${total}*`,
    ``,
    `👇 Tap to pay via Razorpay (UPI / Card / Net Banking):`,
    paymentUrl,
    ``,
    `_Payment aana udan order confirm aayidum! 🎉_`,
  ].join("\n");
}

// ─── Order Status Notifications (Tanglish) ──────────────────────────────────

export function notifyOrderPaid(shortId: string, slotLine?: string): string {
  return [
    `✅ *Order confirmed!* (#${shortId})`,
    ``,
    slotLine ? `📅 *Slot:* ${slotLine}\n` : "",
    `Payment vandhuruchu! Kitchen prepare pannum soon.`,
    `Relax pannu, naan update pannren! 😊`,
  ].filter(Boolean).join("\n");
}

export function notifyOrderAccepted(shortId: string, slotLine?: string): string {
  return [
    `🎉 *Order accepted!* (#${shortId})`,
    ``,
    slotLine ? `📅 *Slot:* ${slotLine}\n` : "",
    `Vidya aunty order-a accept pannuruchu!`,
    `Cancel panna ipo time irukku (12 hrs before delivery).`,
  ].filter(Boolean).join("\n");
}

export function notifyOrderPreparing(): string {
  return `👩‍🍳 *Kitchen-la samayal aarambam!* 🔥\n\nUnga order prepare aagudhu. Smellicious-a varum wait pannu! 🍛`;
}

export function notifyOrderOutForDelivery(): string {
  return `🛵 *On the way!*\n\nDriver order-a eduthutu varraar! Track pannu 👇`;
}

export function notifyOrderDelivered(): string {
  return [
    `🍽 *Delivered!* Enjoy your meal! 🎉`,
    ``,
    `Eppadi irundhudhu? Rate pannu:`,
    ``,
    `1. ⭐⭐⭐⭐⭐ Semma!`,
    `2. ⭐⭐⭐⭐ Nalla irundhuchu`,
    `3. ⭐⭐⭐ Ok ok`,
    `4. ⭐⭐ Improve pannalaam`,
    `5. ⭐ Not great`,
    ``,
    `_Number reply pannunga!_`,
  ].join("\n");
}

export function notifyOrderCancelled(shortId: string): string {
  return `Order *#${shortId}* cancel aayiduchu.\n\nEdhaachu problem-na reply pannu, help panrom! 🙏`;
}

export function notifyOrderRejected(shortId: string, amtStr: string): string {
  return [
    `Sorry, order *#${shortId}* kitchen accept panna mudiyala. 😔`,
    ``,
    `*${amtStr}* full refund initiate pannurom — 5-7 working days-la varum.`,
    ``,
    `Inconvenience-ku sorry! Vera enna help venum-na sollu. 🙏`,
  ].join("\n");
}

// ─── Help & Support ──────────────────────────────────────────────────────────

export function helpAndSupportReply(): string {
  return [
    `🙋 *Help & Support*`,
    ``,
    `Naan Vidya's Kitchen AI host! 👩‍🍳`,
    `Menu browse, order track, questions — ellame help panren.`,
    ``,
    `Human-oda pesanum-na below option choose pannu!`,
  ].join("\n");
}

export function callUsDialReply(): string {
  return [
    `📞 *Call Us*`,
    ``,
    `Tap the number below to call:`,
    `${SUPPORT_PHONE_E164}`,
    ``,
    `Or email: ${SUPPORT_EMAIL}`,
    ``,
    `_Tappable illa-na manually dial pannu: +91 93840 20119_`,
  ].join("\n");
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

export function buildReorderMessage(
  items: { name: string; price: number }[],
): string {
  const lines: string[] = [
    `🔄 *Order Again!*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Last time order panna dishes:`,
    ``,
  ];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} — ₹${item.price}`);
  });

  lines.push(``);
  lines.push(`_Number reply pannu to add to cart, or type "menu" for full menu!_`);

  return lines.join("\n");
}

// ─── PWA Promo ───────────────────────────────────────────────────────────────

export function buildPwaPromoMessage(phone: string, name: string, autoLoginUrl?: string): string {
  const url = autoLoginUrl || `${publicSiteOrigin()}?phone=${phone}&name=${encodeURIComponent(name)}`;
  return [
    `📱 *Better experience venum-na try our app!*`,
    ``,
    `Images, easy cart, live tracking — ellame irukku.`,
    `Browser-layey install pannalam, no download!`,
    ``,
    `👇 Tap to open:`,
    url,
  ].join("\n");
}

/** Short line to append when showing menu / cart flows */
export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
