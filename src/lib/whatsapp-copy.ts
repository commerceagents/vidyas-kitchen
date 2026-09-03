/**
 * WhatsApp copy — one design system, two language registers.
 *
 * HOUSE RULES (every message in this file follows them):
 *  - Structure: bold title, blank line, body, then an optional italic footnote.
 *    Built through `msg()` so nothing drifts into its own shape.
 *  - Money: always `formatInr` — "₹399", "₹2,099". Never "Rs", never a bare number.
 *  - Bold: the title, the total, and nothing else. It stops meaning anything
 *    when every second word has stars around it.
 *  - No emojis. Anywhere. The tone comes from the words.
 *  - Button labels: `BTN`, kept under WhatsApp's 20 characters, and the same
 *    label always means the same thing.
 *  - English is real English. Tanglish is its own register, not English with
 *    Tamil words dropped in — the English welcome used to open "Vanakkam".
 *
 * Client components import from this file, so it must stay free of anything
 * server-only (no Supabase, no service-role key).
 */

import { publicSiteOrigin } from "./site-url";
import { type CartItem, cartBreakdown, cartGrandTotal } from "./whatsapp-cart";
import { pickLang, type WaLang } from "./whatsapp-lang";
import { formatInr, packPriceLine } from "./menu/dish-pricing";
import { COD_MAX_ORDER_VALUE } from "./cod-policy";

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

const COD_CAP = formatInr(COD_MAX_ORDER_VALUE);

// ─── The design system ───────────────────────────────────────────────────────

/**
 * Every button label the bot can show. Central so the same action never gets
 * two names, and so the 20-char limit is checked in one place.
 */
export const BTN = {
  menu: "Menu",
  orderAgain: "Order again",
  track: "Track order",
  help: "Help",
  installApp: "Install app",
  openApp: "Open app",
  home: "Home",
  startOver: "Start over",
  chicken: "Chicken",
  mutton: "Mutton",
  egg: "Egg",
  size500: "500gm",
  size1kg: "1kg",
  checkout: "Checkout",
  addMore: "Add more",
  clearCart: "Clear cart",
  sameAsLast: "Same as last time",
  change: "Change",
  editCart: "Edit cart",
  edit: "Edit",
  sameAddress: "Same address",
  newAddress: "New address",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  payOnline: "Pay online",
  payCash: "Pay cash",
  payNow: "Pay now",
  confirmOrder: "Confirm order",
  callUs: "Call us",
  yourOrders: "Your orders",
  payments: "Payments",
  somethingWrong: "Something wrong",
  language: "Language",
  english: "English",
  tanglish: "Tamil + English",
  skip: "Skip",
} as const;

type MsgParts = {
  title?: string;
  lines?: (string | null | undefined | false)[];
  note?: string;
};

/** The one renderer. Title, blank line, body, blank line, italic footnote. */
function msg({ title, lines = [], note }: MsgParts): string {
  const body = lines.filter((l): l is string => typeof l === "string").join("\n");
  const out: string[] = [];
  if (title) out.push(`*${title}*`);
  if (body) {
    if (out.length) out.push("");
    out.push(body);
  }
  if (note) {
    if (out.length) out.push("");
    out.push(`_${note}_`);
  }
  return out.join("\n");
}

function money(amount: number): string {
  return formatInr(amount);
}

/** `Mutton Curry (1kg) x 2 — ₹3,898` — the one shape for a cart line. */
function cartLine(item: CartItem): string {
  return `${item.name} (${item.variant}) x ${item.quantity} — ${money(item.unit_price * item.quantity)}`;
}

/**
 * Fees are spelled out wherever a total appears, because the Razorpay link is
 * raised for the grand total and the app charges the same stack. Quoting the
 * bare item sum here would surprise the customer at the payment screen.
 */
function totalLines(cart: CartItem[], lang?: WaLang): string[] {
  const b = cartBreakdown(cart);
  return [
    "",
    `Items ${money(b.itemsSubtotal)}`,
    pickLang(lang, `Packaging ${money(b.packaging)}`, `Packing ${money(b.packaging)}`),
    `Delivery ${money(b.delivery)}`,
    `GST ${money(b.gst)}`,
    "",
    `*Total ${money(cartGrandTotal(cart))}*`,
  ];
}

export const ORDER_CUTOFF_REMINDER =
  "_Everything is cooked to order, so we need 24 hours. No rush orders._";

export function buildAppNudgeFooter(lang?: WaLang): string {
  return pickLang(
    lang,
    "_Photos, a bigger cart and a map pin all live in the app. Help, then Install app._",
    "_Photos, periya cart, map pin — ellame app-la. Help, apram Install app._",
  );
}

export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png?v=2`;
}

function greetName(firstName?: string): string {
  const n = firstName?.trim();
  return n ? ` ${n}` : "";
}

export type WelcomeKind = "new" | "returning" | "active";

// ─── Language ────────────────────────────────────────────────────────────────

/**
 * Asked once, on first contact, and stored on the session row — so this is the
 * only message a customer ever sees in both registers at the same time.
 */
export function languagePickerBody(firstName?: string): string {
  const name = greetName(firstName);
  return msg({
    title: `Vanakkam${name}`,
    lines: [
      "Which language should we talk in?",
      "",
      "Neenga endha language-la pesalam?",
    ],
    note: "You can change this later under Help.",
  });
}

export function languageSetReply(lang: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["English it is. Let's get you fed."] }),
    msg({ lines: ["Sari, Tanglish-la pesalam. Vanga, saapadu order pannalam."] }),
  );
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function buildWelcomeMessage(firstName?: string, kind: WelcomeKind = "new", lang?: WaLang): string {
  const name = greetName(firstName);

  if (kind === "active") {
    return pickLang(
      lang,
      msg({
        title: `Hello${name}`,
        lines: ["Your order is still on the move. Track it, or start the next one."],
      }),
      msg({
        title: `Vanakkam${name}`,
        lines: ["Unga order innum vandhukondu iruku. Track pannunga, illa adutha order start pannunga."],
      }),
    );
  }

  if (kind === "returning") {
    return pickLang(
      lang,
      msg({
        title: `Welcome back${name}`,
        lines: ["The usual, or shall we tempt you with something else today?"],
        note: "Everything is cooked to order, so we need 24 hours. No rush orders.",
      }),
      msg({
        title: `Vanakkam${name}`,
        lines: ["Regular order-a, illa indha vaatti vera edhachum try pannalama?"],
        note: "Ellame fresh-a cook pannuvom, so 24 hours venum. Rush order illa.",
      }),
    );
  }

  return pickLang(
    lang,
    msg({
      title: `Welcome to Vidya's Kitchen${name}`,
      lines: ["Sivakasi home cooking, made fresh for your order. Chicken, mutton and egg."],
      note: "Everything is cooked to order, so we need 24 hours. No rush orders.",
    }),
    msg({
      title: `Vidya's Kitchen-ku vanga${name}`,
      lines: ["Sivakasi home-style saapadu, unga order-ku fresh-a cook pannuvom. Chicken, mutton, egg."],
      note: "Ellame fresh-a cook pannuvom, so 24 hours venum. Rush order illa.",
    }),
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function buildMenuHeader(lang?: WaLang): string {
  return pickLang(lang, "Our menu", "Namma menu");
}

export function buildFullMenuBody(lang?: WaLang, opts?: { truncated?: boolean }): string {
  return pickLang(
    lang,
    msg({
      title: "What are we cooking for you?",
      lines: [
        "Tap View items to see every dish with photos and prices. Add what you want, then send the cart back to me.",
      ],
      note: opts?.truncated
        ? "A few sizes only fit in the app. Prices shown are per pack."
        : "Prices shown are per pack. Both sizes are listed for every dish.",
    }),
    msg({
      title: "Enna cook pannalam?",
      lines: [
        "View items tap pannunga — ella dish-um photo, price-oda irukum. Venundadhu add pannitu, cart-a enakku anupunga.",
      ],
      note: opts?.truncated
        ? "Konjam size app-la dhaan irukum. Price oru pack-ku."
        : "Price oru pack-ku. Rendu size-um ella dish-ku irukum.",
    }),
  );
}

export function buildCategoryListBody(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "What are you in the mood for?",
      lines: ["Pick a category and I'll show you the dishes."],
      note: "Photos, a bigger cart and a map pin all live in the app. Help, then Install app.",
    }),
    msg({
      title: "Enna saapidalam?",
      lines: ["Oru category pick pannunga, dish-ellam kaatren."],
      note: "Photos, periya cart, map pin — ellame app-la. Help, apram Install app.",
    }),
  );
}

export function buildCategoryMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Pick a category",
      lines: ["1. Chicken", "2. Mutton", "3. Egg"],
      note: "Tap one, or reply 1 to 3.",
    }),
    msg({
      title: "Category pick pannunga",
      lines: ["1. Chicken", "2. Mutton", "3. Egg"],
      note: "Tap pannunga, illa 1 to 3 anupunga.",
    }),
  );
}

export function buildDishListBody(categoryLabel: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: categoryLabel,
      lines: ["Every dish, both sizes, with photos. Add what you want and send the cart back."],
      note: "Prices are per pack.",
    }),
    msg({
      title: categoryLabel,
      lines: ["Ella dish, rendu size, photo-oda. Venundadhu add pannitu cart anupunga."],
      note: "Price oru pack-ku.",
    }),
  );
}

export function buildCarouselBody(categoryLabel: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ title: categoryLabel, lines: ["Swipe through, then tap Add. Size comes next."] }),
    msg({ title: categoryLabel, lines: ["Swipe pannunga, apram Add tap. Size adhukku apram."] }),
  );
}

export function buildMenuMessage(
  items: { name: string; price: number; category?: string; retailer_id?: string; image_url?: string; id?: string }[],
  lang?: WaLang,
): string {
  const categories = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  }

  const lines: string[] = [];
  for (const [cat, catItems] of categories) {
    lines.push(`*${cat.charAt(0).toUpperCase() + cat.slice(1)}*`);
    for (const item of catItems) {
      lines.push(item.name);
      lines.push(`_${packPriceLine(item)}_`);
    }
    lines.push("");
  }

  return msg({
    title: pickLang(lang, "Our menu", "Namma menu"),
    lines,
    note: pickLang(
      lang,
      "Sivakasi delivery only. Cooked to order, so we need 24 hours.",
      "Sivakasi delivery mattum. Fresh-a cook pannuvom, 24 hours venum.",
    ),
  });
}

// ─── Item variants ───────────────────────────────────────────────────────────

export function buildVariantMessage(
  itemName: string,
  prices: { "500gm": number; "1kg": number },
  lang?: WaLang,
): string {
  return pickLang(
    lang,
    msg({
      title: itemName,
      lines: [`500gm — ${money(prices["500gm"])}`, `1kg — ${money(prices["1kg"])}`],
      note: "Which size?",
    }),
    msg({
      title: itemName,
      lines: [`500gm — ${money(prices["500gm"])}`, `1kg — ${money(prices["1kg"])}`],
      note: "Endha size?",
    }),
  );
}

export function buildQtyMessage(variant: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ title: variant, lines: ["How many? Tap 1, 2 or 3."] }),
    msg({ title: variant, lines: ["Ethana? 1, 2, illa 3 tap pannunga."] }),
  );
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export function buildCartMessage(cart: CartItem[], lang?: WaLang): string {
  if (cart.length === 0) {
    return pickLang(
      lang,
      msg({ title: "Your cart is empty", lines: ["Tap Menu and let's fix that."] }),
      msg({ title: "Cart kaali-ya iruku", lines: ["Menu tap pannunga, sari pannalam."] }),
    );
  }

  return msg({
    title: pickLang(lang, "Your cart", "Unga cart"),
    lines: [
      ...cart.map(cartLine),
      ...totalLines(cart, lang),
      cart.length >= WA_CART_MAX ? "" : null,
      cart.length >= WA_CART_MAX
        ? pickLang(
            lang,
            `_WhatsApp carts hold ${WA_CART_MAX} dishes. Feeding a crowd? The app has no limit._`,
            `_WhatsApp cart-la ${WA_CART_MAX} dish dhaan. Periya order-na app-la limit illa._`,
          )
        : null,
    ],
  });
}

export function buildCartLimitMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Cart is full",
      lines: [`WhatsApp carts hold ${WA_CART_MAX} dishes. The app takes as many as you like.`],
    }),
    msg({
      title: "Cart full",
      lines: [`WhatsApp-la ${WA_CART_MAX} dish dhaan. App-la ethana venumnaalum add pannalam.`],
    }),
  );
}

export function buildItemAddedMessage(name: string, variant: string, qty: number, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: [`Added: ${name} (${variant}) x ${qty}.`] }),
    msg({ lines: [`Cart-la sethuruchu: ${name} (${variant}) x ${qty}.`] }),
  );
}

// ─── Delivery date and slot ──────────────────────────────────────────────────

export function buildDatePickerMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "When would you like it?",
      lines: ["Pick a day. We need 24 hours — a good gravy cannot be hurried."],
    }),
    msg({
      title: "Eppo venum?",
      lines: ["Oru naal pick pannunga. 24 hours venum — nalla gravy-ku avasaram aagadhu."],
    }),
  );
}

export function buildSlotPickerMessage(dateStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: dateStr,
      lines: ["Breakfast, lunch or dinner?"],
      note: "Breakfast 7 to 9 AM, lunch 12 to 2 PM, dinner 7 to 9 PM.",
    }),
    msg({
      title: dateStr,
      lines: ["Breakfast, lunch, illa dinner?"],
      note: "Breakfast 7 to 9 AM, lunch 12 to 2 PM, dinner 7 to 9 PM.",
    }),
  );
}

export function buildReuseLastPrompt(
  cart: CartItem[],
  address: string | null,
  slotLine: string | null,
  lang?: WaLang,
): string {
  return msg({
    title: pickLang(lang, "Same as last time?", "Last time maadhiri-ya?"),
    lines: [
      ...cart.map(cartLine),
      ...totalLines(cart, lang),
      "",
      slotLine ? pickLang(lang, `Slot: ${slotLine}`, `Slot: ${slotLine}`) : null,
      address ? pickLang(lang, `Address: ${address}`, `Address: ${address}`) : null,
    ],
    note: pickLang(
      lang,
      "Same as last time reuses your address and the next free matching slot.",
      "Same as last time — adhe address, adutha free slot.",
    ),
  });
}

export function buildReuseAddressPrompt(address: string, lang?: WaLang): string {
  return msg({
    title: pickLang(lang, "Deliver here again?", "Ithe address-ku-va?"),
    lines: [address],
  });
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function buildAddressPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Where in Sivakasi?",
      lines: ["Send your area and a landmark.", "", "Example: 42 Gandhi Nagar, near the bus stand."],
      note: "We deliver in and around Sivakasi only.",
    }),
    msg({
      title: "Sivakasi-la enga?",
      lines: ["Area-um oru landmark-um anupunga.", "", "Example: 42 Gandhi Nagar, bus stand pakkathula."],
      note: "Sivakasi suthi vattaram mattum deliver pannuvom.",
    }),
  );
}

// ─── Order summary ───────────────────────────────────────────────────────────

export function buildOrderSummaryMessage(
  cart: CartItem[],
  dateStr: string,
  slotKind: string,
  address: string,
  lang?: WaLang,
): string {
  return msg({
    title: pickLang(lang, "Does this look right?", "Idhu sari-ya iruka?"),
    lines: [
      ...cart.map(cartLine),
      ...totalLines(cart, lang),
      "",
      `${dateStr} · ${slotKind.charAt(0).toUpperCase() + slotKind.slice(1)}`,
      address,
    ],
  });
}

// ─── Conversational proposal ─────────────────────────────────────────────────

/**
 * The order the model understood, priced by the server. Nothing is written
 * until the customer taps Confirm order, so this message has to state
 * everything they are agreeing to.
 */
export function buildProposalMessage(
  cart: CartItem[],
  dateStr: string,
  slotLabel: string,
  address: string,
  paymentLabel: string,
  lang?: WaLang,
): string {
  return msg({
    title: pickLang(lang, "Here's what I've got", "Naan puinjukittadhu idhu"),
    lines: [
      ...cart.map(cartLine),
      ...totalLines(cart, lang),
      "",
      `${dateStr} · ${slotLabel}`,
      address,
      paymentLabel,
    ],
    note: pickLang(
      lang,
      "Nothing is booked until you tap Confirm order.",
      "Confirm order tap panna varaikkum onnum book aagala.",
    ),
  });
}

export function buildProposalAskMessage(
  field: "dish" | "size" | "date" | "slot" | "address" | "payment",
  lang?: WaLang,
): string {
  switch (field) {
    case "dish":
      return pickLang(
        lang,
        msg({ lines: ["Which dish did you have in mind? Tap Menu to see them all."] }),
        msg({ lines: ["Endha dish venum? Menu tap pannunga, ellame irukum."] }),
      );
    case "size":
      return pickLang(
        lang,
        msg({ lines: ["500gm or 1kg?"] }),
        msg({ lines: ["500gm illa 1kg?"] }),
      );
    case "date":
      return pickLang(
        lang,
        msg({ lines: ["Which day should it arrive?"] }),
        msg({ lines: ["Endha naal deliver pannanum?"] }),
      );
    case "slot":
      return pickLang(
        lang,
        msg({ lines: ["Breakfast, lunch or dinner?"] }),
        msg({ lines: ["Breakfast, lunch, illa dinner?"] }),
      );
    case "address":
      return buildAddressPrompt(lang);
    case "payment":
      return pickLang(
        lang,
        msg({ lines: [`Pay online, or cash at the door? Cash works up to ${COD_CAP}.`] }),
        msg({ lines: [`Online pay illa door-la cash? Cash ${COD_CAP} varaikkum.`] }),
      );
  }
}

export function buildProposalExpiredMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "That slot has passed",
      lines: ["We need 24 hours' notice, and this one slipped inside it. Pick a new day and I'll rebuild the order."],
    }),
    msg({
      title: "Andha slot poiduchu",
      lines: ["24 hours venum, idhu adhukulla vandhuduchu. Puthu naal pick pannunga, order-a thirumba build pannuren."],
    }),
  );
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function buildPaymentMessage(total: number, _paymentUrl?: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Payment",
      lines: [`Amount: *${money(total)}*`, "", "Tap Pay now for UPI, card or net banking. The kitchen starts once it lands."],
    }),
    msg({
      title: "Payment",
      lines: [`Amount: *${money(total)}*`, "", "Pay now tap pannunga — UPI, card, net banking. Payment vandha kitchen start."],
    }),
  );
}

export function buildPayMethodPrompt(total: number, lang?: WaLang, opts?: { overLimit?: boolean }): string {
  if (opts?.overLimit) {
    return pickLang(
      lang,
      msg({
        title: money(total),
        lines: [`Cash on delivery stops at ${COD_CAP}, so this one needs paying online.`],
      }),
      msg({
        title: money(total),
        lines: [`${COD_CAP}-ku mela cash illa, so idhu online pay pannanum.`],
      }),
    );
  }
  return pickLang(
    lang,
    msg({
      title: money(total),
      lines: [`Pay online now, or cash when it arrives. Cash works up to ${COD_CAP}.`],
    }),
    msg({
      title: money(total),
      lines: [`Ippo online pay pannunga, illa vandhadhukku apram cash. Cash ${COD_CAP} varaikkum.`],
    }),
  );
}

export function buildCodOverLimitMention(lang?: WaLang): string {
  return pickLang(
    lang,
    `_Cash on delivery stops at ${COD_CAP}, so this one is online only._`,
    `_${COD_CAP}-ku mela cash illa, idhu online dhaan._`,
  );
}

export function buildCodOverLimitReply(total: number, lang?: WaLang, blocked?: boolean): string {
  if (blocked && isFinite(total) && total <= COD_MAX_ORDER_VALUE) {
    return pickLang(
      lang,
      msg({
        lines: ["Cash isn't available on this number at the moment. Tap Pay online — same gravy, less doorstep maths."],
      }),
      msg({
        lines: ["Indha number-ku ippo cash illa. Pay online tap pannunga — same gravy."],
      }),
    );
  }
  return pickLang(
    lang,
    msg({
      lines: [`We like the appetite, but cash stops at ${COD_CAP}. This one is ${money(total)} — tap Pay online and the gravy gets going.`],
    }),
    msg({
      lines: [`Pasi nalla iruku, aana cash ${COD_CAP} varaikkum dhaan. Idhu ${money(total)} — Pay online tap pannunga, gravy start aagum.`],
    }),
  );
}

export function buildOrderIdPendingPaymentMessage(shortId: string, lang?: WaLang): string {
  return pickLang(
    lang,
    `_Order ${shortId} — we'll confirm the moment your payment lands._`,
    `_Order ${shortId} — payment vandha odane confirm pannuvom._`,
  );
}

export function buildReorderEmptyMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ title: "Nothing to reorder yet", lines: ["Tap Menu and we'll build your first one."] }),
    msg({ title: "Reorder panna onnum illa", lines: ["Menu tap pannunga, mudhal order build pannalam."] }),
  );
}

export function buildCodPlacedMessage(shortId: string, amtStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Order ${shortId} is in`,
      lines: [`Cash on delivery — please have *${amtStr}* ready. The kitchen has it.`],
    }),
    msg({
      title: `Order ${shortId} sethuruchu`,
      lines: [`Cash on delivery — *${amtStr}* ready-a vachukonga. Kitchen-ku theriyum.`],
    }),
  );
}

// ─── Order status notifications ──────────────────────────────────────────────

export function notifyOrderPaid(shortId: string, slotLine?: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Order ${shortId} confirmed`,
      lines: [slotLine ? `Delivery: ${slotLine}` : null, "Payment received. The kitchen has your order — no need to start cooking at home."],
    }),
    msg({
      title: `Order ${shortId} confirm aayiduchu`,
      lines: [slotLine ? `Delivery: ${slotLine}` : null, "Payment vandhuduchu. Kitchen-ku theriyum — veetla stove on panna vendaam."],
    }),
  );
}

/** Cash on delivery — nothing has been paid yet, so never say "payment received". */
export function notifyOrderPlacedCod(shortId: string, amtStr: string, slotLine?: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Order ${shortId} confirmed`,
      lines: [
        slotLine ? `Delivery: ${slotLine}` : null,
        `Cash on delivery — please have *${amtStr}* ready.`,
        "The kitchen has it. We'll message you as it moves.",
      ],
    }),
    msg({
      title: `Order ${shortId} confirm aayiduchu`,
      lines: [
        slotLine ? `Delivery: ${slotLine}` : null,
        `Cash on delivery — *${amtStr}* ready-a vachukonga.`,
        "Kitchen-ku theriyum. Update anupuvom.",
      ],
    }),
  );
}

export function notifyCodCollected(shortId: string, amtStr: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Cash received for ${shortId}`,
      lines: [`Got *${amtStr}*. Our driver says thank you. We say enjoy.`],
    }),
    msg({
      title: `${shortId}-ku cash vandhuduchu`,
      lines: [`*${amtStr}* kittuchu. Driver thanks solraaru. Naanga solrom — enjoy pannunga.`],
    }),
  );
}

export function notifyOrderUndelivered(shortId: string, reasonLine: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `We couldn't deliver ${shortId}`,
      lines: [`${reasonLine}.`, "", "Reply here and we'll sort it out. We're not going anywhere."],
    }),
    msg({
      title: `${shortId} deliver panna mudiyala`,
      lines: [`${reasonLine}.`, "", "Inga reply pannunga, sari pannuvom."],
    }),
  );
}

export function notifyOrderAccepted(shortId: string, slotLine?: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Kitchen accepted ${shortId}`,
      lines: [slotLine ? `Delivery: ${slotLine}` : null, "It's on the board. Cancelling lives in the app, up to 12 hours before your slot."],
    }),
    msg({
      title: `Kitchen ${shortId} accept panniduchu`,
      lines: [slotLine ? `Delivery: ${slotLine}` : null, "Board-la vandhuduchu. Cancel pannanumna app-la, slot-ku 12 hours munnadi."],
    }),
  );
}

export function notifyOrderPreparing(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ title: "Preparing your order", lines: ["The kitchen is on it. Resist the urge to start cooking at home."] }),
    msg({ title: "Order prepare aagudhu", lines: ["Kitchen velai start panniduchu. Veetla stove on panna vendaam."] }),
  );
}

export function notifyOrderOutForDelivery(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Out for delivery",
      lines: ["Your food has left the kitchen. Sivakasi traffic versus hot gravy — the gravy usually wins."],
    }),
    msg({
      title: "Delivery-ku kilambiduchu",
      lines: ["Saapadu kitchen-la kilambiduchu. Sivakasi traffic vs sooda gravy — gravy dhaan usually jeikkum."],
    }),
  );
}

/** Caption for the static pin. Business accounts get no live location API. */
export function driverPinCaption(minutesAgo: number, lang?: WaLang): string {
  const when =
    minutesAgo <= 1
      ? pickLang(lang, "just now", "ippo dhaan")
      : pickLang(lang, `${minutesAgo} minutes ago`, `${minutesAgo} nimisham munnadi`);
  return pickLang(
    lang,
    msg({
      title: "Driver update",
      lines: [`This is where your driver was ${when}.`],
      note: "A snapshot, not a live map. Open the app for the full picture.",
    }),
    msg({
      title: "Driver update",
      lines: [`Unga driver ${when} inga irundhaaru.`],
      note: "Idhu oru snapshot, live map illa. Full view-ku app open pannunga.",
    }),
  );
}

export function notifyOrderDelivered(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Delivered",
      lines: [
        "That's it — enjoy. How was it?",
        "",
        "1. Excellent",
        "2. Good",
        "3. Okay",
        "4. Could be better",
        "5. Not satisfied",
      ],
      note: "Reply with a number. It takes a second and it genuinely helps.",
    }),
    msg({
      title: "Delivered",
      lines: [
        "Vandhuduchu — enjoy pannunga. Eppadi irundhuchu?",
        "",
        "1. Excellent",
        "2. Good",
        "3. Okay",
        "4. Could be better",
        "5. Not satisfied",
      ],
      note: "Oru number anupunga. Oru second dhaan, romba help aagum.",
    }),
  );
}

export function buildRatingCommentPrompt(stars: number, lang?: WaLang): string {
  const warm = stars >= 4;
  return pickLang(
    lang,
    msg({
      lines: [
        warm
          ? "Thank you. One line on what you liked, so we keep doing it?"
          : "Thank you for saying so. One line on what went wrong, so we can fix it?",
      ],
      note: "Type it here, or tap Skip.",
    }),
    msg({
      lines: [
        warm
          ? "Nandri. Enna pidichudhu-nu oru line sollunga, adhe continue pannuvom."
          : "Sollathukku nandri. Enna thappaachu-nu oru line sollunga, sari pannuvom.",
      ],
      note: "Inga type pannunga, illa Skip tap pannunga.",
    }),
  );
}

export function ratingCommentThanks(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["Noted, and passed to the kitchen. Thank you."] }),
    msg({ lines: ["Kitchen-ku sollitten. Nandri."] }),
  );
}

export function notifyOrderCancelled(shortId: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Order ${shortId} cancelled`,
      lines: ["It's off the stove. Whenever you're hungry again, we're here."],
    }),
    msg({
      title: `Order ${shortId} cancel aayiduchu`,
      lines: ["Stove-la irundhu eduthuduchom. Adutha vaatti pasikkum bodhu, naanga irukom."],
    }),
  );
}

export function notifyOrderRejected(shortId: string, amtStr: string, wasPaid = true, lang?: WaLang): string {
  const refundLine = wasPaid
    ? pickLang(
        lang,
        `A full refund of *${amtStr}* is on its way, in 5 to 7 working days.`,
        `*${amtStr}* full refund start aayiduchu, 5 to 7 working days.`,
      )
    : pickLang(lang, "You have not been charged.", "Ungalukku charge aagala.");
  return pickLang(
    lang,
    msg({
      title: `We couldn't take order ${shortId}`,
      lines: [refundLine, "", "Sorry about this. Reply if you'd like help picking something else."],
    }),
    msg({
      title: `Order ${shortId} accept panna mudiyala`,
      lines: [refundLine, "", "Sorry. Vera dish venumna inga sollunga."],
    }),
  );
}

// ─── Help and support ────────────────────────────────────────────────────────

export function helpAndSupportReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Help",
      lines: [
        "Track an order, see your past ones, call the kitchen, or change your language.",
        "",
        "Late order, wrong dish, anything else — just type it. I'll sort it or bring in a human.",
      ],
    }),
    msg({
      title: "Help",
      lines: [
        "Order track pannunga, pazhaya order paarunga, kitchen-ku call pannunga, illa language change pannunga.",
        "",
        "Late, wrong dish, vera edhachum — type pannunga. Naan paarthukren, illa oru human-a kootitu varen.",
      ],
    }),
  );
}

export function callUsDialReply(lang?: WaLang): string {
  return msg({
    title: pickLang(lang, "Call us", "Call pannunga"),
    lines: [SUPPORT_PHONE_E164, "", `Email: ${SUPPORT_EMAIL}`],
    note: pickLang(lang, "Kitchen hours, 9 AM to 8 PM.", "Kitchen hours, 9 AM to 8 PM."),
  });
}

export function escalateHumanReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Passing this to the team",
      lines: [`Call ${SUPPORT_PHONE_E164} or email ${SUPPORT_EMAIL} if it's urgent.`],
    }),
    msg({
      title: "Team-ku anupuren",
      lines: [`Avasaram-na ${SUPPORT_PHONE_E164} call pannunga, illa ${SUPPORT_EMAIL} email pannunga.`],
    }),
  );
}

export function complaintPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "What happened?",
      lines: ["Tell me in your own words — food, timing, wrong dish, anything. I'll read it properly."],
    }),
    msg({
      title: "Enna aachu?",
      lines: ["Unga vaarthaila sollunga — saapadu, time, wrong dish, edhuvaanaalum. Naan sariya padikren."],
    }),
  );
}

export function buildActiveOrdersMessage(
  rows: { ref: string; status: string; amount: string }[],
  lang?: WaLang,
): string {
  if (rows.length === 0) {
    return pickLang(
      lang,
      msg({ title: "No active orders", lines: ["Tap Menu whenever the hunger strikes."] }),
      msg({ title: "Active order illa", lines: ["Pasi vandha Menu tap pannunga."] }),
    );
  }
  return msg({
    title: pickLang(lang, "Active orders", "Active orders"),
    lines: rows.map((r, i) => `${i + 1}. ${r.ref} — ${r.status} — ${r.amount}`),
    note: pickLang(lang, "We'll message you at every step.", "Ovvoru step-um message anupuvom."),
  });
}

export function buildOrderHistoryMessage(
  rows: { ref: string; status: string; amount: string; date: string }[],
  lang?: WaLang,
): string {
  if (rows.length === 0) {
    return pickLang(
      lang,
      msg({ title: "No orders yet", lines: ["Tap Menu for the first one."] }),
      msg({ title: "Innum order illa", lines: ["Mudhal order-ku Menu tap pannunga."] }),
    );
  }
  return msg({
    title: pickLang(lang, "Your orders", "Unga orders"),
    lines: rows.map((r, i) => `${i + 1}. ${r.ref} — ${r.status} — ${r.amount} — ${r.date}`),
  });
}

export function buildPaymentsMessage(
  rows: { ref: string; label: string; amount: string }[],
  lang?: WaLang,
): string {
  if (rows.length === 0) {
    return pickLang(
      lang,
      msg({ title: "Payments", lines: ["Nothing on this number yet."] }),
      msg({ title: "Payments", lines: ["Indha number-la innum onnum illa."] }),
    );
  }
  return msg({
    title: pickLang(lang, "Payments", "Payments"),
    lines: rows.map((r) => `${r.ref} — ${r.amount} — ${r.label}`),
  });
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

export function buildReorderMessage(items: { name: string; price: number }[], lang?: WaLang): string {
  return msg({
    title: pickLang(lang, "Order again", "Thirumba order"),
    lines: [
      pickLang(lang, "Your last order had:", "Unga last order-la:"),
      "",
      ...items.map((item, i) => `${i + 1}. ${item.name} — ${money(item.price)}`),
    ],
    note: pickLang(lang, "Reply with a number, or type menu for everything.", "Oru number anupunga, illa menu-nu type pannunga."),
  });
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function buildPwaPromoMessage(phone: string, name: string, autoLoginUrl?: string, lang?: WaLang): string {
  const url = autoLoginUrl || `${publicSiteOrigin()}?phone=${phone}&name=${encodeURIComponent(name)}`;
  return pickLang(
    lang,
    msg({
      title: "Install Vidya's Kitchen",
      lines: [
        "Photos of every dish, live tracking, a map pin for your door, and a cart with no limit.",
        "",
        "1. Tap Open app",
        "2. In the browser menu, choose Add to Home screen",
        "",
        url,
      ],
      note: "No Play Store needed. Chrome works best.",
    }),
    msg({
      title: "Vidya's Kitchen app install pannunga",
      lines: [
        "Ella dish-ukkum photo, live tracking, veedu-ku map pin, limit illadha cart.",
        "",
        "1. Open app tap pannunga",
        "2. Browser menu-la Add to Home screen select pannunga",
        "",
        url,
      ],
      note: "Play Store thevai illa. Chrome-la nalla work aagum.",
    }),
  );
}

export function buildPwaPromoBody(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Install Vidya's Kitchen",
      lines: [
        "Photos of every dish, live tracking, a map pin for your door, and a cart with no limit.",
        "",
        "1. Tap Open app",
        "2. In the browser menu, choose Add to Home screen",
      ],
      note: "No Play Store needed. Chrome works best.",
    }),
    msg({
      title: "Vidya's Kitchen app install pannunga",
      lines: [
        "Ella dish-ukkum photo, live tracking, veedu-ku map pin, limit illadha cart.",
        "",
        "1. Open app tap pannunga",
        "2. Browser menu-la Add to Home screen select pannunga",
      ],
      note: "Play Store thevai illa. Chrome-la nalla work aagum.",
    }),
  );
}

export function buildOpenAppBody(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Your kitchen, in the app",
      lines: ["Full menu with photos, live tracking and your saved addresses."],
    }),
    msg({
      title: "Unga kitchen, app-la",
      lines: ["Full menu photo-oda, live tracking, save panna address-ellam."],
    }),
  );
}

export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}

export function ratingThanksReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["Thank you — that means a lot to the kitchen."] }),
    msg({ lines: ["Nandri — kitchen-ku romba santhosham."] }),
  );
}

export function aiFollowupPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["Anything else I can do?"] }),
    msg({ lines: ["Vera edhachum venuma?"] }),
  );
}

/** Opt-out only covers campaigns; order updates are not marketing. */
export function marketingOptOutReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "No more offers",
      lines: ["You're off the promotions list. You'll still get updates about orders you place."],
      note: "Changed your mind? Just say hello.",
    }),
    msg({
      title: "Offers stop pannitom",
      lines: ["Promotions list-la irundhu eduthutom. Order update mattum varum."],
      note: "Mind change aana, hello sollunga.",
    }),
  );
}

export function notUnderstoodReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["I didn't quite catch that. Tap Menu to order, or Help if something's wrong."] }),
    msg({ lines: ["Sariya puriyala. Order-ku Menu tap pannunga, problem-na Help."] }),
  );
}
