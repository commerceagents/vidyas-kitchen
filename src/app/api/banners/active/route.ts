import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isBannerOnHomepage, parseBannerRow, type BannerRow } from "@/lib/banners";

export const dynamic = "force-dynamic";

/** Homepage banners whose dates include today and which have been confirmed. */
export async function GET() {
  try {
    const { data, error } = await createServerSupabase()
      .from("banners")
      .select("id, title, image_url, message_text, discount_pct, start_date, end_date, approval, source, festival_id, whatsapp_sent, created_at")
      .eq("approval", "approved")
      .order("start_date", { ascending: true });
    if (error) {
      return NextResponse.json({ banners: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    const banners = (data ?? [])
      .map((row) => parseBannerRow(row as Record<string, unknown>))
      .filter((row): row is BannerRow => row != null && isBannerOnHomepage(row))
      .map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.image_url,
        message: row.message_text,
        discountPct: row.discount_pct,
      }));
    return NextResponse.json(
      { banners },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ banners: [] });
  }
}
