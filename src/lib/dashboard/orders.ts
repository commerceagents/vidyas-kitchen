import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";

export type DashboardOrderItem = {
  quantity: number;
  name: string;
  unit_price?: number;
};

export type DashboardOrder = {
  id: string;
  status: string;
  phone_number: string | null;
  customer_name: string | null;
  total_amount: number | null;
  created_at: string;
  delivery_slot: string | null;
  delivery_slot_kind: string | null;
  items: DashboardOrderItem[];
};

export type MonthKey = { year: number; month: number };

export function monthLabel(key: MonthKey, short = false): string {
  const d = new Date(key.year, key.month, 1);
  if (short) {
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const d = new Date(key.year, key.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function currentMonthKey(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function orderMonthKey(order: DashboardOrder): MonthKey | null {
  const slot = order.delivery_slot?.slice(0, 10);
  if (slot && /^\d{4}-\d{2}-\d{2}$/.test(slot)) {
    const [y, m] = slot.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const created = order.created_at?.slice(0, 10);
  if (created && /^\d{4}-\d{2}-\d{2}$/.test(created)) {
    const [y, m] = created.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  return null;
}

export function isSameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}

export function filterOrdersByMonth(orders: DashboardOrder[], month: MonthKey) {
  return orders.filter((o) => {
    const mk = orderMonthKey(o);
    return mk ? isSameMonth(mk, month) : false;
  });
}

export function filterOrdersByIdQuery(orders: DashboardOrder[], query: string) {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return orders;
  return orders.filter((o) => o.id.toLowerCase().includes(q));
}

export function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function isNewPaidOrder(status: string) {
  return normalizeOrderStatus(status) === OrderStatus.PAID;
}

export type DashboardTab = "new" | "preparing" | "awaiting" | "dispatched" | "completed" | "cancelled";

export function tabForOrder(status: string): DashboardTab {
  const s = normalizeOrderStatus(status);
  if (s === OrderStatus.PAID) return "new";
  if (s === OrderStatus.CONFIRMED || s === OrderStatus.PREPARING) return "preparing";
  if (s === OrderStatus.READY) return "awaiting";
  if (s === OrderStatus.OUT_FOR_DELIVERY) return "dispatched";
  if (s === OrderStatus.DELIVERED) return "completed";
  return "cancelled";
}
