import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { FestivalRow } from "@/lib/menu/discount-pricing";

/** Public read: client picks active window via pickActiveFestival(). */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.from("festivals").select("*").order("date_start", { ascending: true });
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
    }));
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] as FestivalRow[] });
  }
}
