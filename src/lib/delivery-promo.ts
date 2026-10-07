import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

/** Keep in sync with ORDER_DELIVERY_INR in order-pricing.ts */
export const BASE_DELIVERY_INR = 35;

export type DeliveryPromoSettings = {
  active: boolean;
  discountInr: number;
  minOrderInr: number;
};

export const DEFAULT_DELIVERY_PROMO: DeliveryPromoSettings = {
  active: false,
  discountInr: BASE_DELIVERY_INR,
  minOrderInr: 0,
};

export function parseDeliveryPromoRow(row: Record<string, unknown> | null | undefined): DeliveryPromoSettings {
  if (!row) return DEFAULT_DELIVERY_PROMO;
  return {
    active: Boolean(row.active),
    discountInr: Math.max(1, Math.round(Number(row.discount_inr ?? BASE_DELIVERY_INR))),
    minOrderInr: Math.max(0, Math.round(Number(row.min_order_inr ?? 0))),
  };
}

/** Fails soft when the table is missing — checkout keeps the usual delivery fee. */
export async function loadDeliveryPromoSettings(
  supabase?: SupabaseClient,
): Promise<DeliveryPromoSettings> {
  try {
    const db = supabase ?? createServerSupabase();
    const { data, error } = await db
      .from("delivery_promo_settings")
      .select("active, discount_inr, min_order_inr")
      .eq("id", 1)
      .maybeSingle();
    if (error) return DEFAULT_DELIVERY_PROMO;
    return parseDeliveryPromoRow(data as Record<string, unknown> | null);
  } catch {
    return DEFAULT_DELIVERY_PROMO;
  }
}

export function deliveryPromoApplies(
  itemsSubtotal: number,
  promo: DeliveryPromoSettings | null | undefined,
  baseDeliveryInr: number,
): boolean {
  if (!promo?.active || itemsSubtotal < promo.minOrderInr) return false;
  return Math.round(promo.discountInr) > 0;
}

export function deliveryPromoSummary(promo: DeliveryPromoSettings): string {
  const off = Math.round(promo.discountInr);
  const min = Math.round(promo.minOrderInr);
  if (min > 0) {
    if (off >= BASE_DELIVERY_INR) return `Free delivery on orders over ₹${min}`;
    return `₹${off} off delivery on orders over ₹${min}`;
  }
  if (off >= BASE_DELIVERY_INR) return "Free delivery on every order";
  return `₹${off} off delivery on every order`;
}

/** Dashboard UI: free-over-minimum vs flat discount — never both inputs at once. */
export type DeliveryPromoMode = "free_over_min" | "flat_off";

export function deliveryPromoMode(settings: DeliveryPromoSettings): DeliveryPromoMode {
  return settings.minOrderInr > 0 ? "free_over_min" : "flat_off";
}

export function deliveryPromoFromMode(
  mode: DeliveryPromoMode,
  valueInr: number,
): Pick<DeliveryPromoSettings, "discountInr" | "minOrderInr"> {
  const n = Math.max(0, Math.round(valueInr));
  if (mode === "free_over_min") {
    return { discountInr: BASE_DELIVERY_INR, minOrderInr: n };
  }
  return {
    discountInr: Math.min(BASE_DELIVERY_INR, Math.max(1, n || BASE_DELIVERY_INR)),
    minOrderInr: 0,
  };
}
