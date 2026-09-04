import { createServerSupabase } from "@/lib/supabase-server";
import { PricingAgent } from "@/lib/ai/pricing-engine";
import { type AgentConfig, DEFAULT_CONFIG, type PricingDecision } from "@/lib/ai/pricing-rules";
import type { DashboardOrder, DashboardOrderItem } from "@/lib/dashboard/orders";
import type { FestivalRow, DishDiscountRow } from "@/lib/menu/discount-pricing";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { variantIdToDishIdMap } from "@/lib/menu/best-selling";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";

export type PricingAgentRunSummary = {
  message: string;
  timestamp: string;
  totalDecisions: number;
  autoApplied: number;
  pendingApproval: number;
  rejected: number;
};

async function loadConfig(supabase: ReturnType<typeof createServerSupabase>): Promise<AgentConfig> {
  const { data } = await supabase.from("ai_pricing_config").select("key, value");
  if (!data || !Array.isArray(data)) return DEFAULT_CONFIG;

  const configMap = new Map(
    data.map((r: { key: string; value: unknown }) => [r.key, r.value]),
  );
  return {
    agentEnabled: (configMap.get("agent_enabled") as boolean | undefined) ?? DEFAULT_CONFIG.agentEnabled,
    maxDiscountPct: Number(configMap.get("max_discount_pct")) || DEFAULT_CONFIG.maxDiscountPct,
    minMarginPct: Number(configMap.get("min_margin_pct")) || DEFAULT_CONFIG.minMarginPct,
    maxMenuDiscountRatio:
      Number(configMap.get("max_menu_discount_ratio")) || DEFAULT_CONFIG.maxMenuDiscountRatio,
    autoApplyThresholdPct:
      Number(configMap.get("auto_apply_threshold_pct")) || DEFAULT_CONFIG.autoApplyThresholdPct,
    lowPerformerDays: Number(configMap.get("low_performer_days")) || DEFAULT_CONFIG.lowPerformerDays,
    lowPerformerThreshold:
      Number(configMap.get("low_performer_threshold")) || DEFAULT_CONFIG.lowPerformerThreshold,
    festivalAdvanceDays:
      Number(configMap.get("festival_advance_days")) || DEFAULT_CONFIG.festivalAdvanceDays,
  };
}

function mapOrderRow(row: Record<string, unknown>): DashboardOrder {
  const variantToDish = variantIdToDishIdMap();
  const dishById = new Map(
    Object.values(MENU_BY_CATEGORY)
      .flat()
      .map((d) => [d.id, d]),
  );

  const itemsRaw = (row.order_items as Record<string, unknown>[] | null) ?? [];
  const items: DashboardOrderItem[] = itemsRaw.map((it) => {
    const mi = it.menu_items as { name?: string; image_url?: string | null } | null;
    const menuItemId = (it.menu_item_id as string | null) ?? null;
    const parentId = menuItemId ? variantToDish.get(menuItemId) ?? null : null;
    const parent = parentId ? dishById.get(parentId) : null;
    return {
      quantity: Number(it.quantity) || 0,
      name: parent?.name || mi?.name || "Item",
      unit_price: Number(it.unit_price) || 0,
      image_url: mi?.image_url ?? null,
      menuItemId: parentId || menuItemId,
    };
  });

  return {
    id: String(row.id),
    order_number: row.order_number != null ? Number(row.order_number) : null,
    status: String(row.status ?? ""),
    phone_number: (row.phone_number as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    total_amount: row.total_amount != null ? Number(row.total_amount) : null,
    created_at: String(row.created_at ?? ""),
    delivery_slot: (row.delivery_slot as string | null) ?? null,
    delivery_slot_kind: (row.delivery_slot_kind as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    payment_status: (row.payment_status as string | null) ?? null,
    cod_failure_reason: (row.cod_failure_reason as string | null) ?? null,
    refund_status: null,
    refund_amount: null,
    driver_last_lat: null,
    driver_last_lng: null,
    driver_location_at: null,
    driver_arrived_at: null,
    items,
  };
}

async function loadOrders(supabase: ReturnType<typeof createServerSupabase>): Promise<DashboardOrder[]> {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, phone_number, total_amount, created_at,
      delivery_slot, delivery_slot_kind,
      order_items ( quantity, unit_price, menu_item_id, menu_items ( name, image_url ) )
    `,
    )
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[run-pricing-agent] orders", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapOrderRow);
}

async function loadFestivals(supabase: ReturnType<typeof createServerSupabase>): Promise<FestivalRow[]> {
  const { data } = await supabase.from("festivals").select("*");
  return (data ?? []) as FestivalRow[];
}

async function loadDiscountSettings(
  supabase: ReturnType<typeof createServerSupabase>,
): Promise<DishDiscountRow[]> {
  const { data } = await supabase.from("dish_discount_settings").select("*");
  return (data ?? []) as DishDiscountRow[];
}

async function applyDecision(
  supabase: ReturnType<typeof createServerSupabase>,
  decision: PricingDecision,
  now: string,
) {
  if (decision.decisionType === "festival_activate") {
    const festivalId = decision.dishId.replace("festival:", "");
    await supabase
      .from("festivals")
      .update({
        active: true,
        discount_override: roundToDiscountPreset(decision.newDiscount),
        updated_at: now,
      })
      .eq("id", festivalId);
  } else if (decision.decisionType === "festival_deactivate") {
    const festivalId = decision.dishId.replace("festival:", "");
    await supabase.from("festivals").update({ active: false, updated_at: now }).eq("id", festivalId);
  } else if (decision.decisionType === "remove_discount") {
    await supabase.from("dish_discount_settings").upsert(
      {
        dish_id: decision.dishId,
        show_discount: false,
        discount_type: null,
        discount_value: null,
        updated_at: now,
      },
      { onConflict: "dish_id" },
    );
  } else {
    const pct = roundToDiscountPreset(decision.newDiscount);
    await supabase.from("dish_discount_settings").upsert(
      {
        dish_id: decision.dishId,
        show_discount: true,
        discount_type: "percentage",
        discount_value: pct,
        updated_at: now,
      },
      { onConflict: "dish_id" },
    );
  }
}

/**
 * Run the pricing agent in-process (no HTTP self-fetch — avoids "fetch failed" on localhost).
 */
export async function runPricingAgentCore(): Promise<PricingAgentRunSummary> {
  const supabase = createServerSupabase();
  const [config, orders, festivals, discountSettings] = await Promise.all([
    loadConfig(supabase),
    loadOrders(supabase),
    loadFestivals(supabase),
    loadDiscountSettings(supabase),
  ]);

  if (!config.agentEnabled) {
    return {
      message: "Agent is disabled",
      timestamp: new Date().toISOString(),
      totalDecisions: 0,
      autoApplied: 0,
      pendingApproval: 0,
      rejected: 0,
    };
  }

  const totalMenuItems = Object.values(MENU_BY_CATEGORY).flat().length;
  const agent = new PricingAgent(config);
  const result = agent.analyzeMenu(orders, festivals, discountSettings, totalMenuItems);

  // Auto-expire stale pending festival_activate decisions whose festival has already ended
  const now = new Date();
  const festivalById = new Map(festivals.map((f) => [f.id, f]));
  const { data: stalePending } = await supabase
    .from("ai_pricing_decisions")
    .select("id, dish_id")
    .eq("status", "pending")
    .eq("decision_type", "festival_activate");

  for (const row of stalePending ?? []) {
    const festivalId = String(row.dish_id).replace("festival:", "");
    const festival = festivalById.get(festivalId);
    if (festival) {
      const end = new Date(`${festival.date_end}T23:59:59Z`);
      if (end < now) {
        await supabase
          .from("ai_pricing_decisions")
          .update({ status: "expired" })
          .eq("id", row.id);
      }
    }
  }

  // Load existing pending decisions so we can skip duplicates
  const { data: existingPending } = await supabase
    .from("ai_pricing_decisions")
    .select("dish_id, decision_type")
    .eq("status", "pending");

  const pendingSet = new Set(
    (existingPending ?? []).map((r: { dish_id: string; decision_type: string }) => `${r.dish_id}::${r.decision_type}`),
  );

  for (const decision of result.decisions) {
    const key = `${decision.dishId}::${decision.decisionType}`;

    // Skip if a pending decision for this dish+type already exists
    if (!decision.autoApply && pendingSet.has(key)) continue;

    const status = decision.autoApply ? "auto_applied" : "pending";
    const newDiscount =
      decision.decisionType === "festival_deactivate" || decision.decisionType === "remove_discount"
        ? decision.newDiscount
        : roundToDiscountPreset(decision.newDiscount);

    await supabase.from("ai_pricing_decisions").insert({
      dish_id: decision.dishId,
      decision_type: decision.decisionType,
      old_discount: decision.oldDiscount,
      new_discount: newDiscount,
      reasoning: decision.reasoning,
      status,
      decided_at: result.timestamp,
      applied_at: decision.autoApply ? result.timestamp : null,
    });

    if (decision.autoApply) {
      await applyDecision(supabase, { ...decision, newDiscount }, result.timestamp);
    }
  }

  await supabase.from("ai_pricing_config").upsert(
    {
      key: "last_run_at",
      value: JSON.stringify(result.timestamp),
      updated_at: result.timestamp,
    },
    { onConflict: "key" },
  );

  return {
    message: "Agent run complete",
    timestamp: result.timestamp,
    totalDecisions: result.decisions.length,
    autoApplied: result.autoApplied.length,
    pendingApproval: result.pendingApproval.length,
    rejected: result.rejected.length,
  };
}
