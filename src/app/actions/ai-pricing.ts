"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import { runPricingAgentCore } from "@/lib/ai/run-pricing-agent";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";
import { saveFestivalDishes, saveFestivalOverrides } from "@/lib/menu/festival-dishes";
import { outcomesForApproval, loadOfferOutcomes, saveOfferOutcomes } from "@/lib/ai/offer-outcomes";
import { isQualityDecision } from "@/lib/ai/pricing-tabs";

export async function approvePricingDecisionAction(
  decisionId: string,
  overridePct?: number | null,
  dishIds?: string[],
  dishOverrides?: Record<string, number>,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

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
    if (isQualityDecision(decision.reasoning)) {
      return { ok: false, error: "This dish needs a review, not a discount. Dismiss the card after you check the reviews." };
    }

    const appliedPct =
      overridePct != null && Number.isFinite(overridePct)
        ? roundToDiscountPreset(overridePct)
        : decision.new_discount != null
          ? roundToDiscountPreset(Number(decision.new_discount))
          : null;

    if (decision.decision_type === "festival_activate") {
      const festivalId = String(decision.dish_id).replace("festival:", "");
      const chosen = Array.isArray(dishIds) ? dishIds : [];
      if (chosen.length === 0) {
        return { ok: false, error: "Tick at least one dish, then tap Approve." };
      }
      const saved = await saveFestivalDishes(supabase, festivalId, chosen);
      if (!saved.ok) return saved;
      const overrides = dishOverrides && typeof dishOverrides === "object" ? dishOverrides : {};
      const savedOverrides = await saveFestivalOverrides(supabase, festivalId, overrides);
      if (!savedOverrides.ok) return savedOverrides;
      const { data: festival } = await supabase
        .from("festivals")
        .select("name, date_start, date_end")
        .eq("id", festivalId)
        .maybeSingle();
      const { data: overlapping } = await supabase
        .from("ai_pricing_decisions")
        .select("id, reasoning, decision_type")
        .in("dish_id", chosen)
        .eq("status", "pending");
      const replaced = (overlapping ?? [])
        .filter(
          (row: { reasoning?: string; decision_type?: string }) =>
            !isQualityDecision(row.reasoning) &&
            (row.decision_type === "increase_discount" || row.decision_type === "meal_boost"),
        )
        .map((row: { id: string }) => row.id);
      if (replaced.length > 0) {
        await supabase.from("ai_pricing_decisions").update({ status: "rejected" }).in("id", replaced);
      }
      if (festival) {
        const existing = await loadOfferOutcomes(supabase);
        await saveOfferOutcomes(
          supabase,
          outcomesForApproval(existing, {
            festivalId,
            festivalName: String(festival.name ?? "Festival"),
            startDate: String(festival.date_start ?? "").slice(0, 10),
            endDate: String(festival.date_end ?? "").slice(0, 10),
            defaultPct: appliedPct ?? (Number(decision.new_discount) || 20),
            dishIds: chosen,
            overrides,
          }),
        );
      }
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
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Approve failed" };
  }
}

export async function updateAppliedDiscountAction(
  decisionId: string,
  pct: number,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();
    const now = new Date().toISOString();
    const appliedPct = roundToDiscountPreset(pct);

    const { data: decision } = await supabase
      .from("ai_pricing_decisions")
      .select("*")
      .eq("id", decisionId)
      .single();

    if (!decision) return { ok: false, error: "Decision not found" };
    if (decision.status !== "applied" && decision.status !== "auto_applied") {
      return { ok: false, error: "Only live offers can be updated" };
    }

    const type = String(decision.decision_type);
    if (type === "festival_activate") {
      const festivalId = String(decision.dish_id).replace("festival:", "");
      await supabase
        .from("festivals")
        .update({ discount_override: appliedPct, active: true, updated_at: now })
        .eq("id", festivalId);
    } else if (type === "increase_discount" || type === "meal_boost" || type === "decrease_discount") {
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
    } else {
      return { ok: false, error: "This offer cannot be edited" };
    }

    await supabase
      .from("ai_pricing_decisions")
      .update({ new_discount: appliedPct, applied_at: now })
      .eq("id", decisionId);

    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/dashboard/dishes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function rejectPricingDecisionAction(decisionId: string): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

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
  const denied = await guardDashboardAction();
  if (denied) return denied;

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
  const denied = await guardDashboardAction();
  if (denied) return denied;

  try {
    const result = await runPricingAgentCore();
    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/dashboard/dishes");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Manual run failed" };
  }
}
