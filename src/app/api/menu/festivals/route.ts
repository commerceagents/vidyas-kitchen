import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { FestivalRow } from "@/lib/menu/discount-pricing";
import { loadFestivalDishMap, loadFestivalOverrideMap } from "@/lib/menu/festival-dishes";

/** Public read: client picks active window via pickActiveFestival(). */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const [{ data, error }, dishMap, overrides] = await Promise.all([
      supabase.from("festivals").select("*").order("date_start", { ascending: true }),
      loadFestivalDishMap(supabase),
      loadFestivalOverrideMap(supabase),
    ]);
    if (error || !data?.length) {
      return NextResponse.json({ rows: [] as FestivalRow[] });
    }
    const rows: FestivalRow[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      date_start: String(r.date_start ?? "").slice(0, 10),
      date_end: String(r.date_end ?? "").slice(0, 10),
      discount_override: Number(r.discount_override ?? 0),
      chip_label: String(r.chip_label ?? ""),
      active: Boolean(r.active),
      included_dish_ids: dishMap[String(r.id)] ?? [],
      dish_overrides: overrides[String(r.id)] ?? {},
      relevant_categories: r.relevant_categories ? String(r.relevant_categories) : "all",
    }));
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] as FestivalRow[] });
  }
}
