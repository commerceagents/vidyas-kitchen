import { festivalCalendarStatus } from "@/lib/menu/discount-pricing";

type FestivalEnd = { id: string; date_start: string; date_end: string };

type DecisionRow = {
  id?: string;
  status?: string;
  dish_id?: string;
  decision_type?: string;
};

/** A pending "turn this festival on" card whose dates have already ended. */
export function endedFestivalDecisionIds(
  decisions: DecisionRow[],
  festivals: FestivalEnd[],
  now = new Date(),
): string[] {
  const byId = new Map(festivals.map((row) => [row.id, row]));
  const ids: string[] = [];
  for (const decision of decisions) {
    if (decision.status !== "pending" || decision.decision_type !== "festival_activate") continue;
    const dishId = decision.dish_id || "";
    if (!dishId.startsWith("festival:")) continue;
    const festival = byId.get(dishId.slice("festival:".length));
    const expired = !festival || festivalCalendarStatus(festival, now) === "expired";
    if (expired && decision.id) ids.push(decision.id);
  }
  return ids;
}
