"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";
import { saveFestivalDishes, saveFestivalOverrides } from "@/lib/menu/festival-dishes";
import { embedMissingMenuItems, refreshMenuItemEmbeddings } from "@/lib/menu/embeddings";

export type FestivalUpsertPayload = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  discount_override: number;
  chip_label: string;
  active: boolean;
};

export async function upsertFestivalAction(row: FestivalUpsertPayload): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("festivals")
      .upsert(
        {
          id: row.id,
          name: row.name.trim(),
          date_start: row.date_start.slice(0, 10),
          date_end: row.date_end.slice(0, 10),
          discount_override: roundToDiscountPreset(row.discount_override),
          chip_label: row.chip_label.trim(),
          active: row.active,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/festivals");
    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function setFestivalDishesAction(
  festivalId: string,
  dishIds: string[],
  dishOverrides?: Record<string, number>,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;
  const id = festivalId.trim();
  if (!id) return { ok: false, error: "Missing festival" };

  try {
    const supabase = createServerSupabase();
    const saved = await saveFestivalDishes(supabase, id, dishIds);
    if (!saved.ok) return saved;
    if (dishOverrides) {
      const savedOverrides = await saveFestivalOverrides(supabase, id, dishOverrides);
      if (!savedOverrides.ok) return savedOverrides;
    }
    revalidatePath("/dashboard/pricing-agent");
    revalidatePath("/");
    after(() => {
      void embedMissingMenuItems()
        .then(() => refreshMenuItemEmbeddings(dishIds))
        .catch((err) => {
          console.error("[menu embeddings] dish save refresh failed:", err);
        });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
