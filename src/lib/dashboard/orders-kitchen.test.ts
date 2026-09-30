import assert from "node:assert/strict";
import type { DashboardOrder } from "./orders";
import { currentMonthKey, filterOrdersByMonth, filterOrdersForKitchen, tabForOrder } from "./orders";
import { OrderStatus } from "../order-status";

function order(partial: Pick<DashboardOrder, "id" | "status" | "delivery_slot">): DashboardOrder {
  return {
    order_number: 1,
    phone_number: null,
    customer_name: null,
    total_amount: 100,
    created_at: "2026-09-30T08:00:00.000Z",
    delivery_slot_kind: "lunch",
    payment_method: "cod",
    payment_status: "pending",
    cod_failure_reason: null,
    refund_status: null,
    refund_amount: null,
    driver_last_lat: null,
    driver_last_lng: null,
    driver_location_at: null,
    driver_arrived_at: null,
    items: [],
    ...partial,
  };
}

const now = currentMonthKey();
const next = now.month === 11 ? { year: now.year + 1, month: 0 } : { year: now.year, month: now.month + 1 };
const nextMonthIso = new Date(Date.UTC(next.year, next.month, 2, 6, 30)).toISOString();

const placedForNextMonth = order({
  id: "next-month",
  status: OrderStatus.PAID,
  delivery_slot: nextMonthIso,
});
const waitingOnPayment = order({
  id: "unpaid",
  status: OrderStatus.PENDING_PAYMENT,
  delivery_slot: nextMonthIso,
});
const deliveredLastMonth = order({
  id: "old",
  status: OrderStatus.DELIVERED,
  delivery_slot: "2020-01-02T06:30:00.000Z",
});

const monthOnly = filterOrdersByMonth([placedForNextMonth], now);
assert.equal(monthOnly.length, 0, "delivery month hides a just-placed order from the current month");

const kitchen = filterOrdersForKitchen([placedForNextMonth, waitingOnPayment, deliveredLastMonth], now);
assert.deepEqual(
  kitchen.map((o) => o.id).sort(),
  ["next-month", "unpaid"],
  "current month board keeps open orders whose slot is next month",
);

assert.equal(tabForOrder(OrderStatus.PENDING_PAYMENT), "new");
assert.equal(tabForOrder(OrderStatus.PAID), "new");
assert.equal(tabForOrder(OrderStatus.CANCELLED), "cancelled");

const past = filterOrdersForKitchen([placedForNextMonth], { year: 2020, month: 0 });
assert.equal(past.length, 0, "a past month does not pull in today's open orders");

console.log("orders-kitchen tests passed");
