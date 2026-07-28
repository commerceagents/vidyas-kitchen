import { type DashboardOrder } from "@/lib/dashboard/orders";
import { type FestivalRow, type DishDiscountRow } from "@/lib/menu/discount-pricing";
import {
  computeDishPerformance,
  computeCategoryStats,
  computeMealPerformance,
  detectUpcomingFestivals,
} from "./dish-analytics";
import {
  type PricingDecision,
  type AgentConfig,
  DEFAULT_CONFIG,
  lowPerformerRule,
  highPerformerRule,
  mealTimeRule,
  festivalRule,
  validateDecision,
} from "./pricing-rules";

export type AgentRunResult = {
  decisions: PricingDecision[];
  autoApplied: PricingDecision[];
  pendingApproval: PricingDecision[];
  rejected: PricingDecision[];
  timestamp: string;
};

/**
 * Main AI Pricing Agent. Analyzes orders and produces pricing decisions.
 * Designed to run server-side (API route / cron).
 */
export class PricingAgent {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  analyzeMenu(
    orders: DashboardOrder[],
    festivals: FestivalRow[],
    currentDiscounts: DishDiscountRow[],
    totalMenuItems: number,
  ): AgentRunResult {
    if (!this.config.agentEnabled) {
      return { decisions: [], autoApplied: [], pendingApproval: [], rejected: [], timestamp: new Date().toISOString() };
    }

    const now = new Date();
    const decisions: PricingDecision[] = [];
    const rejected: PricingDecision[] = [];

    const discountMap = new Map(currentDiscounts.map((d) => [d.dish_id, d]));
    const currentDiscountedCount = currentDiscounts.filter((d) => d.show_discount).length;

    const dishPerformances = computeDishPerformance(orders, this.config.lowPerformerDays, now);
    const categoryStats = computeCategoryStats(dishPerformances);
    const mealStats = computeMealPerformance(orders, this.config.lowPerformerDays, now);
    const upcomingFestivals = detectUpcomingFestivals(festivals, this.config.festivalAdvanceDays, now);

    for (const dish of dishPerformances) {
      const currentRow = discountMap.get(dish.dishId);
      const currentPct = currentRow?.discount_type === "percentage" ? (currentRow.discount_value ?? null) : null;

      const lowDecision = lowPerformerRule(dish, categoryStats, this.config, currentPct);
      if (lowDecision) {
        const validation = validateDecision(lowDecision, this.config, currentDiscountedCount, totalMenuItems);
        if (validation.valid) {
          decisions.push(lowDecision);
        } else {
          rejected.push({ ...lowDecision, reasoning: `${lowDecision.reasoning} [REJECTED: ${validation.reason}]` });
        }
        continue;
      }

      const highDecision = highPerformerRule(dish, categoryStats, currentPct);
      if (highDecision) {
        decisions.push(highDecision);
        continue;
      }

      const mealDecision = mealTimeRule(dish, mealStats, this.config, currentPct);
      if (mealDecision) {
        const validation = validateDecision(mealDecision, this.config, currentDiscountedCount, totalMenuItems);
        if (validation.valid) {
          decisions.push(mealDecision);
        } else {
          rejected.push({ ...mealDecision, reasoning: `${mealDecision.reasoning} [REJECTED: ${validation.reason}]` });
        }
      }
    }

    for (const festival of upcomingFestivals) {
      const fDecision = festivalRule(festival);
      if (fDecision) decisions.push(fDecision);
    }

    const autoApplied = decisions.filter((d) => d.autoApply);
    const pendingApproval = decisions.filter((d) => !d.autoApply);

    return {
      decisions,
      autoApplied,
      pendingApproval,
      rejected,
      timestamp: now.toISOString(),
    };
  }
}
