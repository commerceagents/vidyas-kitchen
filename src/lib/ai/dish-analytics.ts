import { type DashboardOrder, type DashboardOrderItem } from "@/lib/dashboard/orders";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { getOrderRevenueAmount } from "@/lib/order-pricing";
import { type FestivalRow } from "@/lib/menu/discount-pricing";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { variantIdToDishIdMap } from "@/lib/menu/best-selling";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DishPerformance = {
  dishId: string;
  dishName: string;
  category: string | null;
  totalOrders: number;
  totalRevenue: number;
  avgRevenuePerOrder: number;
  daysSinceLastOrder: number | null;
  trendPct: number | null;
  mealBreakdown: { breakfast: number; lunch: number; dinner: number };
  /** Mean stars on orders that included this dish (last 60 days loaded). */
  avgRating: number | null;
  ratingCount: number;
  /** Newest written complaint (3 stars or below), when there is one. */
  lowReview: string | null;
};

export type CategoryStats = {
  category: string;
  avgOrders: number;
  avgRevenue: number;
  dishCount: number;
};

export type MealPerformance = {
  meal: "breakfast" | "lunch" | "dinner";
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
};

export type UpcomingFestival = FestivalRow & {
  daysUntilStart: number;
  daysUntilEnd: number;
  shouldActivate: boolean;
  shouldDeactivate: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mealSlotOf(order: DashboardOrder): "breakfast" | "lunch" | "dinner" {
  const kind = (order.delivery_slot_kind ?? "").toLowerCase();
  if (kind.includes("breakfast")) return "breakfast";
  if (kind.includes("dinner")) return "dinner";
  return "lunch";
}

const KITCHEN_TZ = "Asia/Kolkata";

/** Calendar day in the kitchen, as YYYY-MM-DD. UTC midnight is still the previous evening in Sivakasi. */
export function kitchenDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KITCHEN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from the kitchen's today to a YYYY-MM-DD date. Negative when that date has passed. */
export function daysFromKitchenToday(ymd: string, now = new Date()): number {
  const today = Date.parse(`${kitchenDateKey(now)}T12:00:00Z`);
  const target = Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(today) || !Number.isFinite(target)) return 0;
  return Math.round((target - today) / 86_400_000);
}

function shiftDateKey(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T12:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function orderKitchenDay(order: DashboardOrder): string {
  const slot = order.delivery_slot ? new Date(order.delivery_slot) : null;
  const created = new Date(order.created_at);
  const when = slot && !Number.isNaN(slot.getTime()) ? slot : created;
  if (Number.isNaN(when.getTime())) return kitchenDateKey();
  return kitchenDateKey(when);
}

function orderCountsForSales(order: DashboardOrder): boolean {
  const s = normalizeOrderStatus(order.status);
  return (
    s === OrderStatus.PAID ||
    s === OrderStatus.CONFIRMED ||
    s === OrderStatus.PREPARING ||
    s === OrderStatus.READY ||
    s === OrderStatus.OUT_FOR_DELIVERY ||
    s === OrderStatus.DELIVERED
  );
}

function menuLookup() {
  const byId = new Map(
    Object.values(MENU_BY_CATEGORY)
      .flat()
      .map((d) => [d.id, d]),
  );
  const byName = new Map(
    Object.values(MENU_BY_CATEGORY)
      .flat()
      .map((d) => [d.name.toLowerCase(), d]),
  );
  const variantToDish = variantIdToDishIdMap();
  return { byId, byName, variantToDish };
}

function resolveDishMeta(item: DashboardOrderItem) {
  const { byId, byName, variantToDish } = menuLookup();
  const rawId = item.menuItemId?.trim() || null;
  const parentId = rawId ? variantToDish.get(rawId) ?? rawId : null;
  const fromId = parentId ? byId.get(parentId) : undefined;
  if (fromId) {
    return { dishId: fromId.id, dishName: fromId.name, category: fromId.category ?? null };
  }
  const fromName = byName.get(item.name.toLowerCase());
  if (fromName) {
    return { dishId: fromName.id, dishName: fromName.name, category: fromName.category ?? null };
  }
  return { dishId: parentId || item.name, dishName: item.name, category: null as string | null };
}

// ─── Dish Performance ────────────────────────────────────────────────────────

type DishBucket = {
  name: string;
  category: string | null;
  orders: number;
  revenue: number;
  lastOrderDay: string | null;
  meals: { breakfast: number; lunch: number; dinner: number };
  ratingSum: number;
  ratingCount: number;
  ratedOrders: Set<string>;
  lowReview: string | null;
  lowReviewAt: string | null;
};

function emptyBucket(name: string, category: string | null): DishBucket {
  return {
    name,
    category,
    orders: 0,
    revenue: 0,
    lastOrderDay: null,
    meals: { breakfast: 0, lunch: 0, dinner: 0 },
    ratingSum: 0,
    ratingCount: 0,
    ratedOrders: new Set(),
    lowReview: null,
    lowReviewAt: null,
  };
}

export function computeDishPerformance(
  orders: DashboardOrder[],
  days: number = 7,
  now = new Date(),
): DishPerformance[] {
  const today = kitchenDateKey(now);
  const cutoff = shiftDateKey(today, -(days - 1));
  const prevCutoff = shiftDateKey(cutoff, -days);

  const currentOrders = orders.filter((o) => {
    const day = orderKitchenDay(o);
    return day >= cutoff && day <= today && orderCountsForSales(o);
  });

  const prevOrders = orders.filter((o) => {
    const day = orderKitchenDay(o);
    return day >= prevCutoff && day < cutoff && orderCountsForSales(o);
  });

  const dishMap = new Map<string, DishBucket>();

  for (const dish of Object.values(MENU_BY_CATEGORY).flat()) {
    dishMap.set(dish.id, emptyBucket(dish.name, dish.category ?? null));
  }

  const prevDishMap = new Map<string, { orders: number; revenue: number }>();

  for (const order of currentOrders) {
    const meal = mealSlotOf(order);
    const day = orderKitchenDay(order);
    for (const item of order.items) {
      const meta = resolveDishMeta(item);
      const key = meta.dishId;
      const entry = dishMap.get(key) ?? emptyBucket(meta.dishName, meta.category);
      entry.name = meta.dishName;
      entry.category = meta.category ?? entry.category;
      entry.orders += item.quantity;
      entry.revenue += (item.unit_price ?? 0) * item.quantity;
      entry.meals[meal] += item.quantity;
      if (!entry.lastOrderDay || day > entry.lastOrderDay) entry.lastOrderDay = day;
      dishMap.set(key, entry);
    }
  }

  // Ratings and written reviews cover the whole loaded history, not only the sales week.
  for (const order of orders) {
    if (!orderCountsForSales(order)) continue;
    const stars = order.rating_stars;
    if (typeof stars !== "number" || stars < 1 || stars > 5) continue;
    const day = orderKitchenDay(order);
    const comment = (order.rating_comment || "").trim();
    for (const item of order.items) {
      const meta = resolveDishMeta(item);
      const entry = dishMap.get(meta.dishId) ?? emptyBucket(meta.dishName, meta.category);
      entry.name = meta.dishName;
      entry.category = meta.category ?? entry.category;
      if (entry.ratedOrders.has(order.id)) continue;
      entry.ratedOrders.add(order.id);
      entry.ratingSum += stars;
      entry.ratingCount += 1;
      if (stars <= 3 && comment && (!entry.lowReviewAt || day >= entry.lowReviewAt)) {
        entry.lowReview = comment;
        entry.lowReviewAt = day;
      }
      dishMap.set(meta.dishId, entry);
    }
  }

  for (const order of prevOrders) {
    for (const item of order.items) {
      const meta = resolveDishMeta(item);
      const key = meta.dishId;
      const entry = prevDishMap.get(key) ?? { orders: 0, revenue: 0 };
      entry.orders += item.quantity;
      entry.revenue += (item.unit_price ?? 0) * item.quantity;
      prevDishMap.set(key, entry);
    }
  }

  const results: DishPerformance[] = [];
  for (const [dishId, data] of dishMap.entries()) {
    const prev = prevDishMap.get(dishId);
    let trendPct: number | null = null;
    if (prev && prev.revenue > 0) {
      trendPct = Math.round(((data.revenue - prev.revenue) / prev.revenue) * 100);
    }

    results.push({
      dishId,
      dishName: data.name,
      category: data.category,
      totalOrders: data.orders,
      totalRevenue: data.revenue,
      avgRevenuePerOrder: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
      daysSinceLastOrder: data.lastOrderDay ? daysFromKitchenToday(data.lastOrderDay, now) * -1 : null,
      trendPct,
      mealBreakdown: data.meals,
      avgRating: data.ratingCount > 0 ? Math.round((data.ratingSum / data.ratingCount) * 10) / 10 : null,
      ratingCount: data.ratingCount,
      lowReview: data.lowReview,
    });
  }

  return results;
}

// ─── Category Stats ──────────────────────────────────────────────────────────

export function computeCategoryStats(dishPerformances: DishPerformance[]): CategoryStats[] {
  const catMap = new Map<string, { totalOrders: number; totalRevenue: number; count: number }>();

  for (const dp of dishPerformances) {
    // Unsold dishes stay in the list, but they must not pull the category average down to zero.
    if (dp.totalOrders <= 0) continue;
    const cat = dp.category ?? "uncategorized";
    const entry = catMap.get(cat) ?? { totalOrders: 0, totalRevenue: 0, count: 0 };
    entry.totalOrders += dp.totalOrders;
    entry.totalRevenue += dp.totalRevenue;
    entry.count++;
    catMap.set(cat, entry);
  }

  return Array.from(catMap.entries()).map(([category, data]) => ({
    category,
    avgOrders: data.count > 0 ? Math.round(data.totalOrders / data.count) : 0,
    avgRevenue: data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0,
    dishCount: data.count,
  }));
}

// ─── Meal Performance ────────────────────────────────────────────────────────

export function computeMealPerformance(
  orders: DashboardOrder[],
  days: number = 7,
  now = new Date(),
): MealPerformance[] {
  const cutoff = shiftDateKey(kitchenDateKey(now), -(days - 1));

  const meals: Record<"breakfast" | "lunch" | "dinner", { revenue: number; count: number }> = {
    breakfast: { revenue: 0, count: 0 },
    lunch: { revenue: 0, count: 0 },
    dinner: { revenue: 0, count: 0 },
  };

  for (const order of orders) {
    if (orderKitchenDay(order) < cutoff) continue;
    if (!orderCountsForSales(order)) continue;

    const meal = mealSlotOf(order);
    const amt = getOrderRevenueAmount(order);
    meals[meal].revenue += amt;
    meals[meal].count++;
  }

  return (["breakfast", "lunch", "dinner"] as const).map((meal) => ({
    meal,
    totalRevenue: meals[meal].revenue,
    orderCount: meals[meal].count,
    avgOrderValue: meals[meal].count > 0 ? Math.round(meals[meal].revenue / meals[meal].count) : 0,
  }));
}

// ─── Festival Detection ──────────────────────────────────────────────────────

export function detectUpcomingFestivals(
  festivals: FestivalRow[],
  advanceDays: number = 7,
  now = new Date(),
): UpcomingFestival[] {
  const results: UpcomingFestival[] = [];

  for (const f of festivals) {
    const start = new Date(`${f.date_start}T12:00:00Z`);
    const end = new Date(`${f.date_end}T12:00:00Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const daysUntilStart = daysFromKitchenToday(f.date_start, now);
    const daysUntilEnd = daysFromKitchenToday(f.date_end, now);

    // A week before the first day, through the last day. The morning after it ends, turn it off.
    const shouldActivate = !f.active && daysUntilStart <= advanceDays && daysUntilEnd >= 0;
    const shouldDeactivate = f.active && daysUntilEnd < 0;

    results.push({
      ...f,
      daysUntilStart,
      daysUntilEnd,
      shouldActivate,
      shouldDeactivate,
    });
  }

  return results.filter((f) => f.shouldActivate || f.shouldDeactivate);
}

// ─── Identify Low/High Performers ───────────────────────────────────────────

export function identifyLowPerformers(
  dishes: DishPerformance[],
  categoryStats: CategoryStats[],
  threshold: number = 0.3,
): DishPerformance[] {
  const catMap = new Map(categoryStats.map((c) => [c.category, c]));
  return dishes.filter((d) => {
    const cat = catMap.get(d.category ?? "uncategorized");
    if (!cat || cat.avgOrders === 0) return false;
    return d.totalOrders < cat.avgOrders * threshold;
  });
}

export function identifyHighPerformers(
  dishes: DishPerformance[],
  categoryStats: CategoryStats[],
  topPct: number = 0.2,
): DishPerformance[] {
  const catMap = new Map(categoryStats.map((c) => [c.category, c]));
  return dishes.filter((d) => {
    const cat = catMap.get(d.category ?? "uncategorized");
    if (!cat || cat.avgOrders === 0) return false;
    return d.totalOrders > cat.avgOrders * (1 / topPct);
  });
}

export function identifyDormantDishes(
  dishes: DishPerformance[],
  dormantDays: number = 7,
): DishPerformance[] {
  return dishes.filter((d) => d.daysSinceLastOrder != null && d.daysSinceLastOrder >= dormantDays);
}
