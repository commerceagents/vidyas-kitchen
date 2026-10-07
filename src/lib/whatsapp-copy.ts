/**
 * WhatsApp copy — one design system, two language registers.
 *
 * HOUSE RULES (every message in this file follows them):
 *  - Structure: bold title, blank line, body, then an optional italic footnote.
 *    Built through `msg()` so nothing drifts into its own shape.
 *  - Money: always `formatInr` — "₹399", "₹2,099". Never "Rs", never a bare number.
 *    Price and quantity lines stay plain. Personality belongs on the line
 *    before or after them, and those lines rotate so the bot does not
 *    repeat one sentence ("On it! 🔥").
 *  - Bold (`*like this*`): dish names and totals.
 *  - Italics (`_like this_`): soft helper lines, such as "Tap one below".
 *  - Sections split on `WA_SECTION_DIVIDER` (┄). A label and its amount still
 *    use middle dots (`Items ··· ₹349`) so the figure stays on the same line.
 *  - One emoji per message block (🍗 chicken, 🛵 delivery, 💰 payment). The
 *    dish-choice list is the exception: the header has one, and each option
 *    has one, because that emoji is the option's label.
 *  - Emojis stay off buttons. Button labels stay within WhatsApp's 20 characters.
 *  - English only. Tanglish variants in this file are unused leftovers.
 *
 * Client components import from this file, so it must stay free of anything
 * server-only (no Supabase, no service-role key).
 */

import { publicSiteOrigin } from "./site-url";
import { computeOrderBreakdownFromItemSubtotal, type OrderFeeOptions } from "./order-pricing";
import { type CartItem, cartBreakdown, cartGrandTotal } from "./whatsapp-cart";
import { pickLang, type WaLang } from "./whatsapp-lang";
import { formatInr, packPriceLine } from "./menu/dish-pricing";
import { formatFullDishName, listRowLabel } from "./dish-name";
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
  orderAgain: "Order Again",
  buyUsual: "Quick Reorder",
  track: "Track Order",
  help: "Help",
  installApp: "Install App",
  openApp: "Open App",
  home: "Home",
  startOver: "Start Over",
  chicken: "Chicken",
  mutton: "Mutton",
  egg: "Egg",
  add: "Add",
  size500: "500gm",
  size1kg: "1kg",
  checkout: "Checkout",
  addMore: "Add More",
  clearCart: "Clear Cart",
  sameAsLast: "Same As Last Time",
  change: "Change",
  editCart: "Edit Cart",
  edit: "Edit",
  sameAddress: "Same Address",
  newAddress: "New Address",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  payOnline: "Pay Online",
  payCash: "Pay Cash",
  payNow: "Pay Now",
  confirmOrder: "Confirm Order",
  changeAddress: "Change Address",
  callUs: "Call Us",
  yourOrders: "Your Orders",
  payments: "Payments",
  somethingWrong: "Something Wrong",
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

/** `*Mutton Curry* (1kg) x 2 — ₹3,898` — the one shape for a cart line. */
function cartLine(item: CartItem): string {
  const name = formatFullDishName(item.name);
  return `*${name}* (${item.variant}) x ${item.quantity} — ${money(item.unit_price * item.quantity)}`;
}

/**
 * Fees are spelled out wherever a total appears, because the Razorpay link is
 * raised for the grand total and the app charges the same stack. Quoting the
 * bare item sum here would surprise the customer at the payment screen.
 */
function totalLines(
  cart: CartItem[],
  lang?: WaLang,
  offer?: { label: string; amount: number } | null,
  feeOpts?: OrderFeeOptions,
): string[] {
  const b = cartBreakdown(cart);
  const discount = offer ? Math.min(b.itemsSubtotal, Math.max(0, Math.round(offer.amount))) : 0;
  const itemsAfter = Math.max(0, b.itemsSubtotal - discount);
  const priced = computeOrderBreakdownFromItemSubtotal(itemsAfter, feeOpts);
  return [
    "",
    `Items ${money(b.itemsSubtotal)}`,
    ...(discount > 0 ? [`Offer -${money(discount)}`] : []),
    pickLang(lang, `Packaging ${money(priced.packaging)}`, `Packing ${money(priced.packaging)}`),
    `Delivery ${money(priced.delivery)}`,
    `GST ${money(priced.gst)}`,
    "",
    `*Total ${money(Math.round(priced.computedTotal))}*`,
  ];
}

/**
 * The confirm card. Dish name bold, size italic, fees on dotted leaders,
 * a rule, then a bold total. Same shape as the bill sent after the order lands.
 */
function invoiceLines(
  cart: CartItem[],
  lang: WaLang | undefined,
  offer: { label: string; amount: number } | null | undefined,
  footer: string[],
  feeOpts?: OrderFeeOptions,
): string[] {
  const b = cartBreakdown(cart);
  const discount = offer ? Math.min(b.itemsSubtotal, Math.max(0, Math.round(offer.amount))) : 0;
  const priced = computeOrderBreakdownFromItemSubtotal(Math.max(0, b.itemsSubtotal - discount), feeOpts);
  const items = cart.flatMap((item) => {
    const qty = Math.max(1, item.quantity);
    const name = formatFullDishName(item.name);
    return [`*${name}*`, `_${item.variant} × ${qty}_ · ${money(item.unit_price * qty)}`];
  });
  return [
    ...items,
    "",
    `_${dottedRow(pickLang(lang, "Items", "Items"), money(b.itemsSubtotal))}_`,
    ...(discount > 0 ? [`_${dottedRow(offer!.label, `-${money(discount)}`)}_`] : []),
    `_${dottedRow(pickLang(lang, "Packaging", "Packing"), money(priced.packaging))}_`,
    `_${dottedRow("Delivery", money(priced.delivery))}_`,
    `_${dottedRow("GST (5%)", money(priced.gst))}_`,
    RULE,
    `*${dottedRow("Total", money(Math.round(priced.computedTotal)))}*`,
    "",
    ...footer.filter(Boolean).map((line) => `_${line}_`),
  ];
}

export const ORDER_CUTOFF_REMINDER =
  "_We cook every order fresh, so it has to be placed at least 24 hours before the delivery slot._";

/**
 * What they actually asked for. "I would like to order veg meals for lunch"
 * becomes "Veg meals", not the leftover filler words.
 */
export function dishAskLabel(query: string): string | null {
  const filler =
    /\b(i|i'm|im|i'd|id|would|like|liked|love|want|wanna|wants|need|needs|order|ordering|ordered|get|got|give|me|a|an|the|please|pls|some|just|really|can|could|you|your|we|us|for|of|tomorrow|today|tonight|tomo|naalai|morning|afternoon|evening|night|lunch|breakfast|dinner|kg|gm|gms|gram|grams|pm|am|quantity|qty|quantities|and|with|at|on|to|my|hi|hello|hey|thanks|thank)\b/gi;
  const left = String(query || "")
    .replace(filler, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!left || left.length > 42) return null;
  return left.charAt(0).toUpperCase() + left.slice(1);
}

/**
 * Offline stand-in when the model is quiet. Still a different line each time,
 * never the one script for every dish.
 */
export function lookalikeOfferBody(query: string, category: string | null): string {
  const asked = dishAskLabel(query);
  const name = asked || "That one";
  const cards = category ? `the ${category} dishes on these cards` : "the dishes on these cards";
  const lines = [
    `${name}? 😊 Our little stove doesn't make that, and we'd rather say so than send the wrong plate. Have a peek at ${cards} 🍲 Tap Add, then pick a size.`,
    `Ahh, ${name.toLowerCase()}. 🥹 Not in our pots — we're a small home kitchen and we stick to what we can cook properly. ${cards[0].toUpperCase()}${cards.slice(1)} are the ones people come back for. Tap Add 👆`,
    `${name} sounds lovely. 🙏 We just don't cook it here. Humble kitchen, honest menu. Swipe ${cards} and tap Add when one feels right.`,
    `We'd love to say yes to ${name.toLowerCase()}. 😅 We can't, not without pretending. These are the plates we do know by heart 🍛 Tap Add, then 500gm or 1kg.`,
    `${name} isn't on our stove, and that's on us. 🏠 A home kitchen only stretches so far. ${cards[0].toUpperCase()}${cards.slice(1)} are what regulars keep ordering. Tap Add when you're ready.`,
    `Oh, ${name.toLowerCase()}! 😌 We admire it from over here. Our pots are full of home gravies, so have a look at ${cards}. Tap Add, then pick a size ✨`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

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

/** Shown once to new customers so they know the one-line order format. */
export const QUICK_ORDER_EXAMPLE = "Mutton gravy 500gm tomorrow dinner, cash";

/** One rotating line that nudges a repeat customer's top dish. */
export function buildUsualTeaseLine(dish: string, variant: string, avoid?: string | null, roll = Math.random()): string {
  const name = dish.trim();
  return varyLine(
    [
      `_Your *${name}* ${variant} keeps winning here — same again? 🍲_`,
      `_The stove still remembers your *${name}* ${variant}. Want me to line one up?_ 😄`,
      `_${name} ${variant} — your greatest hits list. Shall we replay it? 🎵_`,
      `_Honestly? *${name}* ${variant} suits you. One more round?_ 👋`,
    ],
    avoid,
    roll,
  );
}

export function buildWelcomeMessage(
  firstName?: string,
  kind: WelcomeKind = "new",
  lang?: WaLang,
  avoid?: string | null,
  roll = Math.random(),
  usualTease?: string | null,
): string {
  const name = greetName(firstName);
  const noteEn = "Everything is cooked to order, so we need 24 hours. No rush orders.";
  const noteTa = "Ellame fresh-a cook pannuvom, so 24 hours venum. Rush order illa.";

  if (kind === "active") {
    return pickLang(
      lang,
      varyLine(
        [
          msg({ title: `Hello${name}`, lines: ["Your order is still on the move. Track it, or start the next one."] }),
          msg({ title: `Still cooking for you${name}`, lines: ["That order is live. Track it here, or tell me the next dish."] }),
          msg({ title: `Hey${name}`, lines: ["Your plate is in the works. Want a status check or a fresh order?"] }),
        ],
        avoid,
        roll,
      ),
      varyLine(
        [
          msg({ title: `Vanakkam${name}`, lines: ["Unga order innum vandhukondu iruku. Track pannunga, illa adutha order start pannunga."] }),
        ],
        avoid,
        roll,
      ),
    );
  }

  if (kind === "returning") {
    const tease = usualTease ? ["", usualTease] : [];
    return pickLang(
      lang,
      varyLine(
        [
          msg({
            title: `Welcome back${name}`,
            lines: ["The usual, or shall we tempt you with something else today?", ...tease],
            note: noteEn,
          }),
          msg({
            title: `Good to see you again${name}`,
            lines: ["Same order as last time, or feeling adventurous?", ...tease],
            note: noteEn,
          }),
          msg({
            title: `Hey${name} 👋`,
            lines: ["Kitchen's open. Your usual, or something new from the stove?", ...tease],
            note: noteEn,
          }),
        ],
        avoid,
        roll,
      ),
      varyLine(
        [
          msg({ title: `Vanakkam${name}`, lines: ["Regular order-a, illa indha vaatti vera edhachum try pannalama?"], note: noteTa }),
        ],
        avoid,
        roll,
      ),
    );
  }

  const quickOrderHint = `_One message? Try: "${QUICK_ORDER_EXAMPLE}"_`;
  const quickOrderHintTa = `_Oru message-la order? Try: "${QUICK_ORDER_EXAMPLE}"_`;

  return pickLang(
    lang,
    varyLine(
      [
        msg({
          title: `Welcome to Vidya's Kitchen${name}`,
          lines: [
            "Sivakasi home cooking, made fresh for your order. Chicken, mutton and egg.",
            "",
            quickOrderHint,
          ],
          note: noteEn,
        }),
        msg({
          title: `Hey${name} 👋`,
          lines: [
            "Vidya's Kitchen — against-order food from Sivakasi. Tell me a dish when you're hungry.",
            "",
            quickOrderHint,
          ],
          note: noteEn,
        }),
        msg({
          title: `Vanakkam${name}`,
          lines: [
            "Home-style chicken, mutton and egg gravies. Say what you'd like and we'll cook it fresh.",
            "",
            quickOrderHint,
          ],
          note: noteEn,
        }),
      ],
      avoid,
      roll,
    ),
    varyLine(
      [
        msg({
          title: `Vidya's Kitchen-ku vanga${name}`,
          lines: [
            "Sivakasi home-style saapadu, unga order-ku fresh-a cook pannuvom. Chicken, mutton, egg.",
            "",
            quickOrderHintTa,
          ],
          note: noteTa,
        }),
      ],
      avoid,
      roll,
    ),
  );
}

export function buildUsualListBody(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Your usual",
      lines: ["Tap a dish. The next step is payment."],
      note: "Help is at the bottom if this isn't the order.",
    }),
    msg({
      title: "Unga usual",
      lines: ["Dish tap pannunga. Adutha step payment."],
    }),
  );
}

export function buildUsualWelcomeMessage(
  firstName: string | undefined,
  dishes: { name: string; variant: string; quantity: number }[],
  lang?: WaLang,
): string {
  const name = greetName(firstName);
  const lines = dishes.map(
    (dish) => `${formatFullDishName(dish.name)} — ${dish.variant} × ${dish.quantity}`,
  );
  return pickLang(
    lang,
    msg({
      title: `Welcome back${name}`,
      lines: ["Your usual:", ...lines, "", "Tap Quick Reorder, pick one, and the next step is payment."],
      note: "Change stays on the payment screen if the dish, time, address, or payment should be different.",
    }),
    msg({
      title: `Vanakkam${name}`,
      lines: ["Unga usual:", ...lines, "", "Quick Reorder tap pannunga. Adutha step payment dhaan."],
      note: "Payment screen-la Change iruku. Dish, time, address, payment maathalam.",
    }),
  );
}

export function buildUsualPayNote(method: "online" | "cod", lang?: WaLang, overLimit?: boolean): string {
  if (overLimit) {
    return pickLang(
      lang,
      "Cash isn't available on this total, so this one is online. Change if the dish, time, or address should be different.",
      "Indha total-ku cash illa, so online dhaan. Dish, time, address maatha Change.",
    );
  }
  if (method === "cod") {
    return pickLang(
      lang,
      "You usually pay cash. Tap that, or pay online instead. Change if the dish, time, or address should be different.",
      "Neenga usual-a cash dhaan. Adhe, illa online. Maatha Change.",
    );
  }
  return pickLang(
    lang,
    "You usually pay online. Tap that, or pay cash instead. Change if the dish, time, or address should be different.",
    "Neenga usual-a online dhaan. Adhe, illa cash. Maatha Change.",
  );
}

export function buildUsualChangeMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "What should change?",
      lines: ["The rest of this order stays as it is."],
    }),
    msg({
      title: "Enna maathanum?",
      lines: ["Micham order adhey-a irukkum."],
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
    [
      `*${itemName}*`,
      "",
      "Which size would you like?",
      "",
      WA_SECTION_DIVIDER,
      `500gm — ${money(prices["500gm"])}`,
      `1kg — ${money(prices["1kg"])}`,
      WA_SECTION_DIVIDER,
      "",
      "_Tap 500gm or 1kg — qty 1 unless you say otherwise._",
    ].join("\n"),
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
    msg({
      title: variant,
      lines: [
        "How many? Tap 1, 2 or 3, or type a number up to 10.",
        "Four, 4, and “I need four” all count.",
        "",
        "Both sizes in one line: _500gm 2 and 1kg 1_.",
        "Or send the other size after. _1kg in 1 quantity_ keeps the 500gm line.",
      ],
    }),
    msg({
      title: variant,
      lines: [
        "Ethana? 1, 2, 3 tap pannunga, illa number type pannunga. 10 varaikkum.",
        "",
        "Rendu size: _500gm 2 and 1kg 1_.",
      ],
    }),
  );
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export function buildLineRemovedMessage(name: string, variant: string): string {
  return msg({
    title: "Taken off",
    lines: [`${formatFullDishName(name)} _(${variant})_`],
  });
}

export function buildLineUpdatedMessage(name: string, variant: string, qty: number): string {
  return msg({
    title: "Quantity updated",
    lines: [`${formatFullDishName(name)} _(${variant})_ × ${qty}`],
  });
}

export function buildWhichCartLineMessage(): string {
  return msg({
    title: "Which one?",
    lines: ["More than one dish matches. Tap the one you mean."],
  });
}

export function buildNotInCartMessage(): string {
  return msg({
    title: "Not in this cart",
    lines: ["I only take off a dish that's already in it."],
  });
}

export function buildCartUnchangedMessage(): string {
  return msg({
    title: "Cart unchanged",
    lines: ["I kept what's already in it. Name the dish to take off, or tap Add More."],
  });
}

export function buildUpsellMessage(favorite: string, suggested: string, _discount: number): string {
  const fav = formatFullDishName(favorite);
  const dish = formatFullDishName(suggested);
  return msg({
    title: "Often ordered with",
    lines: [`${fav} often shares an order with ${dish}.`],
    note: "Tap Add More if you want it in this cart.",
  });
}

export function buildCartMessage(cart: CartItem[], lang?: WaLang, feeOpts?: OrderFeeOptions): string {
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
      ...invoiceLines(cart, lang, null, [], feeOpts),
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
  return buildItemsAddedMessage([{ name, variant, qty }], lang);
}

export function buildItemsAddedMessage(
  lines: { name: string; variant: string; qty: number }[],
  lang?: WaLang,
): string {
  const body = lines.flatMap((line) => [
    `*${formatFullDishName(line.name)}*`,
    `_${line.variant} × ${line.qty}_`,
  ]);
  return pickLang(
    lang,
    msg({ title: "Added", lines: body }),
    msg({ title: "Cart-la sethuruchu", lines: body }),
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
  feeOpts?: OrderFeeOptions,
): string {
  return msg({
    title: pickLang(lang, "Same as last time?", "Last time maadhiri-ya?"),
    lines: [
      ...cart.map(cartLine),
      ...totalLines(cart, lang, null, feeOpts),
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

export function buildMapPinPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Where should we deliver?",
      lines: ["Tap Send location and drop a pin on the map. No need to type the address."],
    }),
    msg({
      title: "Enga deliver pannanum?",
      lines: ["Send location tap pannitu map-la pin podunga. Address type panna vendaam."],
    }),
  );
}

export function buildAddressChoicesMessage(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Which door?",
      lines: ["These are doors you've used before.", "Or drop a new pin on the map."],
    }),
    msg({
      title: "Endha veedu?",
      lines: ["Idhu varaikkum use panna address.", "Illana map-la pudhu pin podunga."],
    }),
  );
}

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
  offer?: { label: string; amount: number } | null,
  feeOpts?: OrderFeeOptions,
): string {
  return msg({
    title: pickLang(lang, "Does this look right?", "Idhu sari-ya iruka?"),
    lines: invoiceLines(cart, lang, offer, [
      `${dateStr} · ${slotKind.charAt(0).toUpperCase() + slotKind.slice(1)}`,
      address,
    ], feeOpts),
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
  offer?: { label: string; amount: number } | null,
  feeOpts?: OrderFeeOptions,
): string {
  return msg({
    title: pickLang(lang, "Here's what I've got", "Naan puinjukittadhu idhu"),
    lines: invoiceLines(cart, lang, offer, [`${dateStr} · ${slotLabel}`, address, paymentLabel], feeOpts),
    note: pickLang(
      lang,
      "Nothing is booked until you tap Confirm order.",
      "Confirm order tap panna varaikkum onnum book aagala.",
    ),
  });
}

const GAP_LINE: Record<"size" | "date" | "slot" | "address" | "payment", string> = {
  size: "Size — 500gm or 1kg",
  date: "Day — tomorrow, or a weekday",
  slot: "Time — breakfast, lunch, or dinner",
  address: "Address — “same”, or the door address",
  payment: "Pay — cash or online",
};

/** One message for every gap, so a single reply can finish the order. */
export function buildVoiceNoteFallback(lang?: WaLang): string {
  return pickLang(
    lang,
    "_I caught a voice note but couldn't make out the words — type it in one line, or send another note a little slower?_ 🎤",
    "_Voice note puriyala — oru line-la type pannunga, illa konjam slow-a mela send pannunga?_ 🎤",
  );
}

export function buildInstantGapMessage(
  known: string[],
  missing: ("size" | "date" | "slot" | "address" | "payment")[],
  hasSavedAddress: boolean,
): string {
  const lines = missing.map((field) => {
    if (field === "address" && hasSavedAddress) return "Address — reply “same” to use the last one, or send a new door address";
    return GAP_LINE[field];
  });
  const example = missing
    .map((field) => {
      if (field === "size") return "1kg";
      if (field === "date") return "tomorrow";
      if (field === "slot") return "dinner";
      if (field === "address") return hasSavedAddress ? "same" : "12 Temple Road";
      return "cash";
    })
    .join(", ");

  return msg({
    title: "One reply finishes this",
    lines: [
      ...known,
      "",
      "Still need:",
      ...lines.map((line) => `• ${line}`),
      "",
      `Reply in one line, like: ${example}`,
    ],
    note: "Then tap Confirm order and it's booked.",
  });
}

export function buildProposalAskMessage(
  field: "dish" | "size" | "date" | "slot" | "address" | "payment",
  lang?: WaLang,
  avoid?: string | null,
  roll = Math.random(),
): string {
  switch (field) {
    case "dish":
      return pickLang(
        lang,
        varyLine(
          [
            msg({ lines: ["Which dish did you have in mind? Tap Menu to see them all."] }),
            msg({ lines: ["What should we cook? Name a dish, or tap Menu for the full list."] }),
            msg({ lines: ["Tell me the dish — or open Menu if you want to browse."] }),
          ],
          avoid,
          roll,
        ),
        msg({ lines: ["Endha dish venum? Menu tap pannunga, ellame irukum."] }),
      );
    case "size":
      return pickLang(
        lang,
        varyLine(
          [msg({ lines: ["500gm or 1kg?"] }), msg({ lines: ["Half kilo or full kilo?"] }), msg({ lines: ["Which pack — 500gm or 1kg?"] })],
          avoid,
          roll,
        ),
        msg({ lines: ["500gm illa 1kg?"] }),
      );
    case "date":
      return pickLang(
        lang,
        varyLine(
          [
            msg({ lines: ["Which day should it arrive?"] }),
            msg({ lines: ["What day works — tomorrow, or a weekday?"] }),
            msg({ lines: ["When should we deliver? We need 24 hours to cook."] }),
          ],
          avoid,
          roll,
        ),
        msg({ lines: ["Endha naal deliver pannanum?"] }),
      );
    case "slot":
      return pickLang(
        lang,
        varyLine(
          [
            msg({ lines: ["Breakfast, lunch or dinner?"] }),
            msg({ lines: ["Which meal slot — morning, afternoon, or evening?"] }),
            msg({ lines: ["7–9am, 12–2pm, or 7–9pm?"] }),
          ],
          avoid,
          roll,
        ),
        msg({ lines: ["Breakfast, lunch, illa dinner?"] }),
      );
    case "address":
      return buildAddressPrompt(lang);
    case "payment":
      return buildPaymentAsk([], lang);
  }
}

/** Payment step. The lines above the question are the dish, size, and the day just picked. */
export function buildPaymentAsk(known: string[], lang?: WaLang): string {
  const pay = `Pay online, or pay at the door (cash or UPI)? Door works up to ${COD_CAP}.`;
  const payTa = `Online pay illa door-la cash? Cash ${COD_CAP} varaikkum.`;
  return pickLang(
    lang,
    msg({ lines: known.length ? [...known, "", pay] : [pay] }),
    msg({ lines: known.length ? [...known, "", payTa] : [payTa] }),
  );
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
      lines: [`Pay online now, or cash / UPI when it arrives. Door pay works up to ${COD_CAP}.`],
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
      title: "On it! 🔥",
      lines: [`Order ${shortId} is in.`, `Cash on delivery — please have *${amtStr}* ready. The kitchen has it.`],
    }),
    msg({
      title: "On it! 🔥",
      lines: [`Order ${shortId} sethuruchu.`, `Cash on delivery — *${amtStr}* ready-a vachukonga. Kitchen-ku theriyum.`],
    }),
  );
}

/** Section break. Money rows keep middle-dot leaders; this splits blocks. */
export const WA_SECTION_DIVIDER = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄";

/** Stable 0–1 roll from phone + salt + IST day so greetings rotate but stay testable. */
export function conversationalRoll(phone: string, salt: string, at = Date.now()): number {
  const day = new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  let h = 2166136261;
  for (const ch of `${phone}:${salt}:${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Pick a line that was not just said. `roll` is 0–1 so tests can pin a line. */
export function varyLine(options: readonly string[], avoid?: string | null, roll = Math.random()): string {
  const fresh = avoid ? options.filter((line) => line !== avoid && !avoid.includes(line)) : [...options];
  const choices = fresh.length > 0 ? fresh : [...options];
  const index = Math.min(choices.length - 1, Math.max(0, Math.floor(roll * choices.length)));
  return choices[index] || options[0] || "";
}

function dishChoiceOpener(
  family: "chicken" | "mutton" | "egg" | null,
  avoid?: string | null,
  roll = Math.random(),
): string {
  const noun = family === "mutton" ? "mutton" : family === "egg" ? "egg" : family === "chicken" ? "chicken gravy" : "dish";
  const headerEmoji = family === "mutton" ? "🍖" : family === "egg" ? "🥚" : "🍗";
  return varyLine(
    [
      `We've got a few ${noun} options ${headerEmoji} — which one's calling you today?`,
      `A few ${noun} options ${headerEmoji} are ready. Which one do you want?`,
      `Here are the ${noun} options ${headerEmoji}. Take your pick.`,
      `${headerEmoji} Which of these ${noun} options should we cook?`,
    ],
    avoid,
    roll,
  );
}

/** Body above dish cards or the list fallback. Full names live on carousel cards. */
export function buildDishChoicePrompt(
  family: "chicken" | "mutton" | "egg" | null,
  avoid?: string | null,
  roll = Math.random(),
): string {
  return `${dishChoiceOpener(family, avoid, roll)}\n\n_Swipe the photo cards, tap Add, pick a size — confirm in two taps!_`;
}

/** @deprecated Use buildDishChoicePrompt — kept for tests. */
export function buildDishCarouselPrompt(
  family: "chicken" | "mutton" | "egg" | null,
  avoid?: string | null,
  roll = Math.random(),
): string {
  return buildDishChoicePrompt(family, avoid, roll);
}

/** @deprecated Use buildDishChoicePrompt — kept for tests. */
export function buildDishListPrompt(
  family: "chicken" | "mutton" | "egg" | null,
  avoid?: string | null,
  roll = Math.random(),
): string {
  return buildDishChoicePrompt(family, avoid, roll);
}

/** Said when a dish from the choice list is the one they wanted. Wording rotates. */
export function dishPickedAside(dishName?: string | null, avoid?: string | null, roll = Math.random()): string {
  const name = formatFullDishName(String(dishName || "")).trim();
  if (!name) {
    return varyLine(
      ["That's a favorite.", "Good pick.", "Locked in.", "Nice — we'll cook that."],
      avoid,
      roll,
    );
  }
  return varyLine(
    [
      `${name} — that's a favorite.`,
      `Ooh, ${name}. Good pick.`,
      `${name} it is.`,
      `Locked in. ${name} is a good one.`,
      `Nice. We'll cook ${name}.`,
    ],
    avoid,
    roll,
  );
}

export function buildSlotListBody(
  tooSoon?: { label: string; when: string; range: string } | null,
  avoid?: string | null,
  roll = Math.random(),
): string {
  if (!tooSoon) {
    return varyLine(
      [
        "Open times are grouped by day. Tap Pick a slot.",
        "Each day is a heading, with breakfast, lunch, and dinner under it.",
        "Pick a time. The day is the group, the meal is the row.",
      ],
      avoid,
      roll,
    );
  }
  const { label, when, range } = tooSoon;
  const meal = label.toLowerCase();
  return varyLine(
    [
      `${label} on ${when} (${range}) is inside the 24 hours we need to cook. Later days are grouped below.`,
      `We cook fresh, so ${meal} on ${when} is too close. Choose another day — meals sit under each date.`,
      `${when} ${meal} (${range}) won't make the cook time. The next open days are below, one group each.`,
    ],
    avoid,
    roll,
  );
}

export function buildMoreDaysBody(avoid?: string | null, roll = Math.random()): string {
  return varyLine(
    [
      "Here are the next dates.",
      "More open days. Same meals under each date.",
      "Further ahead. Pick the day and the meal.",
    ],
    avoid,
    roll,
  );
}

export { listRowLabel };

// ─── Order status notifications ──────────────────────────────────────────────

const RULE = WA_SECTION_DIVIDER;

export type WaBillLine = {
  name: string;
  variant?: string;
  quantity: number;
  lineTotal: number;
  imageUrl?: string;
};

export type WaOrderBill = {
  ref: string;
  slotLine?: string;
  isCod: boolean;
  /** Cash is collected from the person receiving a gift, not from the sender. */
  recipientPays?: boolean;
  amount: number;
  items: WaBillLine[];
  breakdown: { itemsSubtotal: number; packaging: number; delivery: number; gst: number };
};

export type WaOrderStage =
  | "placed_cod"
  | "placed_paid"
  | "accepted"
  | "preparing"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "rejected"
  | "cod_collected"
  | "undelivered";

/** Label ······ value — WhatsApp collapses tabs, so we draw the dots ourselves. */
function dottedRow(label: string, value: string, width = 28): string {
  const fill = Math.max(2, width - label.length - value.length);
  return `${label} ${"·".repeat(fill)} ${value}`;
}

function heading(label: string): string[] {
  return [RULE, label, RULE];
}

function billItemLines(items: WaBillLine[]): string[] {
  const shown = items.slice(0, 6);
  const lines: string[] = [];
  for (const it of shown) {
    const qty = Math.max(1, it.quantity);
    const size = it.variant ? `${it.variant}  × ${qty}` : `× ${qty}`;
    lines.push(`*${it.name}*`, `_${size}_ · ${money(it.lineTotal)}`);
  }
  if (items.length > shown.length) {
    lines.push(`_+${items.length - shown.length} more in the app_`);
  }
  return lines;
}

function billMoneyLines(bill: WaOrderBill, lang?: WaLang): string[] {
  const pay = money(bill.amount);
  return [
    dottedRow(pickLang(lang, "Items", "Items"), money(bill.breakdown.itemsSubtotal)),
    dottedRow(pickLang(lang, "Packaging", "Packing"), money(bill.breakdown.packaging)),
    dottedRow(pickLang(lang, "Delivery", "Delivery"), money(bill.breakdown.delivery)),
    dottedRow("GST", money(bill.breakdown.gst)),
    RULE,
    `*${dottedRow(pickLang(lang, "Total", "Total"), pay)}*`,
    "",
    bill.recipientPays
      ? `_${pickLang(
          lang,
          "They pay the driver — cash, or the QR on the driver's phone.",
          "Avanga driver-kitta cash kudukkalam, illana driver phone-la irukura QR-ah scan pannalam.",
        )}_`
      : bill.isCod
        ? `_${pickLang(lang, "Pay at the door, exact if you can.", "Veetula cash — exact irundha nalla.")}_`
        : `_${pickLang(lang, "Already paid online.", "Online-la already pay aayiduchu.")}_`,
  ];
}

type StageLine = { title: string; intro: string; note?: string };

/** Same order and stage always pick the same line. A resend does not change the words. */
function variantIndex(key: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 33 + key.charCodeAt(i)) >>> 0;
  return hash % count;
}

function stageLines(
  stage: WaOrderStage,
  ref: string,
  pay: string,
): StageLine[] {
  const who = ref ? `Order ${ref}` : "Your order";
  switch (stage) {
    case "placed_cod":
      return [
        {
          title: "🔥 We've reserved the stove",
          intro: `Hi! Order ${ref} is in. You rest — the gravy is our problem now. 😌`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🔥 Order's in",
          intro: `${who} is booked. Close the chat if you like — cooking is on us.`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🔥 Saved you a spot",
          intro: `Got order ${ref}. The kitchen has it, so you don't have to start anything at home.`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🔥 That's with the kitchen",
          intro: `Order ${ref} just landed. We'll take it from here and message you as it moves.`,
          note: "We'll write again as it moves.",
        },
      ];
    case "placed_paid":
      return [
        {
          title: "🎉 Payment in. Dinner is ours",
          intro: `Order ${ref} is confirmed. No need to start cooking at home tonight. 🙌`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🎉 Paid and confirmed",
          intro: `Payment for order ${ref} is in. Tonight's dinner is already decided.`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🎉 We're cooking this one",
          intro: `Order ${ref} is paid. You can leave the stove alone.`,
          note: "We'll write again as it moves.",
        },
        {
          title: "🎉 Money's in, order's on",
          intro: `Got the payment for ${ref}. The kitchen picks it up from here.`,
          note: "We'll write again as it moves.",
        },
      ];
    case "accepted":
      return [
        {
          title: "👩‍🍳 The kitchen said yes",
          intro: `Order ${ref} is on the board. The onions have been warned. 🧅`,
          note: "Need to cancel? That's in the app, up to 12 hours before your slot.",
        },
        {
          title: "👩‍🍳 Accepted",
          intro: `${who} is on today's board. We'll cook it for your slot.`,
          note: "Need to cancel? That's in the app, up to 12 hours before your slot.",
        },
        {
          title: "👩‍🍳 On the board",
          intro: `The kitchen took order ${ref}. It's in the line for your slot.`,
          note: "Need to cancel? That's in the app, up to 12 hours before your slot.",
        },
        {
          title: "👩‍🍳 Yes from the kitchen",
          intro: `Order ${ref} is accepted. Cooking is planned around your time.`,
          note: "Need to cancel? That's in the app, up to 12 hours before your slot.",
        },
      ];
    case "preparing":
      return [
        {
          title: "🍳 The stove is on",
          intro: `${who} — someone at the stove is taking this personally. In a good way. 😄`,
        },
        {
          title: "🍳 On the flame",
          intro: `${who} is being cooked now. The lid is on.`,
        },
        {
          title: "🍳 Cooking",
          intro: `We've started order ${ref || "yours"}. This is the noisy part.`,
        },
        {
          title: "🍳 In the pan",
          intro: `${who} has moved to the stove. We'll pack it once it's ready.`,
        },
      ];
    case "packed":
      return [
        {
          title: "📦 Packed. Pretending to be patient",
          intro: `${who} is in a box by the door. The driver is next. ⏳`,
        },
        {
          title: "📦 Packed",
          intro: `${who} is boxed and waiting. A driver picks it up next.`,
        },
        {
          title: "📦 Ready by the door",
          intro: `The lid is on order ${ref || "yours"}. It leaves as soon as the driver takes it.`,
        },
        {
          title: "📦 Box is closed",
          intro: `${who} is packed. Next message is when it's on the way.`,
        },
      ];
    case "dispatched":
      return [
        {
          title: "🛵 Out the gate",
          intro: `${who} has left the kitchen. Sivakasi traffic versus hot gravy — the gravy usually wins. 😉`,
        },
        {
          title: "🛵 On the way",
          intro: `${who} is with the driver now. You can track it from here.`,
        },
        {
          title: "🛵 Left the kitchen",
          intro: `Order ${ref || "yours"} is out for delivery. It's heading to you.`,
        },
        {
          title: "🛵 Driver has it",
          intro: `${who} is on the bike. We'll tell you when it's at the door.`,
        },
      ];
    case "delivered":
      return [
        {
          title: "🍽️ That's it — enjoy",
          intro: `Order ${ref} is at your door. Hope it's still steaming. How was it? 😊`,
        },
        {
          title: "🍽️ Delivered",
          intro: `Order ${ref} is with you. Hope the lid was still warm.`,
        },
        {
          title: "🍽️ It's there",
          intro: `We handed over order ${ref}. Tell us how it tasted.`,
        },
        {
          title: "🍽️ Enjoy",
          intro: `Order ${ref} reached you. A quick rating below helps the kitchen.`,
        },
      ];
    case "cancelled":
      return [
        {
          title: `Order ${ref} is off the stove`,
          intro: "Whenever you're hungry again, we're here.",
        },
        {
          title: `Order ${ref} is cancelled`,
          intro: "The kitchen has taken it off. Order again whenever you want.",
        },
        {
          title: `${ref} is cancelled`,
          intro: "That's off the board. We'll be here the next time you're hungry.",
        },
      ];
    case "cod_collected":
      return [
        {
          title: `✅ Cash received for ${ref}`,
          intro: `Got *${pay}*. Our driver says thank you. We say enjoy. 🙏`,
        },
        {
          title: `✅ ${pay} collected`,
          intro: `Cash for order ${ref} is in. Thank you.`,
        },
        {
          title: `✅ Paid at the door`,
          intro: `The driver collected *${pay}* for ${ref}. You're all set.`,
        },
      ];
    default:
      return [];
  }
}

function stageWelcome(
  stage: WaOrderStage,
  bill: WaOrderBill,
  extra?: { refundLine?: string; undeliveredReason?: string },
  lang?: WaLang,
): StageLine {
  const ref = bill.ref;
  const pay = money(bill.amount);
  if (stage === "rejected") {
    const titles = [
      `We couldn't take order ${ref}`,
      `Order ${ref} didn't make the board`,
      `The kitchen had to pass on ${ref}`,
    ];
    const title = titles[variantIndex(`rejected:${ref}`, titles.length)];
    const intro = extra?.refundLine || "Rejected by the kitchen.";
    return pickLang(lang, { title, intro }, { title, intro });
  }
  if (stage === "undelivered") {
    const titles = [
      `We couldn't deliver ${ref}`,
      `Order ${ref} didn't reach you`,
      `${ref} came back to the kitchen`,
    ];
    const notes = [
      "Reply here and we'll sort it out. We're not going anywhere.",
      "Reply on this chat and the kitchen will sort the next step.",
      "Message us here. We'll figure out what to do with it.",
    ];
    const i = variantIndex(`undelivered:${ref}`, titles.length);
    const line = {
      title: titles[i],
      intro: extra?.undeliveredReason || "Something got in the way.",
      note: notes[i],
    };
    return pickLang(lang, line, line);
  }
  const lines = stageLines(stage, ref, pay);
  const line = lines[variantIndex(`${stage}:${ref}`, lines.length)];
  return pickLang(lang, line, line);
}

/**
 * Receipt-shaped status card. The fee table lives only on the first
 * confirmation — repeating Items / Packaging / GST on every update is why
 * the thread looks like a stack of invoices.
 */
export function buildOrderStatusWhatsApp(
  stage: WaOrderStage,
  bill: WaOrderBill,
  lang?: WaLang,
  extra?: { refundLine?: string; undeliveredReason?: string },
): string {
  const welcome = stageWelcome(stage, bill, extra, lang);
  const isReceipt = stage === "placed_cod" || stage === "placed_paid";
  const showItems = isReceipt && bill.items.length > 0;

  const lines: (string | null)[] = [welcome.intro, ""];

  if (showItems) {
    lines.push(...heading(pickLang(lang, "YOUR ORDER", "UNGA ORDER")));
    lines.push(...billItemLines(bill.items));
    lines.push("");
    lines.push(...heading(pickLang(lang, "BILL", "BILL")));
    lines.push(...billMoneyLines(bill, lang));
    lines.push("");
  }

  if (bill.slotLine && (isReceipt || stage === "accepted")) {
    lines.push(...heading(pickLang(lang, "WHEN", "EPPODHU")));
    lines.push(bill.slotLine);
    lines.push("");
  }

  if (stage === "delivered") {
    lines.push(
      "1. Excellent",
      "2. Good",
      "3. Okay",
      "4. Could be better",
      "5. Not satisfied",
    );
  }

  return msg({
    title: welcome.title,
    lines,
    note:
      welcome.note ??
      (stage === "delivered"
        ? pickLang(lang, "Reply with a number. It takes a second and it genuinely helps.", "Oru number anupunga. Oru second dhaan.")
        : undefined),
  });
}

export function notifyOrderPaid(shortId: string, slotLine?: string, lang?: WaLang): string {
  return buildOrderStatusWhatsApp(
    "placed_paid",
    {
      ref: shortId,
      slotLine,
      isCod: false,
      amount: 0,
      items: [],
      breakdown: { itemsSubtotal: 0, packaging: 0, delivery: 0, gst: 0 },
    },
    lang,
  );
}

/** Cash on delivery — nothing has been paid yet, so never say "payment received". */
export function notifyOrderPlacedCod(shortId: string, amtStr: string, slotLine?: string, lang?: WaLang): string {
  const amount = Number(String(amtStr).replace(/[^\d.]/g, "")) || 0;
  return buildOrderStatusWhatsApp(
    "placed_cod",
    {
      ref: shortId,
      slotLine,
      isCod: true,
      amount,
      items: [],
      breakdown: { itemsSubtotal: amount, packaging: 0, delivery: 0, gst: 0 },
    },
    lang,
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
  return buildOrderStatusWhatsApp(
    "accepted",
    {
      ref: shortId,
      slotLine,
      isCod: false,
      amount: 0,
      items: [],
      breakdown: { itemsSubtotal: 0, packaging: 0, delivery: 0, gst: 0 },
    },
    lang,
  );
}

export function notifyOrderPreparing(lang?: WaLang): string {
  return buildOrderStatusWhatsApp(
    "preparing",
    {
      ref: "",
      isCod: false,
      amount: 0,
      items: [],
      breakdown: { itemsSubtotal: 0, packaging: 0, delivery: 0, gst: 0 },
    },
    lang,
  );
}

export function notifyOrderOutForDelivery(lang?: WaLang): string {
  return buildOrderStatusWhatsApp(
    "dispatched",
    {
      ref: "",
      isCod: false,
      amount: 0,
      items: [],
      breakdown: { itemsSubtotal: 0, packaging: 0, delivery: 0, gst: 0 },
    },
    lang,
  );
}

/** The sender of a gift is not at the door. Cash, if any, is collected there. */
export function notifyGiftSenderDriverArrived(isCod: boolean, amount: number, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "The driver has arrived",
      lines: [
        "The driver is at their door.",
        isCod ? `They pay ${money(amount)} — cash, or the QR on the driver's phone.` : null,
      ],
    }),
    msg({
      title: "Driver vandhutaaru",
      lines: [
        "Driver avanga veetla irukaaru.",
        isCod ? `Avanga ${money(amount)} cash kudukkalam, illana driver phone-la irukura QR-ah scan pannalam.` : null,
      ],
    }),
  );
}

/** The driver is standing at the door. Short, because it is read in a hurry. */
export function notifyDriverArrived(isCod: boolean, amount: number, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Your driver has arrived",
      lines: [
        "Your driver is at your door with your order.",
        isCod ? `Please keep ${money(amount)} ready — cash or UPI. The driver has a QR.` : null,
      ],
      note: "Can't find them? Call the driver from your order page.",
    }),
    msg({
      title: "Driver vandhutaaru",
      lines: [
        "Unga driver order-oda veetu vaasal-la wait panraaru.",
        isCod ? `${money(amount)} cash ready-ah vachukonga.` : null,
      ],
      note: "Kaanoma? Order page-la irundhu driver-ku call pannunga.",
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

export function notifyOrderCancelled(
  shortId: string,
  lang?: WaLang,
  refund?: { amount: string } | null,
  refundFailed = false,
): string {
  const refundLine = refund
    ? pickLang(
        lang,
        `A full refund of *${refund.amount}* — food, packaging, delivery and GST — is going back to the same UPI or card you paid with. Usually 5 to 7 working days; often faster on UPI.`,
        `*${refund.amount}* full refund — food, packing, delivery, GST — neenga pay panna UPI / card-ku thirumbi pogum. Usually 5 to 7 working days; UPI-la often faster.`,
      )
    : refundFailed
      ? pickLang(
          lang,
          "The refund did not start. The kitchen will sort it and message you.",
          "Refund start aagala. Kitchen paathu message pannuvom.",
        )
      : pickLang(lang, "You have not been charged.", "Ungalukku charge aagala.");
  return pickLang(
    lang,
    msg({
      title: `Order ${shortId} cancelled`,
      lines: [refundLine, "", "It's off the stove. Whenever you're hungry again, we're here."],
    }),
    msg({
      title: `Order ${shortId} cancel aayiduchu`,
      lines: [refundLine, "", "Stove-la irundhu eduthuduchom. Adutha vaatti pasikkum bodhu, naanga irukom."],
    }),
  );
}

export function notifyOrderRejected(
  shortId: string,
  amtStr: string,
  wasPaid = true,
  lang?: WaLang,
  refundFailed = false,
): string {
  const refundLine = wasPaid
    ? pickLang(
        lang,
        `A full refund of *${amtStr}* — food, packaging, delivery and GST — is going back to the same UPI or card you paid with. Usually 5 to 7 working days; often faster on UPI.`,
        `*${amtStr}* full refund — food, packing, delivery, GST — neenga pay panna UPI / card-ku thirumbi pogum. Usually 5 to 7 working days; UPI-la often faster.`,
      )
    : refundFailed
      ? pickLang(
          lang,
          "The refund did not start. The kitchen will sort it and message you.",
          "Refund start aagala. Kitchen paathu message pannuvom.",
        )
      : pickLang(lang, "You have not been charged.", "Ungalukku charge aagala.");
  return pickLang(
    lang,
    msg({
      title: `We couldn't take order ${shortId}`,
      lines: ["Rejected by the kitchen.", refundLine, "", "Reply if you'd like help picking something else."],
    }),
    msg({
      title: `Order ${shortId} accept panna mudiyala`,
      lines: ["Kitchen reject panniduchu.", refundLine, "", "Vera dish venumna inga sollunga."],
    }),
  );
}

// ─── Help and support ────────────────────────────────────────────────────────

export const HELP_LIST_ROWS: { id: string; title: string; description: string }[] = [
  { id: "hs_track", title: "Track an order", description: "Where it is, and who is carrying it" },
  { id: "hs_cancel", title: "Cancel an order", description: "Free up to 12 hours before the slot" },
  { id: "hs_refund", title: "Refunds", description: "When the money comes back, and when it doesn't" },
  { id: "hs_call", title: "Call the kitchen", description: `${SUPPORT_PHONE_E164}` },
  { id: "hs_complaint", title: "Something wrong", description: "Wrong dish, cold food, a missing box" },
  { id: "hs_your_orders", title: "Your orders", description: "The last few tickets on this number" },
];

export function helpAndSupportReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Need a hand? 👋",
      lines: [
        "Track an order, cancel one, ask about a refund, or talk to a person.",
        "The kitchen phone is on the list, so you never have to hunt for it.",
      ],
      note: "Tap Get help, or just type the question.",
    }),
    msg({
      title: "Help venuma? 👋",
      lines: ["Order track, cancel, refund, illa kitchen-ku call."],
      note: "Get help tap pannunga, illa question type pannunga.",
    }),
  );
}

export type KitchenCallOrder = {
  ref: string;
  dishes: string;
  /** When they placed it, e.g. "Fri, 9 Oct". */
  orderedOn: string;
};

export function callUsDialReply(lang?: WaLang, orders: KitchenCallOrder[] = []): string {
  const listed = orders.filter((order) => order.ref && order.dishes);
  return msg({
    title: pickLang(lang, "The kitchen is a call away 📞", "Kitchen call 📞"),
    lines: [
      `*${SUPPORT_PHONE_E164}*`,
      SUPPORT_EMAIL,
      ...(listed.length
        ? [
            "",
            ...listed.map((order) => `*${order.dishes}*\nOrdered ${order.orderedOn} · ${order.ref}`),
            "",
            "Name the dish when you call. The order number is on that line if they ask.",
          ]
        : ["", "We're usually quick to pick up."]),
    ],
    note: "Kitchen hours, 9 AM to 8 PM.",
  });
}

export function buildRefundAnswer(
  order?: {
    ref: string;
    refundStatus: string | null;
    payment: string;
    total: string;
  } | null,
): string {
  const status = String(order?.refundStatus || "").toLowerCase();
  const live =
    order && status === "refunded"
      ? `*${order.ref}* — the refund${order.total ? ` of *${order.total}*` : ""} has gone back to the same payment method. UPI is often the same day. Cards can take 5–7 working days. 💸`
      : order && status === "initiated"
        ? `*${order.ref}* — the refund has started${order.total ? ` for *${order.total}*` : ""}. It returns to the original UPI or card. I won't call it done until the bank does.`
        : order && status === "refund_failed"
          ? `*${order.ref}* — the refund did not start. Call the kitchen and they'll raise it. I won't pretend the money is already moving.`
          : null;
  return msg({
    title: "Refunds 💸",
    lines: [
      live,
      "Cancel at least 12 hours before the slot and a paid online order comes back in full: the food, ₹20 packaging, ₹35 delivery, and GST.",
      "UPI is usually within 24–48 hours. Cards take 5–7 working days.",
      "Cash at the door was never charged, so a cancel before delivery has nothing to send back.",
      "Wrong dish, cold, or spoiled? Send photos on this chat within 1 hour. The kitchen looks at them before any refund starts.",
      "https://vidyaskitchenhome.com/refund-policy",
    ].filter((line): line is string => Boolean(line)),
    note: `Kitchen ${SUPPORT_PHONE_E164} · ${SUPPORT_EMAIL}`,
  });
}

export function buildCancelPolicyAnswer(): string {
  return msg({
    title: "Cancelling 🍳",
    lines: [
      "You can cancel up to 12 hours before the delivery slot. The kitchen buys fresh that morning, so inside those 12 hours the pot is already on and I can't pull it off.",
      "A paid online order cancelled in time is refunded in full. Cash at the door was never charged.",
      "Say *cancel* and the order number, like cancel #00003, and I'll check the window before anything is dropped.",
    ],
    note: `Rather talk it through? ${SUPPORT_PHONE_E164}`,
  });
}

export function buildCancelClosedAnswer(ref: string): string {
  return msg({
    title: `${ref} is already cooking 🍲`,
    lines: [
      "The 12-hour window has closed, so I can't cancel this one from the chat.",
      "Call the kitchen if something is genuinely wrong. They can still look at it. I just won't pretend the app let it through.",
    ],
    note: `${SUPPORT_PHONE_E164} · ${SUPPORT_EMAIL}`,
  });
}

export function buildCancelConfirmAsk(ref: string, when: string): string {
  return msg({
    title: `Cancel ${ref}?`,
    lines: [
      when || "The slot is still outside the 12-hour cooking window.",
      "Nothing is cancelled until you tap the button. Changed your mind? Ignore this and the order stays.",
    ],
    note: `Kitchen ${SUPPORT_PHONE_E164}`,
  });
}

export function buildCancelDoneAnswer(ref: string, moneyLine: string): string {
  return msg({
    title: `${ref} is cancelled`,
    lines: [
      "Done. The kitchen has been told to stop. 🙏",
      moneyLine,
      "Whenever you're hungry again, just say the dish.",
    ],
    note: `Questions? ${SUPPORT_PHONE_E164}`,
  });
}

export function buildNothingToCancelAnswer(): string {
  return msg({
    title: "Nothing to cancel 🤷",
    lines: [
      "I don't see a live order on this number that I can cancel.",
      "If you were only halfway through a new one, say *cancel* on its own and I'll drop that draft. No charge, nothing saved.",
    ],
    note: `Kitchen ${SUPPORT_PHONE_E164}`,
  });
}

export function buildDriverAnswer(input: {
  ref: string | null;
  name: string | null;
  phone: string | null;
  km: number | null;
  status: string | null;
}): string {
  if (!input.ref) {
    return msg({
      title: "No rider yet 🛵",
      lines: [
        "Nothing is out for delivery on this number right now.",
        "The kitchen names the rider when the dish actually leaves. Until then, this chat is the place to ask.",
      ],
      note: `Kitchen ${SUPPORT_PHONE_E164}`,
    });
  }
  if (!input.name && !input.phone) {
    return msg({
      title: `${input.ref} has no rider yet`,
      lines: [
        "The kitchen hasn't assigned anyone. I won't invent a name or a minute count.",
        "You'll get the rider when the order is on the way. If the map looks stuck later, call the kitchen and they'll check.",
      ],
      note: `Kitchen ${SUPPORT_PHONE_E164}`,
    });
  }
  const who = input.name ? `*${input.name}*` : "Your rider";
  const reach = input.phone ? `Call them on *${input.phone}*.` : "The kitchen has their phone if you need a patch-through.";
  const where =
    input.km == null
      ? "I don't have a fresh pin, so I won't guess how many minutes away they are."
      : input.km < 0.15
        ? "Their last pin is at your door."
        : `Their last pin was about ${input.km.toFixed(1)} km from your door. That's a pin, not a promise of minutes.`;
  return msg({
    title: `Rider for ${input.ref} 🛵`,
    lines: [`${who} has this order.`, reach, where],
    note: `Map stuck? Kitchen ${SUPPORT_PHONE_E164}`,
  });
}

export function buildOfferAnswer(offer: { name: string; pct: number; until: string } | null): string {
  if (!offer || !(offer.pct > 0)) {
    return msg({
      title: "Offers 🎉",
      lines: [
        "Nothing festive is running at this exact moment.",
        "We say so here before a festival starts. I won't invent a percent to fill the silence.",
        "Mom's Recipe Chicken Gravy is the house favourite while you wait.",
      ],
    });
  }
  return msg({
    title: `${offer.name} is on 🎉`,
    lines: [
      `*${offer.pct}%* off through ${offer.until}.`,
      "The bill shows the real saving. I won't quote a rupee amount until the order is priced.",
    ],
  });
}

export function buildAddressOnFileAnswer(address: string | null): string {
  if (!address) {
    return msg({
      title: "No door saved yet 📍",
      lines: ["I don't have an address on this number.", "When we get there, drop a pin. That's the one I can actually check."],
    });
  }
  return msg({
    title: "The door I have 📍",
    lines: [`*${address}*`, "Want this one, or send a new pin? A one-time door won't overwrite this unless you say to save it."],
  });
}

export function buildBestSellerAnswer(name: string): string {
  return msg({
    title: "House favourite 🍲",
    lines: [
      `*${name}* is the one the kitchen puts first.`,
      "That's a house pick, not a made-up sales chart. Say the word and I'll start it, size and all.",
    ],
  });
}

export function buildSpicyAnswer(): string {
  return msg({
    title: "If you want it hot 🌶️",
    lines: [
      "Chilly Chicken Gravy is the spiciest pot we cook.",
      "Spicy Mutton Gravy is the fiery one on the mutton side.",
      "Tell me which, and whether you want 500gm or 1kg.",
    ],
  });
}

export function buildBotAnswer(): string {
  return msg({
    title: "Caught me 🤖",
    lines: [
      "Yes, I'm the Vidya's Kitchen bot. Hungry to take the order, and honest when I should hand you a person.",
      `The kitchen itself is *${SUPPORT_PHONE_E164}*.`,
    ],
    note: "Now, what are we cooking?",
  });
}

export function buildPresenceAnswer(): string {
  return msg({
    title: "Right here 👋",
    lines: ["Vidya's Kitchen, live and ready.", "Say a dish, or tap Menu and I'll open the lot."],
  });
}

export function buildResubscribeAnswer(): string {
  return msg({
    title: "Promos are back on 🎉",
    lines: ["Festival notes will find you again.", "Order updates were never switched off. Those stay either way."],
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

export type OlderOrderKind = "not_sent" | "unpaid" | "unfinished_trip";

/** Asked about, or nudged on, an order whose breakfast/lunch/dinner window is over. */
export function olderOrderAskReply(ref: string, slotLine: string, kind: OlderOrderKind): string {
  const booked = slotLine ? `booked for ${slotLine}` : "from an earlier delivery time";
  if (kind === "unfinished_trip") {
    return `Order #${ref} was ${booked}. That time has passed, and there is no delivered update.\n\nDid it reach you, or should the kitchen look into it?`;
  }
  if (kind === "unpaid") {
    return `Order #${ref} is an older order, ${booked}. That time has passed, and payment was never completed, so it was not sent out.\n\nAre you having a problem with this order, or were you looking for a newer one?`;
  }
  return `Order #${ref} is an older order, ${booked}. That time has passed, and it was not sent out.\n\nAre you having a problem with this order, or were you looking for a newer one?`;
}

/** One plain line for the approved order_update template. */
export function olderOrderTemplateLine(kind: OlderOrderKind): string {
  if (kind === "unfinished_trip") {
    return "This order's delivery time has passed, and there is no delivered update. Reply here if it never arrived.";
  }
  if (kind === "unpaid") {
    return "This is an older order. Payment was not completed and the booked time has passed, so it was not sent out.";
  }
  return "This is an older order. The booked time has passed and it was not sent out. Reply here if you are having a problem with it.";
}

export function olderOrderButtons(kind: OlderOrderKind): { id: string; title: string }[] {
  if (kind === "unfinished_trip") {
    return [
      { id: "stale_arrived", title: "It arrived" },
      { id: "stale_missing", title: "It never came" },
      { id: "stale_call", title: "Call us" },
    ];
  }
  return [
    { id: "stale_issue", title: "Something wrong" },
    { id: "stale_latest", title: "Latest order" },
    { id: "stale_again", title: "Order again" },
  ];
}

export function olderOrderArrivedReply(): string {
  return "Glad it reached you. Enjoy.";
}

export function complaintPickOrdersReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "Which order is this about? 🙏",
      lines: ["Tap the one with the problem. The kitchen will see that order number and the dish."],
      note: "Tap Which order.",
    }),
    msg({
      title: "Edhu order? 🙏",
      lines: ["Problem irukura order-a tap pannunga."],
    }),
  );
}

export function complaintPickItemReply(ref: string, lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: `Which dish on ${ref}? 🙏`,
      lines: ["Tap the one that went wrong. Tap the whole order if it was the box."],
    }),
    msg({
      title: `${ref} la edhu dish? 🙏`,
      lines: ["Problem irukura dish-a tap pannunga."],
    }),
  );
}

export function complaintAboutReply(target: { ref: string; dishes: string; when: string }, lang?: WaLang): string {
  const about = [target.dishes, target.when].filter(Boolean).join(" · ");
  return pickLang(
    lang,
    msg({
      title: `${target.ref} 🙏`,
      lines: [
        about ? `This note is for *${about}*.` : "Tell me what happened with this order.",
        "Wrong dish, cold food, a missing box, timing. I'll pass this exact order to the kitchen.",
      ],
      note: `${SUPPORT_PHONE_E164} · ${SUPPORT_EMAIL}`,
    }),
    msg({
      title: `${target.ref} 🙏`,
      lines: ["Enna aachu-nu sollunga. Indha order-a kitchen-ku anupuren."],
      note: SUPPORT_PHONE_E164,
    }),
  );
}

export function complaintReceivedReply(detail?: string, lang?: WaLang): string {
  const named = detail ? ` The kitchen has it on *${detail}*.` : "";
  return pickLang(
    lang,
    msg({
      title: "I'm sorry. 🙏",
      lines: [
        `This one fell short of what we cook for.${named}`,
        "Next time, we'll amaze you.",
      ],
      note: SUPPORT_PHONE_E164,
    }),
    msg({
      title: "Sorry. 🙏",
      lines: ["Indha vaati miss aachu. Next time amaze pannuvom."],
      note: SUPPORT_PHONE_E164,
    }),
  );
}

export function complaintPrompt(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({
      title: "I'm sorry, that's on us 🙏",
      lines: [
        "Tell me what happened, in your own words. Wrong dish, cold food, a missing box, timing. I'll pass it to the kitchen.",
        "Photos help if the food itself was the problem. Send them within an hour of delivery.",
        "If you'd rather talk it through, the kitchen will pick up.",
      ],
      note: `${SUPPORT_PHONE_E164} · ${SUPPORT_EMAIL}`,
    }),
    msg({
      title: "Sorry, adhu enga thappu 🙏",
      lines: ["Enna aachu-nu sollunga. Kitchen-ku anupuren."],
      note: SUPPORT_PHONE_E164,
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
        "2. On a phone, tap Install. On a computer, scan the QR with your phone.",
      ],
      note: "No Play Store needed. Chrome works best.",
    }),
    msg({
      title: "Vidya's Kitchen app install pannunga",
      lines: [
        "Ella dish-ukkum photo, live tracking, veedu-ku map pin, limit illadha cart.",
        "",
        "1. Open app tap pannunga",
        "2. Phone-la Install tap pannunga. Computer-la QR-ah phone-la scan pannunga.",
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

export function interruptClarifyMessage(heard: string): string {
  const clip = heard.replace(/\s+/g, " ").trim().slice(0, 90);
  return msg({
    title: "I didn't follow that",
    lines: [`"${clip}"`],
    note: "Say it another way. The question under this is still open.",
  });
}

export function interruptMenuAside(): string {
  return msg({
    title: "On the menu",
    lines: ["Chicken, mutton, and egg gravies. Pepper, Mom's, Sister's, Wings, and the rest sit in those."],
    note: "Name a dish if you want it added.",
  });
}

export type CurrentOrderCard = {
  ref: string;
  status: string;
  payment: string;
  total: string;
  when: string;
  address: string;
  items: { name: string; qty: number; line: string }[];
};

/** A full ticket per order: dishes, slot, address, money, and where it stands. */
export function buildCurrentOrdersMessage(orders: CurrentOrderCard[]): string {
  if (orders.length === 0) {
    return msg({
      title: "Your orders",
      lines: ["Nothing on this number yet.", "Tell me a dish when you want one."],
    });
  }
  const blocks = orders.map((order) => {
    const itemLines = order.items.length
      ? order.items.map((item) => `*${item.name}* × ${item.qty}${item.line ? ` — ${item.line}` : ""}`)
      : ["The dishes are not on this ticket."];
    const where = [order.when, order.address].filter(Boolean);
    const money = [order.total, order.payment].filter(Boolean).join(" · ");
    return [`*${order.ref}*`, ...itemLines, ...where, money, order.status].filter(Boolean).join("\n");
  });
  return msg({
    title: "Your orders",
    lines: [blocks.join(`\n\n${WA_SECTION_DIVIDER}\n\n`)],
    note: "Send an order number, like #00003, if you want just that one.",
  });
}

export function interruptStatusMessage(lines: string[]): string {
  return msg({
    title: "Your orders",
    lines: lines.length > 0 ? lines : ["No open order right now."],
  });
}

export function interruptCancelledMessage(): string {
  return msg({
    title: "Cleared",
    lines: ["Nothing was sent to the kitchen. The cart is empty."],
  });
}

export function interruptStillOpenMessage(): string {
  return msg({
    title: "Still on this order",
    lines: ["That doesn't place it yet. I still need the answer under this."],
  });
}

export function notUnderstoodReply(lang?: WaLang): string {
  return pickLang(
    lang,
    msg({ lines: ["I didn't quite catch that. Tap Menu to order, or Help if something's wrong."] }),
    msg({ lines: ["Sariya puriyala. Order-ku Menu tap pannunga, problem-na Help."] }),
  );
}

export type GiftNotifyKind = "placed" | "dispatched" | "arrived" | "delivered" | "cancelled";

export function giftRecipientWhatsApp(kind: GiftNotifyKind, opts: {
  sender: string;
  itemsLine: string;
  slotLine?: string;
  isCod?: boolean;
  amount?: number;
}): string {
  const sender = opts.sender || "A friend";
  const cash =
    opts.isCod && opts.amount
      ? ` Pay ${money(opts.amount)} to the driver — cash, or scan the QR on their phone.`
      : "";
  switch (kind) {
    case "placed":
      return msg({
        title: "A meal is on its way to you",
        lines: [
          `${sender} sent it.`,
          "",
          opts.itemsLine,
          opts.slotLine ? `When: ${opts.slotLine}` : null,
          "",
          opts.isCod
            ? `_Pay ${money(opts.amount || 0)} to the driver. Cash, or scan the QR on their phone._`
            : "_Already paid. Just receive it at the door._",
        ],
        note: "Tap Track to follow the delivery.",
      });
    case "dispatched":
      return msg({
        title: "Your food is on the way",
        lines: [`${sender} sent this. The driver has left the kitchen.${cash}`],
        note: "Tap Track for the live map.",
      });
    case "arrived":
      return msg({
        title: "The driver is at your door",
        lines: [`Food from ${sender} — they're outside.${cash}`],
      });
    case "delivered":
      return msg({
        title: "Delivered",
        lines: [`${sender}'s order is with you. Enjoy.`],
      });
    case "cancelled":
      return msg({
        title: "This order was cancelled",
        lines: [`The food ${sender} sent will not be arriving.`],
      });
  }
}

export function giftRecipientSms(kind: GiftNotifyKind, opts: {
  sender: string;
  url: string;
  itemsLine?: string;
  slotLine?: string;
  isCod?: boolean;
  amount?: number;
}): string {
  const sender = opts.sender || "A friend";
  const cash =
    opts.isCod && opts.amount
      ? ` Pay ${money(opts.amount)} to the driver — cash, or scan the QR on their phone.`
      : "";
  switch (kind) {
    case "placed":
      return `${sender} sent you Vidya's Kitchen food${opts.itemsLine ? `: ${opts.itemsLine}` : ""}${opts.slotLine ? ` (${opts.slotLine})` : ""}.${opts.isCod ? cash : " Already paid."} Track: ${opts.url}`;
    case "dispatched":
      return `Vidya's Kitchen: food from ${sender} is on the way.${cash} Track: ${opts.url}`;
    case "arrived":
      return `Vidya's Kitchen: the driver is at your door.${cash}`;
    case "delivered":
      return `Vidya's Kitchen: ${sender}'s order was delivered. Enjoy.`;
    case "cancelled":
      return `Vidya's Kitchen: the order ${sender} sent you was cancelled.`;
  }
}
