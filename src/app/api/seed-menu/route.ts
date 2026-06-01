import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";

export async function GET() {
  const supabase = createServerSupabase();

  const rows: { id: string; name: string; price: number; category: string }[] = [];

  for (const [category, items] of Object.entries(MENU_BY_CATEGORY)) {
    for (const item of items) {
      for (const variant of item.variants) {
        rows.push({
          id: variant.id,
          name: `${item.name} (${variant.label})`,
          price: variant.price,
          category,
        });
      }
    }
  }

  const { error } = await supabase.from("menu_items").upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("[seed-menu]", error);
    return NextResponse.json({ error: error.message, hint: error.hint }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
