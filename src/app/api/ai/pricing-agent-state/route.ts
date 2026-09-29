import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { kitchenDateKey } from "@/lib/ai/dish-analytics";
import { endedFestivalDecisionIds } from "@/lib/ai/festival-decisions";
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

export async function GET() {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createServerSupabase();

    const configRes = await supabase.from("ai_pricing_config").select("key, value");
    const configMap = new Map(
      (configRes.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
    );

    if (agentIsEnabled(configMap.get("agent_enabled"))) {
      const peek = await supabase
        .from("ai_pricing_decisions")
        .select("status, decided_at")
        .eq("status", "pending");
      const today = kitchenDateKey();
      const lastDay = kitchenDayOf(configMap.get("last_run_at"));
      const pendingIsStale = (peek.data ?? []).some(
        (row: { decided_at?: string }) => kitchenDayOf(row.decided_at) !== today,
      );
      // Opening AI Pricing on a new kitchen morning refreshes yesterday's cards.
      // A run that only bumped last_run_at and left the old Navaratri row is stale too.
      if (lastDay !== today || pendingIsStale) {
        try {
          await runPricingAgentCore();
        } catch (err) {
          console.error("[pricing-agent-state] refresh failed", err);
        }
      }
    }

    const [freshConfig, decisionsRes] = await Promise.all([
      supabase.from("ai_pricing_config").select("key, value"),
      supabase
        .from("ai_pricing_decisions")
        .select("*")
        .order("decided_at", { ascending: false })
        .limit(50),
    ]);

    const freshMap = new Map(
      (freshConfig.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
    );

    const decisions = decisionsRes.data ?? [];
    const festivalsRes = await supabase.from("festivals").select("id, date_start, date_end");
    const expiredIds = endedFestivalDecisionIds(
      decisions as { id?: string; status?: string; dish_id?: string; decision_type?: string }[],
      (festivalsRes.data ?? []) as { id: string; date_start: string; date_end: string }[],
    );
    if (expiredIds.length > 0) {
      await supabase.from("ai_pricing_decisions").update({ status: "expired" }).in("id", expiredIds);
      for (const row of decisions as { id?: string; status?: string }[]) {
        if (row.id && expiredIds.includes(row.id)) row.status = "expired";
      }
    }
    const pendingCount = decisions.filter((d: { status?: string }) => d.status === "pending").length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const appliedCount = decisions.filter(
      (d: { status?: string; decided_at?: string }) =>
        (d.status === "applied" || d.status === "auto_applied") &&
        (d.decided_at ?? "") >= thirtyDaysAgo,
    ).length;

    const lastRunAt = kitchenDayOf(freshMap.get("last_run_at"))
      ? String(freshMap.get("last_run_at")).replace(/"/g, "")
      : null;

    return NextResponse.json({
      enabled: freshMap.get("agent_enabled") ?? true,
      lastRunAt,
      decisions,
      pendingCount,
      appliedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load state" },
      { status: 500 },
    );
  }
}
