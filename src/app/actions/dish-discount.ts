"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import type { DishDiscountRow } from "@/lib/menu/discount-pricing";

export async function upsertDishDiscountAction(row: DishDiscountRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();
    const payload = {
      dish_id: row.dish_id,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      seasonal_active: row.seasonal_active,
      show_discount: row.show_discount,
      seasonal_from: row.seasonal_from,
      seasonal_until: row.seasonal_until,
      manual_list_prices: row.manual_list_prices,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("dish_discount_settings").upsert(payload, { onConflict: "dish_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/dishes");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
