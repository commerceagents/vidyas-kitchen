import assert from "node:assert/strict";
import type { CartItem } from "./whatsapp-cart";
import { matchCartLines, planScopedCartEdit } from "./whatsapp-cart-ops";
import { classifyTurn, INTERRUPT_ESCALATE_AT, routeTurn } from "./whatsapp-turn";

const moms1kg: CartItem = {
  menu_item_id: "37c30dfd-3be1-46a1-9780-8f65e6112259",
  name: "Mom's Recipe Chicken Gravy",
  variant: "1kg",
  quantity: 1,
  unit_price: 599,
};
const moms500: CartItem = {
  menu_item_id: "37c30dfd-3be1-46a1-9780-8f65e6112259",
  name: "Mom's Recipe Chicken Gravy",
  variant: "500gm",
  quantity: 1,
  unit_price: 349,
};

const SAID = "I would like to remove the moms chicken recipe of 1kg alone and keep 3 500gms";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const plan = planScopedCartEdit(SAID);
check("scoped remove is 1kg", plan?.removeSize === "1kg");
check("scoped keep is 3 x 500gm", plan?.keep?.size === "500gm" && plan.keep.quantity === 3);

const pool = [moms1kg, moms500].filter((line) => line.variant === plan?.removeSize);
const matched = matchCartLines(pool, plan?.itemReference || "");
check("1kg line is the only remove hit", matched.hits.length === 1 && matched.hits[0].variant === "1kg");
check("remove is not ambiguous", matched.ambiguous === false);

const duringDate = classifyTurn(SAID, "picking_date");
check("sentence is a remove, not a day", duringDate.intent === "remove_item" && duringDate.matches_pending_state === false);
const removeRoute = routeTurn("picking_date", duringDate, 0);
check("remove interrupts then re-asks", removeRoute.action === "mutate_cart_then_reask" && removeRoute.nextInterruptCount === 1);

const tomorrow = classifyTurn("tomorrow", "picking_date");
check("tomorrow answers the day", tomorrow.matches_pending_state === true && tomorrow.intent === "answer_pending_question");
check("a real answer resets the count", routeTurn("picking_date", tomorrow, 2).action === "accept_answer");

const menu = classifyTurn("what's on the menu", "picking_date");
check("menu question is not a day", menu.intent === "ask_menu");
check("menu is answered then re-asked", routeTurn("picking_date", menu, 0).action === "answer_menu_then_reask");

const junk = classifyTurn("asdf qwer zxcv", "picking_date");
check("gibberish is unclear", junk.intent === "unclear" && junk.matches_pending_state === false);
check("gibberish asks about that message", routeTurn("picking_date", junk, 0).action === "clarify");

const complaint = classifyTurn("this gravy was terrible", "picking_slot");
check("complaint always interrupts", routeTurn("picking_slot", complaint, 2).action === "complaint");

let count = 0;
let last = "clarify";
for (let i = 0; i < INTERRUPT_ESCALATE_AT; i++) {
  const decision = routeTurn("picking_date", junk, count);
  count = decision.nextInterruptCount;
  last = decision.action;
}
check("third interruption escalates", last === "escalate" && count === 3);

if (process.exitCode) process.exit(process.exitCode);
console.log("turn tests passed");
