import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const [configRes, decisionsRes] = await Promise.all([
      supabase.from("ai_pricing_config").select("key, value"),
      supabase
        .from("ai_pricing_decisions")
        .select("*")
        .order("decided_at", { ascending: false })
        .limit(50),
    ]);

    const configMap = new Map(
      (configRes.data ?? []).map((r: { key: string; value: any }) => [r.key, r.value]),
    );

    const decisions = decisionsRes.data ?? [];
    const pendingCount = decisions.filter((d: any) => d.status === "pending").length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const appliedCount = decisions.filter(
      (d: any) => (d.status === "applied" || d.status === "auto_applied") && d.decided_at >= thirtyDaysAgo,
    ).length;

    const lastRunRaw = configMap.get("last_run_at");
    const lastRunAt = lastRunRaw && lastRunRaw !== "null" ? String(lastRunRaw).replace(/"/g, "") : null;

    return NextResponse.json({
      enabled: configMap.get("agent_enabled") ?? true,
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
