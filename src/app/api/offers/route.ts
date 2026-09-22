import { NextResponse, type NextRequest } from "next/server";
import { listPublicOffers } from "@/lib/offers-server";

export const dynamic = "force-dynamic";

/** Live promos for the cart's "View promos" list, priced against this subtotal. */
export async function GET(req: NextRequest) {
  try {
    const subtotal = Math.max(0, Math.round(Number(req.nextUrl.searchParams.get("subtotal")) || 0));
    const phone = req.nextUrl.searchParams.get("phone");
    const rows = await listPublicOffers({ subtotal, phone });
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
