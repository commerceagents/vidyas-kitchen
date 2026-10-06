import assert from "node:assert/strict";
import { choiceButtonTitle } from "../dish-name";
import { allDishPricing, pickCanonicalRows } from "../menu/dish-pricing";
import { istAddCalendarDays, istCalendarYmd } from "../delivery-slots";
import { dishChoiceQuery, notedDeliveryDate } from "./order-proposal";
import { isGravyStyleDish } from "../menu/embeddings";
import { buildDishChoiceMessage } from "../whatsapp-copy";
import { classifyTurn } from "../whatsapp-turn";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const pepper = [
  { id: "38a96232-c038-4fb8-a399-fcbb4a3e1e2e", name: "BLACK PEPPER CHICKEN GRAVY", price: 799, created_at: "2026-04-11T19:29:24.718Z" },
  { id: "8c621691-b064-4f1f-9fff-df8a23dde896", name: "Black Pepper Chicken Gravy (1kg)", price: 799, created_at: "2026-05-27T11:07:40.849Z" },
  { id: "921303ff-b004-4f1e-b8f9-1edc3c122ed7", name: "Black Pepper Chicken Gravy (500gm)", price: 399, created_at: "2026-05-27T11:07:40.849Z" },
];
const unique = pickCanonicalRows(pepper);
check("three pepper rows collapse to one", unique.length === 1);
check("the unsized pepper row is the one we keep", unique[0]?.id === pepper[0].id);

const today = istCalendarYmd();
const tomorrow = istAddCalendarDays(today, 1);
check(
  "tomorrow in the message replaces a leftover 11 June",
  notedDeliveryDate(
    { date: "2026-06-11", items: [{ dish: "chicken gravy" }] },
    "Chicken gravy for tomo lunch 500gm",
    today,
  ) === tomorrow,
);
check(
  "a past date with no day in the message is dropped",
  notedDeliveryDate({ date: "2026-06-11" }, "chicken gravy 500gm", today) === null,
);
check(
  "a future stored date stays when this message names no day",
  notedDeliveryDate({ date: "2026-10-08" }, "chicken gravy", today) === "2026-10-08",
);

const buttons = buildDishChoiceMessage(
  "chicken",
  [
    { name: "CHILLY CHICKEN GRAVY", priceLine: "₹599 (500gm)" },
    { name: "CHICKEN GRAVY (MOM'S RECIPE)", priceLine: "₹349 (500gm)" },
    { name: "CHICKEN GRAVY SISTER'S RECIPE", priceLine: "₹349 (500gm)" },
  ],
  false,
);
check("choice message names the family", buttons.includes("chicken gravy options"));
check("choice message bolds a dish", buttons.includes("*Chilly Chicken Gravy*"));
check("choice message uses the short recipe name", buttons.includes("*Mom's Recipe*"));
check("choice message uses the section divider", buttons.includes("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"));
check("three choices ask for a tap", buttons.includes("_Tap one below, or just type the name!_"));
check("three choices are not a numbered list", !buttons.includes("\n1. "));

const numbered = buildDishChoiceMessage(
  "chicken",
  [
    { name: "CHILLY CHICKEN GRAVY", priceLine: "₹599 (500gm)" },
    { name: "Mom's Recipe - Chicken Gravy", priceLine: "₹349 (500gm)" },
    { name: "Sister's Recipe - Chicken Gravy", priceLine: "₹349 (500gm)" },
    { name: "BLACK PEPPER CHICKEN GRAVY", priceLine: "₹399 (500gm)" },
  ],
  true,
);
check("four choices are numbered", numbered.includes("1. ") && numbered.includes("4. "));
check("four choices ask for a number", numbered.includes("_Reply with the number, or just type the name!_"));

for (const dish of allDishPricing()) {
  const title = choiceButtonTitle(dish.name);
  check(`button title fits: ${dish.name} → ${title}`, title.length > 0 && title.length <= 20);
}

check(
  "a shortened draft still searches for chicken gravy",
  dishChoiceQuery("chicken", "i would like to order chicken gravy for tomo lunch") === "chicken gravy",
);

const chickenNames = [
  "CHICKEN WINGS",
  "Chilly Chicken (Dry)",
  "CHILLY CHICKEN GRAVY",
  "CHICKEN GRAVY (MOM'S RECIPE)",
  "CHICKEN GRAVY SISTER'S RECIPE",
  "PEPPER CHICKEN (SISTER-IN-LAW'S RECIPE)",
  "BLACK PEPPER CHICKEN GRAVY",
  "IDLI SPECIAL CHICKEN GRAVY",
];
const gravies = chickenNames.filter(isGravyStyleDish);
check("wings are not a gravy", !gravies.includes("CHICKEN WINGS"));
check("dry chicken is not a gravy", !gravies.includes("Chilly Chicken (Dry)"));
check("chilly gravy stays", gravies.includes("CHILLY CHICKEN GRAVY"));
check("mom's gravy stays", gravies.includes("CHICKEN GRAVY (MOM'S RECIPE)"));
check("sister's gravy stays", gravies.includes("CHICKEN GRAVY SISTER'S RECIPE"));
check("sister-in-law pepper stays, even without the word gravy", gravies.includes("PEPPER CHICKEN (SISTER-IN-LAW'S RECIPE)"));
check("pepper gravy and idli gravy stay", gravies.includes("BLACK PEPPER CHICKEN GRAVY") && gravies.includes("IDLI SPECIAL CHICKEN GRAVY"));

const duringDish = classifyTurn("tomorrow", "picking_item");
check(
  "a day during dish choice is not treated as the dish answer",
  duringDish.matches_pending_state === false,
);
const numberedPick = classifyTurn("2", "picking_item");
check(
  "a number during dish choice answers the picker",
  numberedPick.matches_pending_state === true && numberedPick.intent === "answer_pending_question",
);

if (process.exitCode) process.exit(process.exitCode);
