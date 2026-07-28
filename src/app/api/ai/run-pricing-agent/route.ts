import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { PricingAgent } from "@/lib/ai/pricing-engine";
import { type AgentConfig, DEFAULT_CONFIG } from "@/lib/ai/pricing-rules";
import type { DashboardOrder } from "@/lib/dashboard/orders";
import type { FestivalRow, DishDiscountRow } from "@/lib/menu/discount-pricing";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function loadConfig(supabase: any): Promise<AgentConfig> {
  const { data } = await supabase.from("ai_pricing_config").select("key, value");
  if (!data || !Array.isArray(data)) return DEFAULT_CONFIG;

  const configMap = new Map(data.map((r: { key: string; value: any }) => [r.key, r.value]));
  return {
    agentEnabled: configMap.get("agent_enabled") ?? DEFAULT_CONFIG.agentEnabled,
    maxDiscountPct: Number(configMap.get("max_discount_pct")) || DEFAULT_CONFIG.maxDiscountPct,
    minMarginPct: Number(configMap.get("min_margin_pct")) || DEFAULT_CONFIG.minMarginPct,
    maxMenuDiscountRatio: Number(configMap.get("max_menu_discount_ratio")) || DEFAULT_CONFIG.maxMenuDiscountRatio,
    autoApplyThresholdPct: Number(configMap.get("auto_apply_threshold_pct")) || DEFAULT_CONFIG.autoApplyThresholdPct,
    lowPerformerDays: Number(configMap.get("low_performer_days")) || DEFAULT_CONFIG.lowPerformerDays,
    lowPerformerThreshold: Number(configMap.get("low_performer_threshold")) || DEFAULT_CONFIG.lowPerformerThreshold,
    festivalAdvanceDays: Number(configMap.get("festival_advance_days")) || DEFAULT_CONFIG.festivalAdvanceDays,
  };
}

async function loadOrders(supabase: any): Promise<DashboardOrder[]> {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, phone_number, customer_name, total_amount, created_at, delivery_slot, delivery_slot_kind, items")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });
  return (data ?? []) as DashboardOrder[];
}

async function loadFestivals(supabase: any): Promise<FestivalRow[]> {
  const { data } = await supabase.from("festivals").select("*");
  return (data ?? []) as FestivalRow[];
}

async function loadDiscountSettings(supabase: any): Promise<DishDiscountRow[]> {
  const { data } = await supabase.from("dish_discount_settings").select("*");
  return (data ?? []) as DishDiscountRow[];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const [config, orders, festivals, discountSettings] = await Promise.all([
      loadConfig(supabase),
      loadOrders(supabase),
      loadFestivals(supabase),
      loadDiscountSettings(supabase),
    ]);

    if (!config.agentEnabled) {
      return NextResponse.json({ message: "Agent is disabled", decisions: 0 });
    }

    const totalMenuItems = Object.values(MENU_BY_CATEGORY).flat().length;
    const agent = new PricingAgent(config);
    const result = agent.analyzeMenu(orders, festivals, discountSettings, totalMenuItems);

    for (const decision of result.decisions) {
      const status = decision.autoApply ? "auto_applied" : "pending";
      await supabase.from("ai_pricing_decisions").insert({
        dish_id: decision.dishId,
        decision_type: decision.decisionType,
        old_discount: decision.oldDiscount,
        new_discount: decision.newDiscount,
        reasoning: decision.reasoning,
        status,
        decided_at: result.timestamp,
        applied_at: decision.autoApply ? result.timestamp : null,
      });

      if (decision.autoApply) {
        if (decision.decisionType === "festival_activate") {
          const festivalId = decision.dishId.replace("festival:", "");
          await supabase.from("festivals").update({ active: true, updated_at: result.timestamp }).eq("id", festivalId);
        } else if (decision.decisionType === "festival_deactivate") {
          const festivalId = decision.dishId.replace("festival:", "");
          await supabase.from("festivals").update({ active: false, updated_at: result.timestamp }).eq("id", festivalId);
        } else if (decision.decisionType === "remove_discount") {
          await supabase.from("dish_discount_settings").upsert({
            dish_id: decision.dishId,
            show_discount: false,
            discount_type: null,
            discount_value: null,
            updated_at: result.timestamp,
          }, { onConflict: "dish_id" });
        } else {
          await supabase.from("dish_discount_settings").upsert({
            dish_id: decision.dishId,
            show_discount: true,
            discount_type: "percentage",
            discount_value: decision.newDiscount,
            updated_at: result.timestamp,
          }, { onConflict: "dish_id" });
        }
      }
    }

    await supabase.from("ai_pricing_config").upsert({
      key: "last_run_at",
      value: JSON.stringify(result.timestamp),
      updated_at: result.timestamp,
    }, { onConflict: "key" });

    return NextResponse.json({
      message: "Agent run complete",
      timestamp: result.timestamp,
      totalDecisions: result.decisions.length,
      autoApplied: result.autoApplied.length,
      pendingApproval: result.pendingApproval.length,
      rejected: result.rejected.length,
    });
  } catch (error) {
    console.error("[AI Pricing Agent] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent run failed" },
      { status: 500 },
    );
  }
}
