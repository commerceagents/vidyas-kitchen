import {
  type DishPerformance,
  type CategoryStats,
  type MealPerformance,
  type UpcomingFestival,
} from "./dish-analytics";
import { roundToDiscountPreset, suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";

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
  /** Facts for the one-line card. Not stored. The percent stays newDiscount. */
  brief?: {
    orders7d: number;
    orders30d: number;
    rating: number | null;
    reviewCount: number;
  };
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
  lowPerformerDays: 7,
  lowPerformerThreshold: 0.3,
  festivalAdvanceDays: 7,
};

// ─── Individual Rules ────────────────────────────────────────────────────────

/**
 * Quiet-but-liked dishes only. The percent comes from this rule:
 * 20% when the last 7 days had zero orders, 15% when there were one or two.
 * A rating under 3.5 blocks the suggestion. No reviews yet does not.
 */
export function lowPerformerRule(
  dish: DishPerformance,
  _categoryStats: CategoryStats[],
  config: AgentConfig,
  currentDiscount: number | null,
  ordersLast30 = 0,
): PricingDecision | null {
  if (dish.totalOrders >= 3) return null;
  if (dish.ratingCount > 0 && (dish.avgRating == null || dish.avgRating < 3.5)) return null;

  const newDiscount = Math.min(dish.totalOrders === 0 ? 20 : 15, config.maxDiscountPct);
  if (currentDiscount != null && currentDiscount >= newDiscount) return null;

  const ratingBit =
    dish.ratingCount > 0 && dish.avgRating != null
      ? ` Rating ${dish.avgRating}/5 from ${dish.ratingCount} review${dish.ratingCount === 1 ? "" : "s"}.`
      : "";
  const reasoning =
    dish.totalOrders === 0
      ? `Nobody ordered this in the last ${config.lowPerformerDays} days.${ratingBit} ${ordersLast30} orders in the last 30 days. Suggest ${newDiscount}% off.`
      : `${dish.totalOrders} order${dish.totalOrders === 1 ? "" : "s"} in the last ${config.lowPerformerDays} days, ${ordersLast30} in the last 30.${ratingBit} Suggest ${newDiscount}% off.`;

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "increase_discount",
    oldDiscount: currentDiscount,
    newDiscount,
    reasoning,
    // Kitchen picks the final % — never auto-apply dish offers
    autoApply: false,
    brief: {
      orders7d: dish.totalOrders,
      orders30d: ordersLast30,
      rating: dish.avgRating,
      reviewCount: dish.ratingCount,
    },
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
  const loved =
    dish.ratingCount >= 3 && dish.avgRating != null && dish.avgRating >= 4.5;
  if (ratio < 2 && !loved) return null;

  const ratingBit =
    dish.avgRating != null
      ? ` Rated ${dish.avgRating}/5 from ${dish.ratingCount} reviews.`
      : "";

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "remove_discount",
    oldDiscount: currentDiscount,
    newDiscount: 0,
    reasoning: `Selling well (${dish.totalOrders} orders, ${ratio.toFixed(1)}x the category).${ratingBit} The discount is not needed.`,
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
  const newDiscount = Math.min(
    roundToDiscountPreset((currentDiscount ?? 0) + boost),
    config.maxDiscountPct,
  );
  if (newDiscount <= (currentDiscount ?? 0)) return null;

  return {
    dishId: dish.dishId,
    dishName: dish.dishName,
    decisionType: "meal_boost",
    oldDiscount: currentDiscount,
    newDiscount,
    reasoning: `${weakest.meal} underperforming (${(weakRatio * 100).toFixed(0)}% of revenue). Dish is ${(dishMealRatio * 100).toFixed(0)}% ${weakest.meal} orders — suggest ${newDiscount}% off.`,
    autoApply: false,
  };
}

function festivalDayLabel(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
}

export function festivalRule(festival: UpcomingFestival): PricingDecision | null {
  const suggested = suggestFestivalDiscountPct(festival.discount_override, festival.name);
  const from = festivalDayLabel(festival.date_start);
  const to = festivalDayLabel(festival.date_end);

  if (festival.shouldActivate) {
    const when =
      festival.daysUntilStart > 0
        ? `starts in ${festival.daysUntilStart} day${festival.daysUntilStart === 1 ? "" : "s"} (${from} – ${to})`
        : festival.daysUntilStart === 0
          ? `starts today and runs until ${to}`
          : `is on now, until ${to}`;
    return {
      dishId: `festival:${festival.id}`,
      dishName: festival.name,
      decisionType: "festival_activate",
      oldDiscount: null,
      newDiscount: suggested,
      reasoning: `Festival "${festival.name}" ${when}. Suggested offer ${suggested}%. This is the week-ahead look — approve it to go live.`,
      autoApply: false,
    };
  }

  if (festival.shouldDeactivate) {
    return {
      dishId: `festival:${festival.id}`,
      dishName: festival.name,
      decisionType: "festival_deactivate",
      oldDiscount: Number(festival.discount_override) || null,
      newDiscount: 0,
      reasoning: `Festival "${festival.name}" ended on ${to}. Turning the offer off.`,
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
      return {
        valid: false,
        reason: `Too many menu items on discount (${(discountRatio * 100).toFixed(0)}% > ${config.maxMenuDiscountRatio * 100}% limit)`,
      };
    }
  }

  return { valid: true };
}
