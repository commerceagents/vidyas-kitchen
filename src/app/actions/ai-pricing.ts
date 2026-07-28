"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";

export async function approvePricingDecisionAction(decisionId: string): Promise<{ ok: boolean; error?: string }> {
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

    if (decision.decision_type === "festival_activate") {
      const festivalId = decision.dish_id.replace("festival:", "");
      await supabase.from("festivals").update({ active: true, updated_at: now }).eq("id", festivalId);
    } else if (decision.decision_type === "festival_deactivate") {
      const festivalId = decision.dish_id.replace("festival:", "");
      await supabase.from("festivals").update({ active: false, updated_at: now }).eq("id", festivalId);
    } else if (decision.decision_type === "remove_discount") {
      await supabase.from("dish_discount_settings").upsert({
        dish_id: decision.dish_id,
        show_discount: false,
        discount_type: null,
        discount_value: null,
        updated_at: now,
      }, { onConflict: "dish_id" });
    } else {
      await supabase.from("dish_discount_settings").upsert({
        dish_id: decision.dish_id,
        show_discount: true,
        discount_type: "percentage",
        discount_value: decision.new_discount,
        updated_at: now,
      }, { onConflict: "dish_id" });
    }

    await supabase
      .from("ai_pricing_decisions")
      .update({ status: "applied", applied_at: now })
      .eq("id", decisionId);

    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/dashboard/dishes");
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
    await supabase.from("ai_pricing_config").upsert({
      key: "agent_enabled",
      value: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    revalidatePath("/dashboard/pricing-agent");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Toggle failed" };
  }
}

export async function runAgentManuallyAction(): Promise<{ ok: boolean; error?: string; result?: any }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/ai/run-pricing-agent`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Run failed" };
    revalidatePath("/dashboard/pricing-agent");
    return { ok: true, result: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Manual run failed" };
  }
}
