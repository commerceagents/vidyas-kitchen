"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import {
  BASE_DELIVERY_INR,
  DEFAULT_DELIVERY_PROMO,
  parseDeliveryPromoRow,
  type DeliveryPromoSettings,
} from "@/lib/delivery-promo";

const MISSING_TABLE_HINT =
  "Delivery promo table not found. Run supabase/migrations-delivery-promo.sql in the Supabase SQL editor.";

function isMissingTable(message: string): boolean {
  return /relation .*delivery_promo_settings.* does not exist|could not find the table|schema cache/i.test(
    message,
  );
}

export async function loadDeliveryPromoAction(): Promise<{
  ok: boolean;
  settings: DeliveryPromoSettings;
  error?: string;
}> {
  const denied = await guardDashboardAction();
  if (denied) return { ok: false, settings: DEFAULT_DELIVERY_PROMO, error: denied.error };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("delivery_promo_settings")
      .select("active, discount_inr, min_order_inr")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        settings: DEFAULT_DELIVERY_PROMO,
        error: isMissingTable(error.message) ? MISSING_TABLE_HINT : error.message,
      };
    }
    return { ok: true, settings: parseDeliveryPromoRow(data as Record<string, unknown> | null) };
  } catch (e) {
    return {
      ok: false,
      settings: DEFAULT_DELIVERY_PROMO,
      error: e instanceof Error ? e.message : "Could not load delivery promo",
    };
  }
}

export type DeliveryPromoUpsertPayload = {
  active: boolean;
  discountInr: number;
  minOrderInr: number;
};

function validate(row: DeliveryPromoUpsertPayload): string | null {
  if (!(row.discountInr > 0)) return "Enter how much comes off delivery.";
  if (row.discountInr > BASE_DELIVERY_INR) {
    return `Delivery discount cannot be more than ₹${BASE_DELIVERY_INR}.`;
  }
  if (row.minOrderInr < 0) return "Minimum order cannot be negative.";
  return null;
}

export async function saveDeliveryPromoAction(
  row: DeliveryPromoUpsertPayload,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  const invalid = validate(row);
  if (invalid) return { ok: false, error: invalid };

  try {
    const supabase = createServerSupabase();
    const payload = {
      id: 1,
      active: row.active,
      discount_inr: Math.round(row.discountInr),
      min_order_inr: Math.max(0, Math.round(row.minOrderInr)),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("delivery_promo_settings").upsert(payload, { onConflict: "id" });
    if (error) {
      return {
        ok: false,
        error: isMissingTable(error.message) ? MISSING_TABLE_HINT : error.message,
      };
    }
    revalidatePath("/dashboard/offers");
    revalidatePath("/api/delivery-promo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
