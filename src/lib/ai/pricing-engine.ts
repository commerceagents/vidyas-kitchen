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
  decliningTrendRule,
  qualityReviewRule,
  highPerformerRule,
  mealTimeRule,
  festivalRule,
  validateDecision,
} from "./pricing-rules";
import { type OfferOutcome, latestDishOutcome, latestFestivalOutcome, suggestionFromOutcome } from "./offer-memory";
import { suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";

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
    outcomes: OfferOutcome[] = [],
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
    const monthOrders = new Map(
      computeDishPerformance(orders, 30, now).map((dish) => [dish.dishId, dish.totalOrders]),
    );
    const categoryStats = computeCategoryStats(dishPerformances);
    const mealStats = computeMealPerformance(orders, this.config.lowPerformerDays, now);
    const upcomingFestivals = detectUpcomingFestivals(festivals, this.config.festivalAdvanceDays, now);

    // Quietest dishes first, so the menu-wide discount cap keeps the ones that need an offer.
    const ranked = [...dishPerformances].sort((a, b) => {
      if (a.totalOrders !== b.totalOrders) return a.totalOrders - b.totalOrders;
      return (a.avgRating ?? 5) - (b.avgRating ?? 5);
    });

    let projectedDiscounted = currentDiscountedCount;

    for (const dish of ranked) {
      const currentRow = discountMap.get(dish.dishId);
      const currentPct = currentRow?.discount_type === "percentage" ? (currentRow.discount_value ?? null) : null;

      const orders30 = monthOrders.get(dish.dishId) ?? 0;
      const qualityDecision = qualityReviewRule(dish, this.config);
      if (qualityDecision) {
        qualityDecision.brief = { ...qualityDecision.brief!, orders30d: orders30 };
        decisions.push(qualityDecision);
        continue;
      }

      const lowDecision = this.withDishMemory(
        lowPerformerRule(dish, categoryStats, this.config, currentPct, orders30),
        outcomes,
      );
      if (lowDecision) {
        const validation = validateDecision(lowDecision, this.config, projectedDiscounted, totalMenuItems);
        if (validation.valid) {
          decisions.push(lowDecision);
          projectedDiscounted += 1;
        } else {
          rejected.push({ ...lowDecision, reasoning: `${lowDecision.reasoning} [REJECTED: ${validation.reason}]` });
        }
        continue;
      }

      const declineDecision = this.withDishMemory(
        decliningTrendRule(dish, this.config, currentPct, orders30),
        outcomes,
      );
      if (declineDecision) {
        const validation = validateDecision(declineDecision, this.config, projectedDiscounted, totalMenuItems);
        if (validation.valid) {
          decisions.push(declineDecision);
          projectedDiscounted += 1;
        } else {
          rejected.push({ ...declineDecision, reasoning: `${declineDecision.reasoning} [REJECTED: ${validation.reason}]` });
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
        const validation = validateDecision(mealDecision, this.config, projectedDiscounted, totalMenuItems);
        if (validation.valid) {
          decisions.push(mealDecision);
          projectedDiscounted += 1;
        } else {
          rejected.push({ ...mealDecision, reasoning: `${mealDecision.reasoning} [REJECTED: ${validation.reason}]` });
        }
      }
    }

    for (const festival of upcomingFestivals) {
      const past = latestFestivalOutcome(festival.name, outcomes);
      const learned = past
        ? suggestionFromOutcome(past, suggestFestivalDiscountPct(festival.discount_override, festival.name))
        : undefined;
      const fDecision = festivalRule(festival, learned);
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

  private withDishMemory(decision: PricingDecision | null, outcomes: OfferOutcome[]): PricingDecision | null {
    if (!decision) return null;
    const past = latestDishOutcome(decision.dishId, outcomes);
    if (!past) return decision;
    const learned = suggestionFromOutcome(past, decision.newDiscount);
    return {
      ...decision,
      newDiscount: learned.pct,
      memoryNote: learned.note ?? undefined,
    };
  }
}
