/**
 * Simulates how free-text is routed before any WhatsApp send. Catches loops like
 * "I would like to order egg gravy" reopening the complaint picker.
 */
import { classifyTurn, routeTurn } from "./whatsapp-turn";
import { supportTopic } from "./whatsapp-support";
import { looksLikeFoodOrder, looksLikeNewOrder, prefersConversationalPath, shouldStoreComplaint } from "./whatsapp-complaint";

type Expect = "complaint" | "exit_complaint" | "support" | "order" | `turn:${string}`;

type Case = { say: string; expect: Expect; note: string };

function routeWhileComplaintOpen(say: string): "complaint" | "exit_complaint" {
  return shouldStoreComplaint(say) ? "complaint" : "exit_complaint";
}

function routeIdle(say: string): Expect {
  const topic = supportTopic(say);
  if (topic) return "support";
  if (looksLikeNewOrder(say)) return "order";
  return `turn:${classifyTurn(say, "ai_chat").intent}`;
}

const COMPLAINT_ARM: Case[] = [
  { say: "I would like to order egg gravy", expect: "exit_complaint", note: "the bug you hit" },
  { say: "I would like to order egg a new complete order", expect: "exit_complaint", note: "second try" },
  { say: "help me order chicken gravy", expect: "exit_complaint", note: "help that still orders" },
  { say: "i want chicken gravy for dinner", expect: "exit_complaint", note: "plain order sentence" },
  { say: "get me mutton gravy", expect: "exit_complaint", note: "get me" },
  { say: "menu", expect: "exit_complaint", note: "bare menu" },
  { say: "what's on the menu", expect: "exit_complaint", note: "menu question" },
  { say: "track my order", expect: "exit_complaint", note: "status while complaining" },
  { say: "where is my driver", expect: "exit_complaint", note: "driver question" },
  { say: "what is your refund policy", expect: "exit_complaint", note: "refund FAQ" },
  { say: "help", expect: "exit_complaint", note: "help word" },
  { say: "never mind", expect: "exit_complaint", note: "bail out" },
  { say: "the chicken was cold", expect: "complaint", note: "real note" },
  { say: "gravy was missing from the box", expect: "complaint", note: "missing item" },
  { say: "I want a refund, the food was cold", expect: "complaint", note: "refund + problem stays a note" },
  { say: "this gravy was terrible", expect: "complaint", note: "complaint keyword" },
];

const IDLE: Case[] = [
  { say: "I would like to order chicken gravy", expect: "order", note: "order is not support" },
  { say: "help me order chicken gravy", expect: "order", note: "help me order" },
  { say: "help", expect: "support", note: "opens help list" },
  { say: "what is your refund policy", expect: "support", note: "refund FAQ" },
  { say: "where is my driver", expect: "support", note: "driver" },
  { say: "any offers today", expect: "support", note: "offers" },
  { say: "are you a bot?", expect: "support", note: "bot" },
  { say: "what's on the menu", expect: "turn:ask_menu", note: "menu question" },
  { say: "Is there any pending order of me?", expect: "turn:ask_status", note: "status not menu" },
  { say: "this gravy was terrible", expect: "turn:complaint", note: "complaint during idle" },
];

const PENDING: Case[] = [
  {
    say: "tomorrow",
    expect: "turn:answer_pending_question",
    note: "day answers date picker",
  },
  {
    say: "I would like to order chicken gravy",
    expect: "turn:unclear",
    note: "order while picking date is still heard, then clarified",
  },
  {
    say: "what's on the menu",
    expect: "turn:ask_menu",
    note: "menu while picking date",
  },
];

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

let failed = 0;
for (const row of COMPLAINT_ARM) {
  const got = routeWhileComplaintOpen(row.say);
  if (got !== row.expect) {
    failed += 1;
    console.error(`FAIL complaint arm: "${row.say}" → ${got}, wanted ${row.expect} (${row.note})`);
    process.exitCode = 1;
  } else {
    console.log("ok complaint arm:", row.note);
  }
}

for (const row of IDLE) {
  const got = routeIdle(row.say);
  if (got !== row.expect) {
    failed += 1;
    console.error(`FAIL idle: "${row.say}" → ${got}, wanted ${row.expect} (${row.note})`);
    process.exitCode = 1;
  } else {
    console.log("ok idle:", row.note);
  }
}

for (const row of PENDING) {
  const turn = classifyTurn(row.say, "picking_date");
  const got = `turn:${turn.intent}`;
  if (got !== row.expect) {
    failed += 1;
    console.error(`FAIL pending: "${row.say}" → ${got}, wanted ${row.expect} (${row.note})`);
    process.exitCode = 1;
  } else {
    console.log("ok pending:", row.note);
  }
}

const menuWhileDate = routeTurn("picking_date", classifyTurn("what's on the menu", "picking_date"), 0);
check("egg gravy prefers conversation", prefersConversationalPath("I would like to order egg gravy") === true);
check("chicken gravy prefers conversation", prefersConversationalPath("chicken gravy for tomorrow dinner") === true);
check("hi prefers conversation", prefersConversationalPath("hi") === true);
check("refund question prefers conversation", prefersConversationalPath("what is your refund policy?") === true);
check(
  "mutton availability is food order",
  looksLikeFoodOrder("I want mutton gravy is it available") === true,
);
check("i want chicken is food order", looksLikeFoodOrder("I want chicken gravy") === true);
check("refund is not food order", looksLikeFoodOrder("what is your refund policy?") === false);

check("menu while picking date is answered then re-asked", menuWhileDate.action === "answer_menu_then_reask");

const orderWhileDate = routeTurn("picking_date", classifyTurn("I would like to order chicken gravy", "picking_date"), 0);
check("order while picking date asks what they meant", orderWhileDate.action === "clarify");

if (process.exitCode) {
  console.error(`routing audit failed (${failed} case(s))`);
  process.exit(process.exitCode);
}
console.log(`routing audit passed (${COMPLAINT_ARM.length + IDLE.length + PENDING.length + 2} checks)`);
