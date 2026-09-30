import assert from "node:assert/strict";
import { summarizeUsualOrders, type UsualSourceOrder } from "./whatsapp-usual";

const keema = (qty: number): UsualSourceOrder["items"][number] => ({
  menuItemId: "keema",
  name: "Grandma Mutton Keema",
  variant: "500gm",
  quantity: qty,
});

const orders: UsualSourceOrder[] = [
  {
    status: "delivered",
    payment_method: "cod",
    delivery_address: "12 Anna Nagar, Sivakasi",
    delivery_slot_kind: "lunch",
    items: [keema(2)],
  },
  {
    status: "delivered",
    payment_method: "online",
    delivery_address: "12 Anna Nagar, Sivakasi",
    delivery_slot_kind: "dinner",
    items: [keema(1)],
  },
  {
    status: "delivered",
    payment_method: "cod",
    delivery_address: "12 Anna Nagar, Sivakasi",
    delivery_slot_kind: "lunch",
    items: [keema(2)],
  },
  {
    status: "cancelled",
    payment_method: "online",
    delivery_address: "somewhere else",
    delivery_slot_kind: "breakfast",
    items: [keema(9)],
  },
];

const profile = summarizeUsualOrders(orders);
assert.ok(profile);
assert.equal(profile.dishes[0]?.variant, "500gm");
assert.equal(profile.dishes[0]?.quantity, 2);
assert.equal(profile.payment, "cod");
assert.equal(profile.slotKind, "lunch");
assert.equal(profile.address, "12 Anna Nagar, Sivakasi");

const newestWinsTie = summarizeUsualOrders([
  {
    status: "delivered",
    payment_method: "online",
    delivery_address: "12 Anna Nagar, Sivakasi",
    delivery_slot_kind: "dinner",
    items: [keema(1)],
  },
  {
    status: "delivered",
    payment_method: "cod",
    delivery_address: "12 Anna Nagar, Sivakasi",
    delivery_slot_kind: "lunch",
    items: [keema(1)],
  },
]);
assert.equal(newestWinsTie?.payment, "online");
assert.equal(newestWinsTie?.slotKind, "dinner");
