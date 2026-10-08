import {
  readStaleOrderContext,
  staleNoticeAlreadySent,
  staleOrderTurn,
  turnsWithStaleOrder,
} from "./whatsapp-stale-order";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const turns = [staleOrderTurn("abc-123", "not_sent")];
check("reads stale order context", readStaleOrderContext(turns)?.orderId === "abc-123");
check("detects duplicate stale notice", staleNoticeAlreadySent(turns, "abc-123", "not_sent") === true);
check(
  "different kind is not a duplicate",
  staleNoticeAlreadySent(turns, "abc-123", "unfinished_trip") === false,
);
const merged = turnsWithStaleOrder([{ role: "user", content: "hi" }], "xyz", "unfinished_trip");
check("replaces previous stale marker", merged.some((t) => t.content.includes("xyz:unfinished_trip")));

if (process.exitCode) process.exit(process.exitCode);
