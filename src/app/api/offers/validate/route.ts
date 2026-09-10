import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { resolveOfferForCheckout } from "@/lib/offers-server";
import {
  normalizeCartLines,
  resolveVariantPrices,
  subtotalFor,
  type CartLineInput,
} from "@/lib/menu/variant-prices";

export const dynamic = "force-dynamic";

/**
 * Preview a promo code against a real cart. The subtotal is recomputed from the
 * menu here and again at checkout, so a tampered client total can only ever
 * change what this preview says, never what the customer is charged.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      phone?: string;
      lines?: CartLineInput[];
    };

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) {
      return NextResponse.json({ ok: false, error: "Your cart is empty." }, { status: 400 });
    }

    const normalized = normalizeCartLines(rawLines);
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const priceById = await resolveVariantPrices(
      supabase,
      normalized.lines.map((l) => l.menuItemId),
    );
    if (!priceById) {
      return NextResponse.json({ ok: false, error: "Could not load menu prices." }, { status: 500 });
    }

    const subtotal = subtotalFor(normalized.lines, priceById);
    const { applied, codeError } = await resolveOfferForCheckout({
      subtotal,
      code: body.code,
      phone: body.phone,
      supabase,
    });

    if (codeError) {
      return NextResponse.json({ ok: false, error: codeError, applied });
    }

    return NextResponse.json({ ok: true, applied });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not check that code." }, { status: 500 });
  }
}
