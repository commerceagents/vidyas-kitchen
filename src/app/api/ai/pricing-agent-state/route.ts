import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { kitchenDateKey } from "@/lib/ai/dish-analytics";
import { endedFestivalDecisionIds } from "@/lib/ai/festival-decisions";
import { loadFestivalDishMap, loadFestivalOverrideMap } from "@/lib/menu/festival-dishes";
import { loadOfferOutcomes } from "@/lib/ai/offer-outcomes";
import { festivalNameKey } from "@/lib/ai/offer-memory";
import { historyDecisionIdsToRemove, preferredFestivalIds } from "@/lib/ai/pricing-tabs";
import { runPricingAgentCore } from "@/lib/ai/run-pricing-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Backs the /dashboard/pricing-agent screen: margin config plus the last 50
 * pricing decisions the agent made. That is the kitchen's costing strategy, so
 * it takes the same kitchen session as the server actions on the same page —
 * otherwise this route is a read-only way around them.
 */
function kitchenDayOf(raw: unknown): string | null {
  if (raw == null || raw === "null") return null;
  const parsed = new Date(String(raw).replace(/"/g, ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return kitchenDateKey(parsed);
}

function agentIsEnabled(raw: unknown): boolean {
  if (raw === false || raw === "false") return false;
  return true;
}

type FestivalBoardRow = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  active: boolean;
  discount_override: number;
  relevant_categories: string;
  included_dish_ids: string[];
};

/** Duplicate festivals and leftover history rows. Not needed to paint the board. */
async function tidyPricingBoard() {
  const supabase = createServerSupabase();
  const [festivalDishes, festivalRows, everyDecision] = await Promise.all([
    loadFestivalDishMap(supabase),
    supabase.from("festivals").select("id, name, date_start, date_end, active"),
    supabase.from("ai_pricing_decisions").select("id, dish_id, decision_type, status, decided_at"),
  ]);
  const festivals: FestivalBoardRow[] = (festivalRows.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    date_start: String(row.date_start ?? "").slice(0, 10),
    date_end: String(row.date_end ?? "").slice(0, 10),
    active: Boolean(row.active),
    discount_override: 0,
    relevant_categories: "all",
    included_dish_ids: festivalDishes[String(row.id)] ?? [],
  }));
  const preferred = preferredFestivalIds(festivals);
  const duplicateIds = festivals
    .filter((festival) => {
      if (preferred.has(festival.id) || !festival.active) return false;
      return festivals.some(
        (other) =>
          other.id !== festival.id &&
          preferred.has(other.id) &&
          festivalNameKey(other.name) === festivalNameKey(festival.name) &&
          other.date_start === festival.date_start &&
          other.date_end === festival.date_end,
      );
    })
    .map((festival) => festival.id);
  if (duplicateIds.length > 0) {
    await supabase.from("festivals").update({ active: false, updated_at: new Date().toISOString() }).in("id", duplicateIds);
    for (const festival of festivals) {
      if (duplicateIds.includes(festival.id)) festival.active = false;
    }
  }
  const removeIds = historyDecisionIdsToRemove(
    (everyDecision.data ?? []) as { id: string; dish_id: string; decision_type: string; status: string; decided_at?: string }[],
    festivals,
  );
  for (let i = 0; i < removeIds.length; i += 80) {
    await supabase.from("ai_pricing_decisions").delete().in("id", removeIds.slice(i, i + 80));
  }
}

export async function GET() {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createServerSupabase();
    const [configRes, decisionsRes, festivalDishes, dishOverrides, offerOutcomes, festivalRows] = await Promise.all([
      supabase.from("ai_pricing_config").select("key, value"),
      supabase.from("ai_pricing_decisions").select("*").order("decided_at", { ascending: false }).limit(50),
      loadFestivalDishMap(supabase),
      loadFestivalOverrideMap(supabase),
      loadOfferOutcomes(supabase),
      supabase.from("festivals").select("id, name, date_start, date_end, active, discount_override"),
    ]);

    const configMap = new Map(
      (configRes.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
    );
    const decisions = (decisionsRes.data ?? []) as {
      id?: string;
      status?: string;
      dish_id?: string;
      decision_type?: string;
      decided_at?: string;
    }[];
    const festivals = (festivalRows.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      date_start: String(row.date_start ?? "").slice(0, 10),
      date_end: String(row.date_end ?? "").slice(0, 10),
      active: Boolean(row.active),
      discount_override: Number(row.discount_override ?? 0),
      relevant_categories: row.relevant_categories ? String(row.relevant_categories) : "all",
      included_dish_ids: festivalDishes[String(row.id)] ?? [],
    }));

    const expiredIds = endedFestivalDecisionIds(decisions, festivals);
    if (expiredIds.length > 0) {
      for (const row of decisions) {
        if (row.id && expiredIds.includes(row.id)) row.status = "expired";
      }
    }

    const today = kitchenDateKey();
    const lastDay = kitchenDayOf(configMap.get("last_run_at"));
    const pendingIsStale = decisions.some(
      (row) => row.status === "pending" && kitchenDayOf(row.decided_at) !== today,
    );
    const refreshing = agentIsEnabled(configMap.get("agent_enabled")) && (lastDay !== today || pendingIsStale);

    // The morning run reads a year of orders and rewrites card copy. That stays
    // off this response so the board paints from the rows already saved.
    after(async () => {
      try {
        if (expiredIds.length > 0) {
          await supabase.from("ai_pricing_decisions").update({ status: "expired" }).in("id", expiredIds);
        }
        await tidyPricingBoard();
        if (refreshing) await runPricingAgentCore();
      } catch (err) {
        console.error("[pricing-agent-state] background refresh failed", err);
      }
    });

    const pendingCount = decisions.filter((d) => d.status === "pending").length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const appliedCount = decisions.filter(
      (d) => (d.status === "applied" || d.status === "auto_applied") && (d.decided_at ?? "") >= thirtyDaysAgo,
    ).length;
    const lastRunAt = kitchenDayOf(configMap.get("last_run_at"))
      ? String(configMap.get("last_run_at")).replace(/"/g, "")
      : null;

    return NextResponse.json({
      enabled: configMap.get("agent_enabled") ?? true,
      lastRunAt,
      decisions,
      pendingCount,
      appliedCount,
      festivalDishes,
      dishOverrides,
      offerOutcomes,
      festivals,
      refreshing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load state" },
      { status: 500 },
    );
  }
}
