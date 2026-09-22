import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  bestAutoOffer,
  isOfferLive,
  normalizeOfferCode,
  offerDiscountFor,
  offerRejectionReason,
  offerTerms,
  parseOfferRow,
  pickBestOffer,
  type AppliedOffer,
  type OfferRow,
} from "@/lib/offers";

const OFFER_COLUMNS =
  "id, name, kind, code, value_type, value, min_order, max_discount, starts_on, ends_on, usage_limit, used_count, per_customer_limit, active";

/**
 * All offers, or `[]` if the table isn't there yet.
 *
 * Offers are additive to the product: an install that hasn't run
 * `supabase/migrations-offers.sql` must still take orders normally, so every
 * read here fails soft rather than breaking checkout.
 */
export async function loadOffers(supabase?: SupabaseClient): Promise<OfferRow[]> {
  try {
    const db = supabase ?? createServerSupabase();
    const { data, error } = await db.from("offers").select(OFFER_COLUMNS);
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => parseOfferRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

/**
 * Live offers as prompt text for the WhatsApp bot. A switched-on code is a
 * public festive code (the cart lists it under View promos), so the bot may
 * name it. Turn the offer off in the dashboard when it should disappear.
 */
export async function liveOffersPromptBlock(now = new Date()): Promise<string> {
  const offers = (await loadOffers()).filter((o) => isOfferLive(o, now));
  if (offers.length === 0) return "- No offers are running right now. Say so if asked.";

  return offers
    .map((o) =>
      o.kind === "auto"
        ? `- ${o.name}: ${offerTerms(o)}. Applies automatically, no code needed.`
        : `- ${o.name}: code ${o.code}. ${offerTerms(o)}. Also listed under View promos in the cart.`,
    )
    .join("\n");
}

export type PublicOffer = {
  id: string;
  name: string;
  kind: "auto" | "code";
  code: string | null;
  terms: string;
  minOrder: number;
  /** Rupees off this cart. Zero when the cart is not big enough yet. */
  amount: number;
  eligible: boolean;
  reason: string | null;
  endsOn: string | null;
};

/**
 * What the cart's "View promos" list is allowed to show: every live offer.
 * A code that is switched on is a public festive code. Turn it off in the
 * dashboard when it should stop appearing.
 */
export async function listPublicOffers(input: {
  subtotal: number;
  phone?: string | null;
  now?: Date;
}): Promise<PublicOffer[]> {
  const now = input.now ?? new Date();
  const db = createServerSupabase();
  const offers = (await loadOffers(db)).filter((o) => isOfferLive(o, now));
  const rows: PublicOffer[] = [];

  for (const offer of offers) {
    let reason = offerRejectionReason(offer, input.subtotal, now);
    if (!reason && offer.kind === "code" && offer.per_customer_limit != null && input.phone) {
      const used = await customerRedemptionCount(db, offer.id, input.phone);
      if (used >= offer.per_customer_limit) reason = "You've already used this code.";
    }
    const amount = reason ? 0 : offerDiscountFor(offer, input.subtotal);
    rows.push({
      id: offer.id,
      name: offer.name,
      kind: offer.kind,
      code: offer.kind === "code" ? offer.code : null,
      terms: offerTerms(offer),
      minOrder: Math.round(Number(offer.min_order) || 0),
      amount,
      eligible: !reason && amount > 0,
      reason,
      endsOn: offer.ends_on,
    });
  }

  rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.amount - a.amount);
  return rows;
}

export async function findOfferByCode(
  code: string,
  supabase?: SupabaseClient,
): Promise<OfferRow | null> {
  const normalized = normalizeOfferCode(code);
  if (!normalized) return null;
  const all = await loadOffers(supabase);
  return (
    all.find((o) => o.kind === "code" && normalizeOfferCode(o.code) === normalized) ?? null
  );
}

async function customerRedemptionCount(
  db: SupabaseClient,
  offerId: string,
  phone: string,
): Promise<number> {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  if (last10.length < 10) return 0;
  try {
    const { data } = await db
      .from("offer_redemptions")
      .select("phone_number")
      .eq("offer_id", offerId);
    if (!Array.isArray(data)) return 0;
    return data.filter(
      (r) => String((r as { phone_number?: string | null }).phone_number || "").replace(/\D/g, "").slice(-10) === last10,
    ).length;
  } catch {
    return 0;
  }
}

export type OfferResolution = {
  /** The single offer to apply, or null when nothing applies. */
  applied: AppliedOffer | null;
  /**
   * Set only when the customer typed a code we could not honour. Checkout
   * surfaces this instead of silently charging full price.
   */
  codeError: string | null;
};

/**
 * Decide the discount for a cart. Always call this server-side with a subtotal
 * recomputed from the menu — never trust a client-sent total or discount.
 */
export async function resolveOfferForCheckout(input: {
  subtotal: number;
  code?: string | null;
  phone?: string | null;
  supabase?: SupabaseClient;
  now?: Date;
}): Promise<OfferResolution> {
  const now = input.now ?? new Date();
  const db = input.supabase ?? createServerSupabase();
  const offers = await loadOffers(db);
  const auto = bestAutoOffer(offers, input.subtotal, now);

  const typed = normalizeOfferCode(input.code);
  if (!typed) return { applied: pickBestOffer(auto, null), codeError: null };

  const offer =
    offers.find((o) => o.kind === "code" && normalizeOfferCode(o.code) === typed) ?? null;

  const reason = offerRejectionReason(offer, input.subtotal, now);
  if (reason || !offer) {
    return { applied: pickBestOffer(auto, null), codeError: reason ?? "That code isn't valid." };
  }

  if (offer.per_customer_limit != null && input.phone) {
    const used = await customerRedemptionCount(db, offer.id, input.phone);
    if (used >= offer.per_customer_limit) {
      return {
        applied: pickBestOffer(auto, null),
        codeError: "You've already used this code.",
      };
    }
  }

  const amount = offerDiscountFor(offer, input.subtotal);
  return { applied: pickBestOffer(auto, { offer, amount }), codeError: null };
}

/**
 * Claim the redemption once the order row exists. Returns false when the offer
 * was exhausted in the gap between validation and insert; the caller decides
 * whether to keep the discount (we do — the customer was quoted that price).
 */
export async function redeemOffer(
  db: SupabaseClient,
  applied: AppliedOffer,
  orderId: string,
  phone: string | null,
): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("redeem_offer", {
      p_offer_id: applied.offerId,
      p_order_id: orderId,
      p_phone: phone,
      p_amount: applied.amount,
    });
    if (error) {
      console.error("[offers] redeem_offer", error.message);
      return false;
    }
    return data !== false;
  } catch (e) {
    console.error("[offers] redeem_offer threw", e);
    return false;
  }
}

/** Give a claim back when the order it belonged to was rolled back. */
export async function releaseOffer(db: SupabaseClient, orderId: string): Promise<void> {
  try {
    await db.rpc("release_offer", { p_order_id: orderId });
  } catch (e) {
    console.error("[offers] release_offer", e);
  }
}
