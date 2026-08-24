import { type DashboardOrder, type DashboardOrderItem } from "@/lib/dashboard/orders";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { getOrderRevenueAmount } from "@/lib/order-pricing";
import { type FestivalRow, isWithinSeasonalWindow } from "@/lib/menu/discount-pricing";
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

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
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

export function computeDishPerformance(
  orders: DashboardOrder[],
  days: number = 14,
  now = new Date(),
): DishPerformance[] {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const prevCutoff = new Date(cutoff.getTime() - days * 86_400_000);

  const currentOrders = orders.filter((o) => {
    const date = new Date(o.delivery_slot || o.created_at);
    return date >= cutoff && normalizeOrderStatus(o.status) === OrderStatus.DELIVERED;
  });

  const prevOrders = orders.filter((o) => {
    const date = new Date(o.delivery_slot || o.created_at);
    return date >= prevCutoff && date < cutoff && normalizeOrderStatus(o.status) === OrderStatus.DELIVERED;
  });

  const dishMap = new Map<
    string,
    {
      name: string;
      category: string | null;
      orders: number;
      revenue: number;
      lastOrderDate: Date | null;
      meals: { breakfast: number; lunch: number; dinner: number };
    }
  >();

  const prevDishMap = new Map<string, { orders: number; revenue: number }>();

  for (const order of currentOrders) {
    const meal = mealSlotOf(order);
    const orderDate = new Date(order.delivery_slot || order.created_at);
    for (const item of order.items) {
      const meta = resolveDishMeta(item);
      const key = meta.dishId;
      const entry = dishMap.get(key) ?? {
        name: meta.dishName,
        category: meta.category,
        orders: 0,
        revenue: 0,
        lastOrderDate: null,
        meals: { breakfast: 0, lunch: 0, dinner: 0 },
      };
      entry.orders += item.quantity;
      entry.revenue += (item.unit_price ?? 0) * item.quantity;
      entry.meals[meal] += item.quantity;
      if (!entry.lastOrderDate || orderDate > entry.lastOrderDate) {
        entry.lastOrderDate = orderDate;
      }
      dishMap.set(key, entry);
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
      daysSinceLastOrder: data.lastOrderDate ? daysBetween(data.lastOrderDate, now) : null,
      trendPct,
      mealBreakdown: data.meals,
    });
  }

  return results;
}

// ─── Category Stats ──────────────────────────────────────────────────────────

export function computeCategoryStats(dishPerformances: DishPerformance[]): CategoryStats[] {
  const catMap = new Map<string, { totalOrders: number; totalRevenue: number; count: number }>();

  for (const dp of dishPerformances) {
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
  days: number = 14,
  now = new Date(),
): MealPerformance[] {
  const cutoff = new Date(now.getTime() - days * 86_400_000);

  const meals: Record<"breakfast" | "lunch" | "dinner", { revenue: number; count: number }> = {
    breakfast: { revenue: 0, count: 0 },
    lunch: { revenue: 0, count: 0 },
    dinner: { revenue: 0, count: 0 },
  };

  for (const order of orders) {
    const date = new Date(order.delivery_slot || order.created_at);
    if (date < cutoff) continue;
    if (normalizeOrderStatus(order.status) !== OrderStatus.DELIVERED) continue;

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

    const daysUntilStart = daysBetween(now, start);
    const daysUntilEnd = daysBetween(now, end);

    const isLive = isWithinSeasonalWindow(f.date_start, f.date_end, now);
    const shouldActivate = !f.active && daysUntilStart <= advanceDays && daysUntilStart >= 0;
    const shouldDeactivate = f.active && daysUntilEnd < -3;

    results.push({
      ...f,
      daysUntilStart,
      daysUntilEnd,
      shouldActivate,
      shouldDeactivate,
    });
  }

  return results.filter((f) => f.shouldActivate || f.shouldDeactivate || (f.daysUntilStart <= advanceDays && f.daysUntilEnd >= -3));
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
