import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { getOrderRevenueAmount, orderItemsSubtotal } from "@/lib/order-pricing";
import {
  type DashboardOrder,
  type MonthKey,
  filterOrdersByMonth,
  isBillableOrder,
  isSameMonth,
  shiftMonth,
} from "@/lib/dashboard/orders";

export type RevenueTrends = {
  totalSales: number | null;
  totalRevenue: number | null;
  productSales: number | null;
  avgOrderValue: number | null;
};

export type RevenueBarPoint = {
  key: MonthKey;
  label: string;
  value: number;
};

export type MealSlice = {
  label: string;
  value: number;
  color: string;
};

export type CalendarDayMeta = {
  revenue: number;
  orderCount: number;
  /** breakfast | lunch | dinner | mixed */
  tone: "breakfast" | "lunch" | "dinner" | "mixed" | "none";
};

export type RevenueDashboardStats = {
  totalSales: number;
  totalRevenue: number;
  productSales: number;
  avgOrderValue: number;
  trends: RevenueTrends;
  mealSlices: MealSlice[];
  mealTotal: number;
  calendarDays: Record<string, CalendarDayMeta>;
};

const MEAL_COLORS = {
  Breakfast: "#22D3EE",
  Lunch: "#FACC15",
  Dinner: "#A78BFA",
  Other: "#666666",
} as const;

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthShortLabel(key: MonthKey): string {
  return new Date(key.year, key.month, 1).toLocaleDateString("en-IN", { month: "short" });
}

function orderDayKey(order: DashboardOrder): string | null {
  if (!order.delivery_slot && !order.created_at) return null;
  const iso = order.delivery_slot || order.created_at;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function mealBucket(order: DashboardOrder): keyof typeof MEAL_COLORS {
  const slot = String(order.delivery_slot_kind || "").toLowerCase();
  if (slot.includes("breakfast")) return "Breakfast";
  if (slot.includes("lunch")) return "Lunch";
  if (slot.includes("dinner")) return "Dinner";
  return "Other";
}

function buildMealSlices(mealTotals: Record<string, number>): { mealSlices: MealSlice[]; mealTotal: number } {
  const mealSlices: MealSlice[] = (["Breakfast", "Lunch", "Dinner", "Other"] as const)
    .map((label) => ({
      label,
      value: mealTotals[label] ?? 0,
      color: MEAL_COLORS[label],
    }))
    .filter((s) => s.value > 0);
  const mealTotal = mealSlices.reduce((s, m) => s + m.value, 0);
  return { mealSlices, mealTotal };
}

function aggregateOrderMetrics(orders: DashboardOrder[]) {
  let totalSales = 0;
  let totalRevenue = 0;
  let productSales = 0;
  let deliveredCount = 0;

  const mealTotals: Record<string, number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Other: 0,
  };

  for (const o of orders) {
    if (!isBillableOrder(o)) continue;
    const amt = getOrderRevenueAmount(o);
    const status = normalizeOrderStatus(o.status);
    totalRevenue += amt;

    if (status === OrderStatus.DELIVERED) {
      totalSales += amt;
      productSales += orderItemsSubtotal(o.items);
      deliveredCount++;
      mealTotals[mealBucket(o)] += amt;
    }
  }

  return {
    totalSales,
    totalRevenue,
    productSales,
    deliveredCount,
    mealTotals,
    avgOrderValue: deliveredCount > 0 ? Math.round(totalSales / deliveredCount) : 0,
  };
}

function computeMonthSnapshot(orders: DashboardOrder[], month: MonthKey) {
  const monthOrders = filterOrdersByMonth(orders, month);
  const metrics = aggregateOrderMetrics(monthOrders);
  const calendarDays: Record<string, CalendarDayMeta> = {};

  for (const o of monthOrders) {
    if (!isBillableOrder(o)) continue;
    const status = normalizeOrderStatus(o.status);
    if (status !== OrderStatus.DELIVERED) continue;

    const amt = getOrderRevenueAmount(o);
    const day = orderDayKey(o);
    if (!day) continue;

    const prev = calendarDays[day] ?? { revenue: 0, orderCount: 0, tone: "none" as const };
    const nextCount = prev.orderCount + 1;
    const slot = String(o.delivery_slot_kind || "").toLowerCase();
    let tone = prev.tone;
    if (nextCount === 1) {
      if (slot.includes("breakfast")) tone = "breakfast";
      else if (slot.includes("lunch")) tone = "lunch";
      else if (slot.includes("dinner")) tone = "dinner";
      else tone = "mixed";
    } else if (prev.tone !== "mixed") {
      const first = prev.tone;
      const second =
        slot.includes("breakfast") ? "breakfast" :
        slot.includes("lunch") ? "lunch" :
        slot.includes("dinner") ? "dinner" : "mixed";
      tone = first === second ? first : "mixed";
    }
    calendarDays[day] = {
      revenue: prev.revenue + amt,
      orderCount: nextCount,
      tone,
    };
  }

  return {
    ...metrics,
    calendarDays,
  };
}

export type RevenueDayStats = {
  totalSales: number;
  totalRevenue: number;
  productSales: number;
  avgOrderValue: number;
  mealSlices: MealSlice[];
  mealTotal: number;
};

export function dayKeyForDate(month: MonthKey, day: number): string {
  return `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayDayKey(): string {
  const now = new Date();
  return dayKeyForDate({ year: now.getFullYear(), month: now.getMonth() }, now.getDate());
}

export function formatDayKeyLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function computeRevenueDayStats(
  orders: DashboardOrder[],
  month: MonthKey,
  dayKey: string,
): RevenueDayStats {
  const monthOrders = filterOrdersByMonth(orders, month);
  const dayOrders = monthOrders.filter((o) => orderDayKey(o) === dayKey);
  const metrics = aggregateOrderMetrics(dayOrders);
  const { mealSlices, mealTotal } = buildMealSlices(metrics.mealTotals);

  return {
    totalSales: metrics.totalSales,
    totalRevenue: metrics.totalRevenue,
    productSales: metrics.productSales,
    avgOrderValue: metrics.avgOrderValue,
    mealSlices,
    mealTotal,
  };
}

export function computeRevenueDashboardStats(
  orders: DashboardOrder[],
  month: MonthKey,
): RevenueDashboardStats {
  const current = computeMonthSnapshot(orders, month);
  const previous = computeMonthSnapshot(orders, shiftMonth(month, -1));

  const { mealSlices, mealTotal } = buildMealSlices(current.mealTotals);

  return {
    totalSales: current.totalSales,
    totalRevenue: current.totalRevenue,
    productSales: current.productSales,
    avgOrderValue: current.avgOrderValue,
    trends: {
      totalSales: pctChange(current.totalSales, previous.totalSales),
      totalRevenue: pctChange(current.totalRevenue, previous.totalRevenue),
      productSales: pctChange(current.productSales, previous.productSales),
      avgOrderValue: pctChange(current.avgOrderValue, previous.avgOrderValue),
    },
    mealSlices,
    mealTotal,
    calendarDays: current.calendarDays,
  };
}

/** Jan–Dec total sales for one calendar year (Monthly Sales chart). */
export function computeYearlySalesBars(orders: DashboardOrder[], year: number): RevenueBarPoint[] {
  const bars: RevenueBarPoint[] = [];
  for (let month = 0; month < 12; month++) {
    const key = { year, month };
    const snap = computeMonthSnapshot(orders, key);
    bars.push({
      key,
      label: monthShortLabel(key),
      value: snap.totalSales,
    });
  }
  return bars;
}

export function monthRangeLabel(start: MonthKey, end: MonthKey): string {
  const s = new Date(start.year, start.month, 1).toLocaleDateString("en-IN", { month: "short" });
  const e = new Date(end.year, end.month, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

export function isCurrentMonth(key: MonthKey): boolean {
  const now = new Date();
  return isSameMonth(key, { year: now.getFullYear(), month: now.getMonth() });
}
