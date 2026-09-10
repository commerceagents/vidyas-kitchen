-- Real money-off offers: festival/seasonal auto offers and customer-typed promo codes.
-- Run in the Supabase SQL editor.
--
-- This is deliberately SEPARATE from the `festivals` table. `festivals` only
-- changes the struck-through "was" price shown on a card (marketing). Rows here
-- actually reduce what the customer is billed at checkout.

CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Shown to the customer, e.g. "Diwali Special" or "First order 10% off".
    name TEXT NOT NULL,
    -- auto = applies by itself inside the date window (festival / seasonal).
    -- code = only applies when the customer types `code`.
    kind TEXT NOT NULL CHECK (kind IN ('auto', 'code')),
    code TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('percent', 'flat')),
    value NUMERIC NOT NULL CHECK (value > 0),
    -- Order item subtotal must reach this before the offer applies. 0 = no minimum.
    min_order NUMERIC NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    -- Ceiling for percent offers, e.g. "20% off up to ₹150". NULL = uncapped.
    max_discount NUMERIC CHECK (max_discount IS NULL OR max_discount > 0),
    -- Inclusive calendar window. NULL = no bound on that side.
    starts_on DATE,
    ends_on DATE,
    -- Total redemptions allowed across all customers. NULL = unlimited.
    usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    used_count INTEGER NOT NULL DEFAULT 0,
    -- Redemptions allowed per phone number. NULL = unlimited.
    per_customer_limit INTEGER CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT offers_code_required CHECK (kind <> 'code' OR (code IS NOT NULL AND length(trim(code)) > 0)),
    CONSTRAINT offers_percent_range CHECK (value_type <> 'percent' OR value <= 90),
    CONSTRAINT offers_window_order CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on)
);

-- Codes are matched case-insensitively, so uniqueness must be too.
CREATE UNIQUE INDEX IF NOT EXISTS offers_code_unique
  ON offers (upper(code)) WHERE code IS NOT NULL;

COMMENT ON TABLE offers IS 'Money-off offers applied at checkout. kind=auto for festival/seasonal, kind=code for promo codes.';

-- One row per successful redemption. Powers usage_limit and per_customer_limit,
-- and gives the kitchen a record of what each offer actually cost.
CREATE TABLE IF NOT EXISTS offer_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    phone_number TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An order can only redeem once; makes the insert idempotent under webhook retries.
CREATE UNIQUE INDEX IF NOT EXISTS offer_redemptions_order_unique
  ON offer_redemptions (order_id);
CREATE INDEX IF NOT EXISTS offer_redemptions_phone_idx
  ON offer_redemptions (offer_id, phone_number);

-- What the customer actually saved, stored on the order so receipts and the
-- dashboard can show it without re-deriving the offer.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_label TEXT;

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_redemptions ENABLE ROW LEVEL SECURITY;

-- Customers need to see live auto offers to render the banner. Writes and
-- redemption reads go through the service role only.
DROP POLICY IF EXISTS "Anyone can read offers" ON offers;
CREATE POLICY "Anyone can read offers"
  ON offers FOR SELECT
  USING (true);

-- Atomically claim a redemption. Returns FALSE when the offer ran out between
-- validation and checkout, so two simultaneous orders cannot overshoot
-- usage_limit.
CREATE OR REPLACE FUNCTION redeem_offer(
    p_offer_id UUID,
    p_order_id UUID,
    p_phone TEXT,
    p_amount NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
    v_per_customer INTEGER;
    v_mine INTEGER;
BEGIN
    SELECT usage_limit, used_count, per_customer_limit
      INTO v_limit, v_used, v_per_customer
      FROM offers WHERE id = p_offer_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_limit IS NOT NULL AND v_used >= v_limit THEN
        RETURN FALSE;
    END IF;

    IF v_per_customer IS NOT NULL AND p_phone IS NOT NULL THEN
        SELECT COUNT(*) INTO v_mine
          FROM offer_redemptions
         WHERE offer_id = p_offer_id
           AND right(regexp_replace(phone_number, '\D', '', 'g'), 10)
             = right(regexp_replace(p_phone, '\D', '', 'g'), 10);
        IF v_mine >= v_per_customer THEN
            RETURN FALSE;
        END IF;
    END IF;

    INSERT INTO offer_redemptions (offer_id, order_id, phone_number, amount)
    VALUES (p_offer_id, p_order_id, p_phone, p_amount)
    ON CONFLICT (order_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    UPDATE offers SET used_count = used_count + 1, updated_at = NOW()
     WHERE id = p_offer_id;

    RETURN TRUE;
END;
$$;

-- Undo a claim when the order it belonged to is rolled back (e.g. the payment
-- provider was unreachable and we deleted the order row).
CREATE OR REPLACE FUNCTION release_offer(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offer_id UUID;
BEGIN
    DELETE FROM offer_redemptions WHERE order_id = p_order_id
    RETURNING offer_id INTO v_offer_id;

    IF v_offer_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE offers
       SET used_count = GREATEST(used_count - 1, 0), updated_at = NOW()
     WHERE id = v_offer_id;

    RETURN TRUE;
END;
$$;

-- Example rows (safe to delete). The kitchen creates real ones in /dashboard/offers.
-- INSERT INTO offers (name, kind, code, value_type, value, min_order, max_discount, starts_on, ends_on, active)
-- VALUES ('Diwali Special', 'auto', NULL, 'percent', 10, 500, 150, '2026-11-08', '2026-11-10', TRUE),
--        ('Welcome offer',  'code', 'WELCOME50', 'flat', 50, 400, NULL, NULL, NULL, TRUE);
