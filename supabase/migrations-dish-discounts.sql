-- Per-dish promo settings (PWA merges with static `mobileMenuData.ts` on load).
-- Run in Supabase SQL editor if not using migrations tool.

CREATE TABLE IF NOT EXISTS dish_discount_settings (
    dish_id TEXT PRIMARY KEY,
    discount_type TEXT CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'manual')),
    discount_value NUMERIC,
    seasonal_active BOOLEAN NOT NULL DEFAULT FALSE,
    show_discount BOOLEAN NOT NULL DEFAULT FALSE,
    seasonal_from DATE,
    seasonal_until DATE,
    manual_list_prices JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dish_discount_settings ENABLE ROW LEVEL SECURITY;

-- Adjust policies for your auth model. Default: allow public read; writes via service role (dashboard server action).
CREATE POLICY "Anyone can read dish discount settings"
  ON dish_discount_settings FOR SELECT
  USING (true);

COMMENT ON TABLE dish_discount_settings IS 'Overrides mobile menu discount fields; dish_id matches MenuItem.id in mobileMenuData.ts';
