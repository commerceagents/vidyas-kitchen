import { festivalCalendarStatus, type FestivalCalendarStatus } from "@/lib/menu/discount-pricing";
import { festivalNameKey } from "@/lib/ai/offer-memory";

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

export type NamedFestival = TabFestival & {
  name: string;
  included_dish_ids?: string[];
};

/**
 * Two rows for the same festival and the same dates (Navaratri and Navaratri 2026)
 * count as one. Keep the row that actually has dishes ticked.
 */
export function preferredFestivalIds(festivals: NamedFestival[]): Set<string> {
  const groups = new Map<string, NamedFestival[]>();
  for (const festival of festivals) {
    const key = `${festivalNameKey(festival.name)}|${festival.date_start.slice(0, 10)}|${festival.date_end.slice(0, 10)}`;
    const list = groups.get(key) ?? [];
    list.push(festival);
    groups.set(key, list);
  }
  const keep = new Set<string>();
  for (const group of groups.values()) {
    const best = [...group].sort((a, b) => {
      const dishes = (b.included_dish_ids?.length ?? 0) - (a.included_dish_ids?.length ?? 0);
      if (dishes !== 0) return dishes;
      const yearA = /\d{4}/.test(a.name) ? 1 : 0;
      const yearB = /\d{4}/.test(b.name) ? 1 : 0;
      if (yearA !== yearB) return yearA - yearB;
      return a.name.length - b.name.length;
    })[0];
    if (best) keep.add(best.id);
  }
  return keep;
}

/**
 * Drop the extra history cards: rejected rows, and a second copy of the same
 * festival (Navaratri 2026 next to Navaratri). One Navaratri card stays.
 */
export function historyDecisionIdsToRemove(
  decisions: (TabDecision & { id?: string; decided_at?: string })[],
  festivals: NamedFestival[],
  now = new Date(),
): string[] {
  const byId = new Map(festivals.map((festival) => [festival.id, festival]));
  const preferred = preferredFestivalIds(festivals);
  const history = decisions.filter((decision) => {
    if (!decision.id) return false;
    const festivalId = festivalIdOf(decision.dish_id);
    const festival = festivalId ? byId.get(festivalId) ?? null : null;
    return listTabForDecision(decision, festival, now) === "history";
  });
  const keeper = [...history]
    .filter((decision) => {
      const festivalId = festivalIdOf(decision.dish_id);
      if (!festivalId || !preferred.has(festivalId)) return false;
      const festival = byId.get(festivalId);
      return festival != null && festivalNameKey(festival.name) === "navaratri" && decision.decision_type === "festival_activate";
    })
    .sort((a, b) => String(b.decided_at ?? "").localeCompare(String(a.decided_at ?? "")))[0];
  return history
    .filter((decision) => {
      if (decision.id === keeper?.id) return false;
      const festivalId = festivalIdOf(decision.dish_id);
      if (festivalId && !preferred.has(festivalId)) return true;
      return decision.status === "rejected" || decision.status === "expired";
    })
    .map((decision) => decision.id!);
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
