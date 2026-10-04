import { festivalCalendarStatus, type FestivalCalendarStatus } from "@/lib/menu/discount-pricing";

export type PricingListTab = "upcoming" | "active" | "history";

export type TabDecision = {
  dish_id: string;
  status: string;
  decision_type: string;
};

export type TabFestival = {
  id: string;
  date_start: string;
  date_end: string;
};

export function isQualityDecision(reasoning: string | null | undefined): boolean {
  return String(reasoning || "").startsWith("[[quality]]");
}

export function visibleReasoning(reasoning: string | null | undefined): string {
  return String(reasoning || "").replace(/^\[\[quality\]\]\s*/, "");
}

export function festivalIdOf(dishId: string): string | null {
  return dishId.startsWith("festival:") ? dishId.slice("festival:".length) : null;
}

/**
 * Upcoming: the festival has not started.
 * Active: today is inside the festival dates (pending or already on the menu).
 * History: the end date has passed.
 * Dish cards with no festival window follow their status.
 */
export function listTabForDecision(
  decision: TabDecision,
  festival: TabFestival | null,
  now = new Date(),
): PricingListTab {
  if (decision.status === "rejected") return "history";
  const festivalId = festivalIdOf(decision.dish_id);
  if (festivalId && decision.decision_type.startsWith("festival")) {
    const calendar: FestivalCalendarStatus = festival
      ? festivalCalendarStatus(festival, now)
      : decision.status === "expired"
        ? "expired"
        : "active";
    if (calendar === "expired" || decision.status === "expired") return "history";
    if (calendar === "upcoming") return "upcoming";
    return "active";
  }
  if (decision.status === "pending") return "upcoming";
  if (decision.status === "expired") return "history";
  return "active";
}
