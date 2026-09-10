import { NextResponse } from "next/server";
import { loadOffers } from "@/lib/offers-server";
import { isOfferLive, offerTerms } from "@/lib/offers";

export const dynamic = "force-dynamic";

/**
 * Live auto offers only. Promo codes are intentionally not listed here — a code
 * the kitchen sent to ten regulars should not be readable by everyone.
 */
export async function GET() {
  try {
    const now = new Date();
    const rows = (await loadOffers())
      .filter((o) => o.kind === "auto" && isOfferLive(o, now))
      .map((o) => ({
        id: o.id,
        name: o.name,
        terms: offerTerms(o),
        value_type: o.value_type,
        value: o.value,
        min_order: o.min_order,
        max_discount: o.max_discount,
      }));
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
