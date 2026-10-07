-- Store-wide delivery discount (dashboard toggle). Separate from promo codes:
-- waives part or all of the delivery fee when the food subtotal clears min_order.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS delivery_promo_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    -- Rupees off the delivery line (e.g. 35 = free delivery when base fee is ₹35).
    discount_inr NUMERIC NOT NULL DEFAULT 35 CHECK (discount_inr > 0),
    -- Food subtotal must reach this before the delivery discount applies.
    min_order_inr NUMERIC NOT NULL DEFAULT 0 CHECK (min_order_inr >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO delivery_promo_settings (id, active, discount_inr, min_order_inr)
VALUES (1, FALSE, 35, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE delivery_promo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read delivery promo settings" ON delivery_promo_settings;
CREATE POLICY "Anyone can read delivery promo settings"
  ON delivery_promo_settings FOR SELECT
  USING (true);

COMMENT ON TABLE delivery_promo_settings IS 'Singleton row: auto delivery discount until toggled off in /dashboard/offers (desktop).';
