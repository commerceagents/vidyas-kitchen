import {
  buildComplaintRecord,
  complaintDishLine,
  complaintItemRows,
  complaintOrderRow,
  looksLikeNewOrder,
  matchComplaintItemIndex,
  matchComplaintOrderFromText,
  parseComplaintAction,
  parseComplaintChoice,
  shouldStoreComplaint,
  splitComplaintBody,
} from "./whatsapp-complaint";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const ORDER = "37c30dfd-3be1-46a1-9780-8f65e6112259";

check("egg gravy order is not a complaint", looksLikeNewOrder("I would like to order egg gravy") === true);
check("a new complete order is not a complaint", looksLikeNewOrder("I would like to order egg a new complete order") === true);
check("a cold chicken note is a complaint", shouldStoreComplaint("the chicken was cold") === true);
check("a gravy note is a complaint", shouldStoreComplaint("gravy was missing from the box") === true);
check("a refund sentence is still filed", shouldStoreComplaint("I want a refund, the food was cold") === true);
check("an order sentence leaves the complaint flow", shouldStoreComplaint("I would like to order egg gravy") === false);
check("help me order leaves the complaint flow", shouldStoreComplaint("help me order chicken gravy") === false);
check("menu question leaves the complaint flow", shouldStoreComplaint("what's on the menu") === false);
check("track leaves the complaint flow", shouldStoreComplaint("track my order") === false);
check("driver question leaves the complaint flow", shouldStoreComplaint("where is my driver") === false);
check("help leaves the flow", shouldStoreComplaint("help") === false);
check("menu leaves the flow", shouldStoreComplaint("menu") === false);
check("a button id is not the complaint", shouldStoreComplaint("hs_complaint") === false);
check("empty is not a complaint", shouldStoreComplaint("  ") === false);

const row = complaintOrderRow({
  id: ORDER,
  ref: "#00003",
  meal: "Dinner",
  day: "7 Oct",
  items: [{ name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 }],
});
check("order row names the ticket and the meal", row.title === "#00003 · Dinner");
check("order row title fits a WhatsApp list", row.title.length <= 24);
check("order row description names the dish", row.description.includes("Mom's Recipe Chicken Gravy"));
check("order row description fits", row.description.length <= 72);

const many = complaintOrderRow({
  id: ORDER,
  ref: "#00002",
  meal: "Dinner",
  day: "7 Oct",
  items: [
    { name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 },
    { name: "Idli Special Chicken Gravy", weight: "1kg", qty: 1 },
  ],
});
check("a second dish is counted, not dropped silently", many.description.includes("+ 1 more"));

const items = complaintItemRows({
  id: ORDER,
  items: [
    { name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 },
    { name: "Idli Special Chicken Gravy", weight: "1kg", qty: 1 },
  ],
});
check("two dishes offer each dish and the whole order", items.length === 3);
check("item titles fit", items.every((item) => item.title.length <= 24 && item.description.length <= 72));
check(
  "tapping a dish row points at that dish",
  parseComplaintChoice(items[0].id)?.kind === "item" && parseComplaintChoice(items[0].id)?.itemIndex === 0,
);
check("the whole order row is its own choice", parseComplaintChoice(items[2].id)?.kind === "all");

check(
  "a picked order waits for the note",
  parseComplaintAction(`complaint:${ORDER}:0`)?.phase === "write" &&
    parseComplaintAction(`complaint:${ORDER}:0`)?.itemIndex === 0,
);
check("choosing an order is not the note yet", parseComplaintAction("complaint_pick")?.phase === "pick");

const saved = buildComplaintRecord(
  {
    ref: "#00003",
    when: "Dinner · 7 Oct",
    items: [{ name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 }],
  },
  "the chicken was cold",
);
const split = splitComplaintBody(saved);
check("the kitchen sees the order before the note", split.target.includes("#00003") && split.target.includes("500gm"));
check("the note is separate from the order", split.note === "the chicken was cold");
check("a dish line can name one pack", complaintDishLine([{ name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 }]).includes("500gm"));

const pickOrders = [
  {
    id: ORDER,
    ref: "#00003",
    meal: "Dinner",
    day: "7 Oct",
    items: [{ name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 }],
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    ref: "#00002",
    meal: "Lunch",
    day: "5 Oct",
    items: [{ name: "Egg Curry", weight: "500gm", qty: 1 }],
  },
];
check("complaint pick understands last order", matchComplaintOrderFromText("my last order", pickOrders)?.ref === "#00003");
check("complaint pick understands ticket number", matchComplaintOrderFromText("order #00002", pickOrders)?.ref === "#00002");
check("complaint pick understands dinner", matchComplaintOrderFromText("the dinner one", pickOrders)?.meal === "Dinner");
check("complaint item pick understands dish name", matchComplaintItemIndex("egg curry was cold", [{ name: "Egg Curry", weight: "500gm", qty: 1 }]) === 0);
check(
  "complaint item pick understands whole order",
  matchComplaintItemIndex("the whole order", [
    { name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 },
    { name: "Egg Curry", weight: "500gm", qty: 1 },
  ]) === "all",
);

if (process.exitCode) {
  console.error("complaint tests failed");
} else {
  console.log("complaint tests passed");
}
