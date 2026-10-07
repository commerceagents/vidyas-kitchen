import { buildCancelPolicyAnswer, buildDriverAnswer, buildOfferAnswer, buildRefundAnswer, callUsDialReply } from "./whatsapp-copy";
import { supportOrderNumber, supportTopic } from "./whatsapp-support";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

check("chicken order is not support", supportTopic("I would like to order chicken gravy") === null);
check("help opens the list", supportTopic("help") === "help");
check("help me order stays an order", supportTopic("help me order chicken gravy") === null);
check("bare cancel stays a draft drop", supportTopic("cancel") === null);
check("refund is a refund question", supportTopic("what is your refund policy") === "refund");
check("money back is a refund", supportTopic("when do I get my money back") === "refund");
check("cancel my order is a placed cancel", supportTopic("cancel my order") === "cancel_placed");
check("cancel number is a placed cancel", supportTopic("cancel #00003") === "cancel_placed");
check("how do I cancel is the policy", supportTopic("how do I cancel") === "cancel_policy");
check("kitchen phone is a call", supportTopic("can I connect with the kitchen") === "call");
check("call the kitchen is a call", supportTopic("Call the kitchen") === "call");
check("call us is a call", supportTopic("call") === "call");
check("customer care opens help", supportTopic("customer care") === "help");
check("best seller question", supportTopic("what do people order") === "best_seller");
check("spicy suggestion", supportTopic("suggest something spicy") === "spicy");
check("driver question", supportTopic("where is my driver") === "driver");
check("offers", supportTopic("any offers today") === "offers");
check("bot", supportTopic("are you a bot?") === "bot");
check("presence", supportTopic("hey are you there") === "presence");
check("ordering is not presence", supportTopic("are you there I want chicken gravy for dinner tomorrow please now") === null);
check("order number", supportOrderNumber("cancel #00017") === 17);

const refund = buildRefundAnswer(null);
check("refund names the 12 hour rule", refund.includes("12 hours"));
check("refund names the kitchen phone", refund.includes("+919384020119"));
check("refund does not invent a payout", !/on the way|has gone back|has started/i.test(refund));

const live = buildRefundAnswer({
  ref: "#00003",
  refundStatus: "refunded",
  payment: "online",
  total: "₹421",
});
check("a finished refund is said out loud", live.includes("has gone back") && live.includes("#00003"));

const closed = buildDriverAnswer({ ref: null, name: null, phone: null, km: null, status: null });
check("no driver is invented", closed.includes("No rider") && !/Anand|minutes away/i.test(closed));

const offer = buildOfferAnswer(null);
check("a quiet festival calendar stays quiet", offer.includes("Nothing festive") && !offer.includes("20%"));

const nav = buildOfferAnswer({ name: "Navaratri", pct: 20, until: "11 Oct" });
check("a live offer uses the given percent", nav.includes("Navaratri") && nav.includes("20%"));

check("cancel policy has the phone", buildCancelPolicyAnswer().includes("+919384020119"));

const callBare = callUsDialReply();
check("a call with no orders does not ask them to remember a number", callBare.includes("+919384020119") && !/order number if you have/i.test(callBare));

const callListed = callUsDialReply(undefined, [
  { ref: "#00005", dishes: "Mutton gravy", orderedOn: "Fri, 9 Oct" },
]);
check("a call lists the dish, the order date, and the number", callListed.includes("Mutton gravy") && callListed.includes("Fri, 9 Oct") && callListed.includes("#00005"));

if (process.exitCode) process.exit(process.exitCode);
console.log("support tests passed");
