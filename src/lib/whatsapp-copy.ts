/**
 * WhatsApp copy — short, warm, slightly funny friend-of-the-kitchen.
 * Button titles stay English (20-char limit). Body can be Tanglish.
 */

import { publicSiteOrigin } from "./site-url";
import { type CartItem, cartBreakdown, cartGrandTotal } from "./whatsapp-cart";
import { pickLang, type WaLang } from "./whatsapp-lang";

export const SUPPORT_PHONE_E164 = "+919384020119";

/**
 * The WhatsApp bot. Chats go here rather than to the kitchen's own line so an
 * out-of-hours message still gets an answer, and so the number a customer ends
 * up in a thread with is the same one that sends their order updates.
 */
export const WHATSAPP_BOT_E164 = "+917550028179";

/** wa.me link to the bot, opening with `message` already typed. */
export function whatsappBotLink(message: string): string {
  const digits = WHATSAPP_BOT_E164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
export const SUPPORT_EMAIL = "hello.vidyaskitchen@gmail.com";
export const WA_CART_MAX = 3;

export const ORDER_CUTOFF_REMINDER =
  "_Fresh cook — order at least 24 hours before delivery. No rush orders._";

export function buildAppNudgeFooter(lang?: WaLang): string {
  return pickLang(
    lang,
    "_Photos, big cart, map pin — that's the app. Help → Install app._",
    "_Photos, big cart, map pin — app-la dhaan. Help → Install app._",
  );
}

export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png?v=2`;
}

function greetName(firstName?: string): string {
  const n = firstName?.trim();
  return n ? ` *${n}*` : "";
}

export type WelcomeKind = "new" | "returning" | "active";

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function buildWelcomeMessage(firstName?: string, kind: WelcomeKind = "new", lang?: WaLang): string {
  const name = greetName(firstName);
  if (kind === "active") {
    return pickLang(
      lang,
      `Vanakkam${name}!\n\nYour order's still moving. Track it — or start the next one?`,
      `Vanakkam${name}!\n\nOrder still moving-la iruku. Track pannunga — illa next one start?`,
    );
  }
  if (kind === "returning") {
    return pickLang(
      lang,
      `Vanakkam${name}!\n\nSame biryani drill, or feeling adventurous today?\n\n${ORDER_CUTOFF_REMINDER}`,
      `Vanakkam${name}!\n\nLast time maadhiri order, illa fresh-aa try pannalama?\n\n${ORDER_CUTOFF_REMINDER}`,
    );
  }
  return pickLang(
    lang,
    `Vanakkam${name}!\n\nWelcome to *Vidya's Kitchen* — Sivakasi home-style, cooked fresh against order.\n\n${ORDER_CUTOFF_REMINDER}`,
    `Vanakkam${name}!\n\n*Vidya's Kitchen*-la welcome. Sivakasi home-style, fresh-aa cook pannuvom.\n\n${ORDER_CUTOFF_REMINDER}`,
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function buildCategoryListBody(lang?: WaLang): string {
  return pickLang(
    lang,
    `*What's cooking?*\n\nTap below — chicken, mutton, or egg.\n\n${buildAppNudgeFooter(lang)}`,
    `*Enna menu?*\n\nKizhe tap pannunga — chicken, mutton, illa egg.\n\n${buildAppNudgeFooter(lang)}`,
  );
}

export function buildCategoryMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Pick a category:*\n\n1. Chicken\n2. Mutton\n3. Egg\n\n_Tap or reply 1–3._`,
    `*Category choose pannunga:*\n\n1. Chicken\n2. Mutton\n3. Egg\n\n_Tap illa 1–3._`,
  );
}

export function buildDishListBody(categoryLabel: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*${categoryLabel} specials*\n(Prices: 500gm / 1kg)\n\nSwipe the cards — or tap the list — and pick a dish.`,
    `*${categoryLabel} specials*\n(Price: 500gm / 1kg)\n\nCards swipe pannunga, illa list tap — dish pick pannunga.`,
  );
}

export function buildCarouselBody(categoryLabel: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*${categoryLabel}*\nSwipe the photos. Tap *Add* — size next.`,
    `*${categoryLabel}*\nPhoto swipe pannunga. *Add* tap — size apram.`,
  );
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
  return lines.join("\n");
}

// ─── Item Variants ───────────────────────────────────────────────────────────

export function buildVariantMessage(itemName: string, price500gm: number, lang?: WaLang): string {
  const price1kg = Math.round(price500gm * 1.8);
  return pickLang(
    lang,
    `*${itemName}*\n\nSize?\n\n1. 500gm — *Rs ${price500gm}*\n2. 1kg — *Rs ${price1kg}*`,
    `*${itemName}*\n\nSize?\n\n1. 500gm — *Rs ${price500gm}*\n2. 1kg — *Rs ${price1kg}*`,
  );
}

export function buildQtyMessage(variant: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*${variant}* — how many? Tap 1, 2, or 3.`,
    `*${variant}* — evlo? 1, 2, illa 3 tap pannunga.`,
  );
}

// ─── Cart ────────────────────────────────────────────────────────────────────

/**
 * Spelled out on every screen that shows a total, because the payment link is
 * raised for the grand total — quoting the bare item sum here would surprise
 * the customer at Razorpay.
 */
function feeLines(cart: CartItem[]): string[] {
  const b = cartBreakdown(cart);
  return [
    `Items: Rs ${b.itemsSubtotal}`,
    `Packaging: Rs ${b.packaging}`,
    `Delivery: Rs ${b.delivery}`,
    `GST (5%): Rs ${b.gst}`,
  ];
}

export function buildCartMessage(cart: CartItem[], lang?: WaLang): string {
  if (cart.length === 0) {
    return pickLang(lang, "Cart's empty. Menu first — then the fun begins.", "Cart empty. Munna menu — apram party.");
  }

  const lines: string[] = [`*Your cart*`, ``];

  cart.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} (${item.variant})`);
    lines.push(`   ${item.quantity}x — Rs ${item.unit_price * item.quantity}`);
  });

  lines.push(``);
  lines.push(...feeLines(cart));
  lines.push(`*Total: Rs ${cartGrandTotal(cart)}*`);
  if (cart.length >= WA_CART_MAX) {
    lines.push(``);
    lines.push(
      pickLang(
        lang,
        `_WhatsApp cart max is ${WA_CART_MAX}. Bigger order? Install the app._`,
        `_WhatsApp-la max ${WA_CART_MAX} items. Extra venuma? App install pannunga._`,
      ),
    );
  }

  return lines.join("\n");
}

export function buildCartLimitMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    `WhatsApp cart is full (${WA_CART_MAX} items). Open the app for a bigger spread.`,
    `WhatsApp cart full (${WA_CART_MAX} items). Periya order-ku app open pannunga.`,
  );
}

export function buildItemAddedMessage(name: string, variant: string, qty: number, lang?: WaLang): string {
  return pickLang(
    lang,
    `In the bag: *${name}* (${variant}) x ${qty}.`,
    `Cart-la: *${name}* (${variant}) x ${qty}.`,
  );
}

// ─── Delivery Slot ───────────────────────────────────────────────────────────

export function buildDatePickerMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    `*When should it land?*\n\nTap a date. We need 24 hours — gravy doesn't do sprints.`,
    `*Eppo deliver?*\n\nDate tap pannunga. 24 hours venum — gravy-ku sprint kedaiyadhu.`,
  );
}

export function buildSlotPickerMessage(dateStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*${dateStr}*\n\nBreakfast, lunch, or dinner?`,
    `*${dateStr}*\n\nBreakfast, lunch, illa dinner?`,
  );
}

export function buildReuseLastPrompt(
  cart: CartItem[],
  address: string | null,
  slotLine: string | null,
  lang?: WaLang,
): string {
  const lines = [
    pickLang(lang, `*Same as last time?*`, `*Last time maadhiri?*`),
    ``,
  ];
  cart.forEach((item) => {
    lines.push(`${item.name} (${item.variant}) x ${item.quantity} — Rs ${item.unit_price * item.quantity}`);
  });
  lines.push(``);
  lines.push(...feeLines(cart));
  lines.push(`*Total: Rs ${cartGrandTotal(cart)}*`);
  if (slotLine) {
    lines.push(``);
    lines.push(pickLang(lang, `Last slot: *${slotLine}*`, `Last slot: *${slotLine}*`));
  }
  if (address) {
    lines.push(pickLang(lang, `Last address: ${address}`, `Last address: ${address}`));
  }
  lines.push(``);
  lines.push(
    pickLang(
      lang,
      `_Same last time_ reuses address + next available matching slot.`,
      `_Same last time_ — address + next matching slot ready.`,
    ),
  );
  return lines.join("\n");
}

export function buildReuseAddressPrompt(address: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*Deliver here again?*\n\n${address}`,
    `*Ithe address-ku anupattoma?*\n\n${address}`,
  );
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function buildAddressPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Where in Sivakasi?*\n\nArea + landmark. Example: 42, Gandhi Nagar, near bus stand.`,
    `*Sivakasi-la enga?*\n\nArea + landmark. Example: 42, Gandhi Nagar, bus stand pakkam.`,
  );
}

// ─── Order Summary ───────────────────────────────────────────────────────────

export function buildOrderSummaryMessage(
  cart: CartItem[],
  dateStr: string,
  slotKind: string,
  address: string,
  lang?: WaLang,
): string {
  const lines: string[] = [pickLang(lang, `*Does this look right?*`, `*Idhu seriya?*`), ``];

  cart.forEach((item) => {
    lines.push(`${item.name} (${item.variant}) x ${item.quantity} — Rs ${item.unit_price * item.quantity}`);
  });

  lines.push(``);
  lines.push(...feeLines(cart));
  lines.push(`*Total: Rs ${cartGrandTotal(cart)}*`);
  lines.push(``);
  lines.push(`*${dateStr} · ${slotKind.charAt(0).toUpperCase() + slotKind.slice(1)}*`);
  lines.push(address);
  return lines.join("\n");
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function buildPaymentMessage(total: number, _paymentUrl?: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*Payment*\n\nAmount: *Rs ${total}*\n\nTap *Pay now* — UPI, card, or net banking. We start once it lands.`,
    `*Payment*\n\nAmount: *Rs ${total}*\n\n*Pay now* tap pannunga — UPI, card, net banking. Payment vandha start.`,
  );
}

export function buildPayMethodPrompt(total: number, lang?: WaLang, opts?: { overLimit?: boolean }): string {
  if (opts?.overLimit) {
    return pickLang(
      lang,
      `*Rs ${total}*\n\nCash on delivery isn't available above ₹2,000 — pay online for this order.\n\n(Cash is still listed so you can see the rule.)`,
      `*Rs ${total}*\n\n₹2,000-ku mela cash illa — intha order-ku online pay pannunga.\n\n(Cash button kaatrom, rule theriyanum.)`,
    );
  }
  return pickLang(
    lang,
    `*Rs ${total}*\n\nPay online now, or cash when it arrives (up to ₹2,000).`,
    `*Rs ${total}*\n\nIppo online pay, illa cash door-la (₹2,000 varai).`,
  );
}

export function buildCodOverLimitMention(lang?: WaLang): string {
  return pickLang(
    lang,
    `_Cash on delivery isn't available above ₹2,000 — pay online for this order._`,
    `_₹2,000-ku mela cash illa — intha order online dhaan._`,
  );
}

export function buildCodOverLimitReply(total: number, lang?: WaLang, blocked?: boolean): string {
  if (blocked && isFinite(total) && total <= 2000) {
    return pickLang(
      lang,
      `Cash isn't available on this number right now. Tap *Pay online* — same gravy, less door drama.`,
      `Intha number-ku ippo cash illa. *Pay online* tap pannunga — same gravy.`,
    );
  }
  return pickLang(
    lang,
    `Love the energy, but cash maxes out at ₹2,000. This one's *Rs ${total}* — tap *Pay online* and we'll start the gravy.`,
    `Cash ₹2,000 varai dhaan. Ithu *Rs ${total}* — *Pay online* tap pannunga, gravy start aagum.`,
  );
}

export function buildOrderIdPendingPaymentMessage(shortId: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `_Order #${shortId} — we'll confirm the second payment lands._`,
    `_Order #${shortId} — payment vandha odane confirm._`,
  );
}

export function buildReorderEmptyMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    "Couldn't find a past cart. Tap *Menu* and we'll build a new one.",
    "Past cart kedaikala. *Menu* tap pannunga — puthu-ya build pannalam.",
  );
}

export function buildCodPlacedMessage(shortId: string, amtStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*Order in* (#${shortId})\n\nCash on delivery — please keep *${amtStr}* ready. Kitchen's in the loop.`,
    `*Order in* (#${shortId})\n\nCash on delivery — *${amtStr}* ready-ya vechikonga. Kitchen-ku theriyum.`,
  );
}

// ─── Order Status Notifications ──────────────────────────────────────────────

export function notifyOrderPaid(shortId: string, slotLine?: string, lang?: WaLang): string {
  const slot = slotLine ? `\n*Delivery:* ${slotLine}\n` : "";
  return pickLang(
    lang,
    `*Order confirmed* (#${shortId})${slot}\nPayment landed. Kitchen's got it — don't start cooking at home, okay?`,
    `*Order confirmed* (#${shortId})${slot}\nPayment vandhuchu. Kitchen-ku theriyum — veetla stove on pannaadheenga, okay?`,
  );
}

/** Cash on delivery — nothing has been paid yet, so never say "payment received". */
export function notifyOrderPlacedCod(shortId: string, amtStr: string, slotLine?: string, lang?: WaLang): string {
  const slot = slotLine ? `\n*Delivery:* ${slotLine}\n` : "";
  return pickLang(
    lang,
    `*Order confirmed* (#${shortId})${slot}\n*Cash on delivery* — keep *${amtStr}* ready.\nKitchen's in. We'll ping you as it moves.`,
    `*Order confirmed* (#${shortId})${slot}\n*Cash on delivery* — *${amtStr}* ready-ya vechikonga.\nKitchen start-ku ready. Update anupuvom.`,
  );
}

export function notifyCodCollected(shortId: string, amtStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*Cash collected* (#${shortId})\n\nGot *${amtStr}*. Driver says thanks. We say enjoy.`,
    `*Cash collected* (#${shortId})\n\n*${amtStr}* vandhuchu. Driver thanks. Naan solren — enjoy.`,
  );
}

export function notifyOrderUndelivered(shortId: string, reasonLine: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `*Couldn't complete delivery* (#${shortId})\n\n${reasonLine}.\n\nReply here — we'll sort it. No disappearing act.`,
    `*Delivery aagala* (#${shortId})\n\n${reasonLine}.\n\nInga reply pannunga — paathukrom.`,
  );
}

export function notifyOrderAccepted(shortId: string, slotLine?: string, lang?: WaLang): string {
  const slot = slotLine ? `\n*Delivery:* ${slotLine}\n` : "";
  return pickLang(
    lang,
    `*Kitchen accepted* (#${shortId})${slot}\nIt's on the board. Cancel lives in the app, at least 12 hours before the slot.`,
    `*Kitchen accepted* (#${shortId})${slot}\nBoard-la serndhuchu. Cancel venuma-na app-la — slot-ku 12 hours munnaadi.`,
  );
}

export function notifyOrderPreparing(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Preparing*\n\nKitchen's on it. Don't start cooking at home, okay?`,
    `*Preparing*\n\nKitchen start panniruchu. Veetla stove on pannaadheenga, okay?`,
  );
}

export function notifyOrderOutForDelivery(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Out for delivery*\n\nYour food left the building. Sivakasi traffic vs gravy — gravy usually wins.`,
    `*Out for delivery*\n\nFood left the building. Sivakasi traffic vs gravy — gravy dhaan usually wins.`,
  );
}

export function notifyOrderDelivered(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Delivered*\n\nLanded. If it's good, tell us. If it's great, tell the street.\n\n1. Excellent\n2. Good\n3. Okay\n4. Could be better\n5. Not satisfied`,
    `*Delivered*\n\nLanded. Nalla irundha solunga. Super-na, theruvukey sollunga.\n\n1. Excellent\n2. Good\n3. Okay\n4. Could be better\n5. Not satisfied`,
  );
}

export function notifyOrderCancelled(shortId: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `Order *#${shortId}* is off the stove.\n\nWhenever you're hungry again, we're here.`,
    `Order *#${shortId}* cancel aayiduchu.\n\nNext time pasikkum-bodhu, we're here.`,
  );
}

export function notifyOrderRejected(shortId: string, amtStr: string, wasPaid = true, lang?: WaLang): string {
  const money = wasPaid
    ? pickLang(
        lang,
        `A full refund of *${amtStr}* is on the way (5–7 working days).`,
        `*${amtStr}* full refund start aayiduchu (5–7 working days).`,
      )
    : pickLang(lang, `You haven't been charged.`, `Charge aagala.`);
  return pickLang(
    lang,
    `We couldn't take order *#${shortId}* this time.\n\n${money}\n\nSorry — reply if you want help picking something else.`,
    `Order *#${shortId}* accept panna mudiyala this time.\n\n${money}\n\nSorry — vera dish venuma-na inga solunga.`,
  );
}

// ─── Help & Support ──────────────────────────────────────────────────────────

export function helpAndSupportReply(lang?: WaLang): string {
  return pickLang(
    lang,
    `*Help*\n\nI'm the kitchen's WhatsApp buddy. Track an order, call us, or install the app.\n\nFood talk, late order, wrong item? Just type — I'll sort or loop in a human.`,
    `*Help*\n\nNaan kitchen WhatsApp friend. Track, call, illa app install.\n\nFood feedback, late, wrong item-na type pannunga — naan paakkuren illa team-ku anupuren.`,
  );
}

export function callUsDialReply(): string {
  return [`*Call us*`, ``, SUPPORT_PHONE_E164, ``, `Email: ${SUPPORT_EMAIL}`].join("\n");
}

export function escalateHumanReply(lang?: WaLang): string {
  return pickLang(
    lang,
    `Noted — looping in the team.\n\nCall ${SUPPORT_PHONE_E164} or email ${SUPPORT_EMAIL}. Or open the app for the full order view.`,
    `Noted — team-ku anupuren.\n\nCall ${SUPPORT_PHONE_E164} illa email ${SUPPORT_EMAIL}. Full view-ku app open pannunga.`,
  );
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

export function buildPwaPromoMessage(phone: string, name: string, autoLoginUrl?: string, lang?: WaLang): string {
  const url = autoLoginUrl || `${publicSiteOrigin()}?phone=${phone}&name=${encodeURIComponent(name)}`;
  return pickLang(
    lang,
    [
      `*Install Vidya's Kitchen*`,
      ``,
      `Photos, live track, map pin, bigger cart — the full kitchen in your pocket.`,
      ``,
      `1. Tap *Open app*`,
      `2. Browser menu → *Add to Home screen*`,
      ``,
      `_No Play Store. Works in Chrome._`,
      url,
    ].join("\n"),
    [
      `*Vidya's Kitchen app*`,
      ``,
      `Photos, live track, map pin, periya cart — full kitchen pocket-la.`,
      ``,
      `1. *Open app* tap pannunga`,
      `2. Browser menu → *Add to Home screen*`,
      ``,
      `_Play Store thevailla. Chrome-la work aagum._`,
      url,
    ].join("\n"),
  );
}

export function buildPwaPromoBody(lang?: WaLang): string {
  return pickLang(
    lang,
    [
      `*Install Vidya's Kitchen*`,
      ``,
      `Photos, live track, map pin, bigger cart.`,
      ``,
      `1. Tap *Open app*`,
      `2. Browser menu → *Add to Home screen*`,
      ``,
      `_No Play Store. Chrome is happiest._`,
    ].join("\n"),
    [
      `*Vidya's Kitchen app*`,
      ``,
      `Photos, live track, map pin, periya cart.`,
      ``,
      `1. *Open app* tap pannunga`,
      `2. Browser menu → *Add to Home screen*`,
      ``,
      `_Play Store thevailla. Chrome nalla irukum._`,
    ].join("\n"),
  );
}

export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}

export function ratingThanksReply(lang?: WaLang): string {
  return pickLang(lang, "Got it — thank you. Means a lot to the kitchen.", "Kittuchiruchu — nandri. Kitchen-ku romba happy.");
}

export function aiFollowupPrompt(lang?: WaLang): string {
  return pickLang(lang, "Anything else? Menu, help, or say hi to start over.", "Vera edhachum? Menu, help, illa hi solunga.");
}
