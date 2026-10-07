/**
 * Every supportTopic must map to a dedicated handler — not handleAiChat (empty cart).
 */
import { supportTopic, type SupportTopic } from "./whatsapp-support";

const DIRECT_HANDLERS = new Set<SupportTopic>([
  "help",
  "refund",
  "cancel_placed",
  "cancel_policy",
  "call",
  "driver",
  "offers",
  "address",
  "bot",
  "presence",
  "best_seller",
  "spicy",
  "resubscribe",
]);

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const cases: { say: string; topic: SupportTopic }[] = [
  { say: "help", topic: "help" },
  { say: "customer care", topic: "help" },
  { say: "I need assistance", topic: "help" },
  { say: "Call the kitchen", topic: "call" },
  { say: "can I connect with the kitchen", topic: "call" },
  { say: "what is your refund policy", topic: "refund" },
  { say: "how do I cancel", topic: "cancel_policy" },
  { say: "cancel my order", topic: "cancel_placed" },
  { say: "where is my driver", topic: "driver" },
  { say: "any offers today", topic: "offers" },
  { say: "what address do you have", topic: "address" },
  { say: "are you a bot?", topic: "bot" },
  { say: "hey are you there", topic: "presence" },
  { say: "what do people order", topic: "best_seller" },
  { say: "suggest something spicy", topic: "spicy" },
  { say: "turn promos back on", topic: "resubscribe" },
];

for (const row of cases) {
  const got = supportTopic(row.say);
  check(`"${row.say}" → ${row.topic}`, got === row.topic);
  if (got) check(`"${row.say}" has direct handler`, DIRECT_HANDLERS.has(got));
}

check("help me order is not support", supportTopic("help me order chicken gravy") === null);

if (process.exitCode) process.exit(process.exitCode);
console.log("support routing tests passed");
