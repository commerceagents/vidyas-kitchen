import {
  type DishPerformance,
  type CategoryStats,
  type MealPerformance,
  type UpcomingFestival,
} from "./dish-analytics";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PricingDecision = {
  dishId: string;
  dishName: string;
  decisionType:
    | "increase_discount"
    | "decrease_discount"
    | "remove_discount"
    | "festival_activate"
    | "festival_deactivate"
    | "meal_boost";
  oldDiscount: number | null;
  newDiscount: number;
  reasoning: string;
  autoApply: boolean;
};

export type AgentConfig = {
  agentEnabled: boolean;
  maxDiscountPct: number;
  minMarginPct: number;
  maxMenuDiscountRatio: number;
  autoApplyThresholdPct: number;
  lowPerformerDays: number;
  lowPerformerThreshold: number;
  festivalAdvanceDays: number;
};

export const DEFAULT_CONFIG: AgentConfig = {
  agentEnabled: true,
  maxDiscountPct: 50,
  minMarginPct: 20,
  maxMenuDiscountRatio: 0.6,
  autoApplyThresholdPct: 25,
  lowPerformerDays: 14,
  lowPerformerThreshold: 0.3,
  festivalAdvanceDays: 7,
};

// ─── Individual Rules ────────────────────────────────────────────────────────

export function lowPerformerRule(
  dish: DishPerformance,
  categoryStats: CategoryStats[],
  config: AgentConfig,
  currentDiscount: number | null,
): PricingDecision | null {
  const cat = categoryStats.find((c) => c.category === (dish.category ?? "uncategorized"));
  if (!cat || cat.avgOrders === 0) return null;

  const ratio = dish.totalOrders / cat.avgOrders;
  if (ratio >= config.lowPerformerThreshold) return null;

  let newDiscount: number;
  let reasoning: string;

  if (dish.daysSinceLastOrder != null && dish.daysSinceLastOrder >= 7) {
    newDiscount = 30;
    reasoning = `No orders in ${dish.daysSinceLastOrder} days. Category avg: ${cat.avgOrders} orders/${config.lowPerformerDays}d.`;
  } else if (ratio < 0.15) {
    newDiscount = 25;
    reasoning = `Very low sales (${dish.totalOrders} orders vs category avg ${cat.avgOrders}). Ratio: ${(ratio * 100).toFixed(0)}%.`;
  } else {
    newDiscount = 15;
    reasoning = `Below threshold (${dish.totalOrders} orders vs category avg ${cat.avgOrders}). Ratio: ${(ratio * 100).toFixed(0)}%.`;
  }

  newDiscount = Math.min(newDiscount, config.maxDiscountPct);

  if (currentDiscount != null && currentDiscount >= newDiscount) return null;

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "increase_discount",
    oldDiscount: currentDiscount,
    newDiscount,
    reasoning,
    autoApply: newDiscount <= config.autoApplyThresholdPct,
  };
}

export function highPerformerRule(
  dish: DishPerformance,
  categoryStats: CategoryStats[],
  currentDiscount: number | null,
): PricingDecision | null {
  if (currentDiscount == null || currentDiscount <= 0) return null;

  const cat = categoryStats.find((c) => c.category === (dish.category ?? "uncategorized"));
  if (!cat || cat.avgOrders === 0) return null;

  const ratio = dish.totalOrders / cat.avgOrders;
  if (ratio < 5) return null;

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "remove_discount",
    oldDiscount: currentDiscount,
    newDiscount: 0,
    reasoning: `Top performer (${dish.totalOrders} orders, ${(ratio).toFixed(1)}x category avg). Discount not needed.`,
    autoApply: false,
  };
}

export function mealTimeRule(
  dish: DishPerformance,
  mealStats: MealPerformance[],
  config: AgentConfig,
  currentDiscount: number | null,
): PricingDecision | null {
  const totalRevenue = mealStats.reduce((s, m) => s + m.totalRevenue, 0);
  if (totalRevenue === 0) return null;

  const weakest = mealStats.reduce((a, b) => (a.totalRevenue < b.totalRevenue ? a : b));
  const weakRatio = weakest.totalRevenue / totalRevenue;

  if (weakRatio >= 0.2) return null;

  const dominantMeal = dish.mealBreakdown[weakest.meal];
  const totalDishOrders = dish.totalOrders;
  if (totalDishOrders === 0) return null;
  const dishMealRatio = dominantMeal / totalDishOrders;

  if (dishMealRatio < 0.4) return null;

  const boost = 10;
  const newDiscount = Math.min((currentDiscount ?? 0) + boost, config.maxDiscountPct);
  if (newDiscount <= (currentDiscount ?? 0)) return null;

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "meal_boost",
    oldDiscount: currentDiscount,
    newDiscount,
    reasoning: `${weakest.meal} underperforming (${(weakRatio * 100).toFixed(0)}% of revenue). Dish is ${(dishMealRatio * 100).toFixed(0)}% ${weakest.meal} orders — boosting.`,
    autoApply: newDiscount <= config.autoApplyThresholdPct,
  };
}

export function festivalRule(
  festival: UpcomingFestival,
): PricingDecision | null {
  if (festival.shouldActivate) {
    return {
      dishId: `festival:${festival.id}`,
      dishName: festival.name,
      decisionType: "festival_activate",
      oldDiscount: null,
      newDiscount: festival.discount_override,
      reasoning: `Festival "${festival.name}" starts in ${festival.daysUntilStart} day(s). Auto-activating with ${festival.discount_override}% override.`,
      autoApply: festival.daysUntilStart <= 2,
    };
  }

  if (festival.shouldDeactivate) {
    return {
      dishId: `festival:${festival.id}`,
      dishName: festival.name,
      decisionType: "festival_deactivate",
      oldDiscount: festival.discount_override,
      newDiscount: 0,
      reasoning: `Festival "${festival.name}" ended ${Math.abs(festival.daysUntilEnd)} day(s) ago. Deactivating.`,
      autoApply: true,
    };
  }

  return null;
}

// ─── Safety Validator ────────────────────────────────────────────────────────

export function validateDecision(
  decision: PricingDecision,
  config: AgentConfig,
  currentDiscountedCount: number,
  totalMenuItems: number,
): { valid: boolean; reason?: string } {
  if (decision.newDiscount > config.maxDiscountPct) {
    return { valid: false, reason: `Exceeds max discount (${config.maxDiscountPct}%)` };
  }

  if (decision.decisionType === "increase_discount" || decision.decisionType === "meal_boost") {
    const discountRatio = (currentDiscountedCount + 1) / totalMenuItems;
    if (discountRatio > config.maxMenuDiscountRatio) {
      return { valid: false, reason: `Too many menu items on discount (${(discountRatio * 100).toFixed(0)}% > ${config.maxMenuDiscountRatio * 100}% limit)` };
    }
  }

  return { valid: true };
}
