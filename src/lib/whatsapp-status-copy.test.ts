import assert from "node:assert/strict";
import { buildOrderStatusWhatsApp, type WaOrderBill, type WaOrderStage } from "./whatsapp-copy";

function bill(ref: string): WaOrderBill {
  return {
    ref,
    isCod: true,
    amount: 385,
    items: [],
    breakdown: { itemsSubtotal: 349, packaging: 20, delivery: 35, gst: 17 },
  };
}

const stages: WaOrderStage[] = [
  "placed_cod",
  "placed_paid",
  "accepted",
  "preparing",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
  "cod_collected",
];

for (const stage of stages) {
  const seen = new Set<string>();
  for (let n = 1; n <= 40; n++) {
    const ref = String(n).padStart(5, "0");
    seen.add(buildOrderStatusWhatsApp(stage, bill(ref)));
  }
  assert.ok(seen.size >= 3, `${stage} only produced ${seen.size} lines`);
  const once = buildOrderStatusWhatsApp(stage, bill("00025"));
  assert.equal(buildOrderStatusWhatsApp(stage, bill("00025")), once);
}

const rejected = buildOrderStatusWhatsApp("rejected", bill("00025"), undefined, {
  refundLine: "A full refund of ₹385 is on the way.",
});
assert.match(rejected, /A full refund of ₹385 is on the way/);

const preparing = [...Array(40)].map((_, i) =>
  buildOrderStatusWhatsApp("preparing", bill(String(i + 1).padStart(5, "0"))),
);
assert.equal(preparing.some((line) => line.includes("The stove is on")), true);
assert.equal(preparing.every((line) => line.includes("taking this personally")), false);

console.log("ok status copy rotates");
