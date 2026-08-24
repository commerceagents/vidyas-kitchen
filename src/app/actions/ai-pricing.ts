"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { runPricingAgentCore } from "@/lib/ai/run-pricing-agent";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";

export async function approvePricingDecisionAction(
  decisionId: string,
  overridePct?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();
    const now = new Date().toISOString();

    const { data: decision } = await supabase
      .from("ai_pricing_decisions")
      .select("*")
      .eq("id", decisionId)
      .single();

    if (!decision) return { ok: false, error: "Decision not found" };
    if (decision.status !== "pending") return { ok: false, error: `Decision already ${decision.status}` };

    const appliedPct =
      overridePct != null && Number.isFinite(overridePct)
        ? roundToDiscountPreset(overridePct)
        : decision.new_discount != null
          ? roundToDiscountPreset(Number(decision.new_discount))
          : null;

    if (decision.decision_type === "festival_activate") {
      const festivalId = String(decision.dish_id).replace("festival:", "");
      await supabase
        .from("festivals")
        .update({
          active: true,
          ...(appliedPct != null ? { discount_override: appliedPct } : {}),
          updated_at: now,
        })
        .eq("id", festivalId);
    } else if (decision.decision_type === "festival_deactivate") {
      const festivalId = String(decision.dish_id).replace("festival:", "");
      await supabase.from("festivals").update({ active: false, updated_at: now }).eq("id", festivalId);
    } else if (decision.decision_type === "remove_discount") {
      await supabase.from("dish_discount_settings").upsert(
        {
          dish_id: decision.dish_id,
          show_discount: false,
          discount_type: null,
          discount_value: null,
          updated_at: now,
        },
        { onConflict: "dish_id" },
      );
    } else {
      if (appliedPct == null) return { ok: false, error: "Pick a discount % first" };
      await supabase.from("dish_discount_settings").upsert(
        {
          dish_id: decision.dish_id,
          show_discount: true,
          discount_type: "percentage",
          discount_value: appliedPct,
          updated_at: now,
        },
        { onConflict: "dish_id" },
      );
    }

    await supabase
      .from("ai_pricing_decisions")
      .update({
        status: "applied",
        applied_at: now,
        ...(appliedPct != null && decision.decision_type !== "festival_deactivate" && decision.decision_type !== "remove_discount"
          ? { new_discount: appliedPct }
          : {}),
      })
      .eq("id", decisionId);

    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/dashboard/dishes");
    revalidatePath("/dashboard/festivals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Approve failed" };
  }
}

export async function rejectPricingDecisionAction(decisionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("ai_pricing_decisions")
      .update({ status: "rejected" })
      .eq("id", decisionId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/pricing-agent");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reject failed" };
  }
}

export async function toggleAgentAction(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();
    await supabase.from("ai_pricing_config").upsert(
      {
        key: "agent_enabled",
        value: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    revalidatePath("/dashboard/pricing-agent");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Toggle failed" };
  }
}

export async function runAgentManuallyAction(): Promise<{
  ok: boolean;
  error?: string;
  result?: Awaited<ReturnType<typeof runPricingAgentCore>>;
}> {
  try {
    const result = await runPricingAgentCore();
    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/dashboard/festivals");
    revalidatePath("/dashboard/dishes");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Manual run failed" };
  }
}
