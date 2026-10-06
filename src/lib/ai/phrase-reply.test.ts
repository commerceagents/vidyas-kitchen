import assert from "node:assert/strict";
import { getCartSummary, type CartItem } from "../whatsapp-cart";
import { removeLines } from "../whatsapp-cart-ops";
import {
  REPLY_SYSTEM,
  buildReplyPayload,
  buildReplyRequest,
  phraseReply,
  replyStaysOnProvidedData,
  type ReplyInput,
} from "./phrase-reply";

const moms: CartItem = {
  menu_item_id: "37c30dfd-3be1-46a1-9780-8f65e6112259",
  name: "Mom's Recipe Chicken Gravy",
  variant: "1kg",
  quantity: 1,
  unit_price: 699,
};

const wings: CartItem = {
  menu_item_id: "36e1885b-1a3f-418a-8382-2a7ad466f229",
  name: "Chicken Wings",
  variant: "1kg",
  quantity: 1,
  unit_price: 749,
};

function afterRemovingMoms(): ReplyInput {
  const next = removeLines([moms], [moms]);
  return {
    cart: getCartSummary(next),
    matchedDish: null,
    conversationState: "cart_review",
    customerMessage: "remove Mom's Recipe",
    removed: [{ name: moms.name, variant: moms.variant, qty: moms.quantity }],
  };
}

const input = afterRemovingMoms();
const payload = buildReplyPayload(input);
const request = buildReplyRequest(input);
const packed = JSON.stringify(payload);

assert.equal(payload.cart.items.length, 0, "cart is empty after Mom's is removed");
assert.equal(packed.includes("Chicken Wings"), false, "Chicken Wings is not in the JSON");
assert.equal(packed.includes(wings.name), false);
assert.equal("history" in payload, false);
assert.equal(request.contents.length, 1);
assert.equal(request.contents[0].role, "user");
assert.equal(request.contents[0].parts[0].text, packed);
assert.equal(REPLY_SYSTEM.includes("Use ONLY the data in this JSON."), true);
assert.equal(
  REPLY_SYSTEM.includes("Never add, remove, or infer items not present in the cart JSON."),
  true,
);
assert.equal(
  REPLY_SYSTEM.includes("Never invent dish names, prices, discounts, or availability."),
  true,
);

assert.equal(
  replyStaysOnProvidedData("Taken off Mom's Recipe Chicken Gravy (1kg). Your cart is empty.", input),
  true,
);
assert.equal(
  replyStaysOnProvidedData("Removed Mom's. I added Chicken Wings instead.", input),
  false,
);
assert.equal(replyStaysOnProvidedData("That will be ₹849.", input), false);

async function liveIfConfigured() {
  if (!process.env.GEMINI_API_KEY) {
    console.log("ok phrase-reply (structural; Gemini key is not on this machine)");
    return;
  }
  const live = await phraseReply(input);
  assert.equal(/chicken wings/i.test(live), false, live);
  assert.equal(live.length > 0, true, "Gemini returned a reply");
  assert.equal(replyStaysOnProvidedData(live, input), true);
  console.log("live:", live);
}

liveIfConfigured();
