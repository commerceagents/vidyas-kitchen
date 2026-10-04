/**
 * Tunable thresholds for the pricing agent.
 *
 * Change the numbers here. The rules in `pricing-rules.ts` read this file
 * and do not keep their own copies. A row in `ai_pricing_config` still
 * overrides the matching key when the kitchen has set one.
 *
 * Nightly run: Vercel cron `30 20 * * *` (02:00 IST) hits
 * `/api/ai/run-pricing-agent`. Opening AI Pricing on a new kitchen day
 * runs the same job if that night was missed.
 */
export const PRICING_AGENT_THRESHOLDS = {
  /** Card appears once a festival is this many days away, and stays until it ends. */
  festivalLeadDays: 7,
  /** Suggested festival % when this festival has no measured outcome yet. */
  defaultFestivalPct: 20,

  /** Low-seller window. `orders_7d` is counted over these kitchen days. */
  lowSellerWindowDays: 7,
  /** `orders_7d` below this, with a decent rating, becomes a discount candidate. */
  lowSellerMaxOrders7d: 3,
  /** Rating at or above this can take a demand discount. Below 3.0 is a quality flag instead. */
  lowSellerMinRating: 3.5,

  /** Need at least this many orders in 30 days before a drop counts as a trend. */
  minOrdersForTrend: 3,
  /**
   * Declining trend: this week's orders are more than 30% under the
   * 30-day weekly average (`orders_30d / 30 * 7`).
   */
  declineDropRatio: 0.3,

  /** `rating` under this is a quality flag. The card cannot apply a discount. */
  qualityRatingBelow: 3.0,

  /**
   * Lift = orders during the offer / orders in the same-length window just before it.
   * Under 1.2 the offer barely moved sales, so the next suggestion steps up.
   * Over 2 the offer already worked, so the next suggestion keeps the same %.
   */
  weakLift: 1.2,
  strongLift: 2,
  /** Preset step added when lift is under `weakLift` (then snapped to 10/15/20/25/30). */
  liftStepPct: 5,
} as const;
