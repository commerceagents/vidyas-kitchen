"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import type { FestivalRow } from "@/lib/menu/discount-pricing";

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
          discount_override: row.discount_override,
          chip_label: row.chip_label.trim(),
          active: row.active,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/festivals");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
