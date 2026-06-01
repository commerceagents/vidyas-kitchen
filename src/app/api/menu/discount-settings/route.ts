import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { DishDiscountRow } from "@/lib/menu/discount-pricing";

/** Public read: merge on the client with static `MENU_BY_CATEGORY`. */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.from("dish_discount_settings").select("*");
    if (error || !data?.length) {
      return NextResponse.json({ rows: [] as DishDiscountRow[] });
    }
    const rows: DishDiscountRow[] = data.map((r: Record<string, unknown>) => ({
      dish_id: String(r.dish_id),
      discount_type: (r.discount_type as DishDiscountRow["discount_type"]) ?? null,
      discount_value: r.discount_value != null ? Number(r.discount_value) : null,
      seasonal_active: Boolean(r.seasonal_active),
      show_discount: Boolean(r.show_discount),
      seasonal_from: r.seasonal_from ? String(r.seasonal_from).slice(0, 10) : null,
      seasonal_until: r.seasonal_until ? String(r.seasonal_until).slice(0, 10) : null,
      manual_list_prices:
        r.manual_list_prices && typeof r.manual_list_prices === "object"
          ? (r.manual_list_prices as Record<string, number>)
          : null,
    }));
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
