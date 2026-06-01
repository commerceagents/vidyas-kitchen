-- Tamil Nadu festival windows: upgrades strikethrough % + chip for dishes with show_discount (PWA + Supabase).
-- Run in Supabase SQL editor if not using migrations tool.
-- To re-seed: DELETE FROM festivals; then run the INSERT block again.

CREATE TABLE IF NOT EXISTS festivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date_start DATE NOT NULL,
    date_end DATE NOT NULL,
    discount_override NUMERIC NOT NULL CHECK (discount_override > 0 AND discount_override < 100),
    chip_label TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read festivals"
  ON festivals FOR SELECT
  USING (true);

COMMENT ON TABLE festivals IS 'Seasonal promo windows; PWA applies discount_override + chip_label only when dish.show_discount is true';

-- Seed (Gregorian dates; lunar rows ship inactive — set dates yearly in dashboard).
INSERT INTO festivals (name, date_start, date_end, discount_override, chip_label, active) VALUES
  ('Puthandu (Tamil New Year)', '2026-04-14', '2026-04-15', 30, 'PUTHANDU OFFER', TRUE),
  ('Ramzan / Eid', '2026-03-30', '2026-03-31', 35, 'EID SPECIAL', FALSE),
  ('Vinayagar Chaturthi', '2026-09-14', '2026-09-15', 25, 'FESTIVE OFFER', FALSE),
  ('Independence Day', '2026-08-15', '2026-08-15', 20, 'INDEPENDENCE OFFER', TRUE),
  ('Diwali', '2026-11-08', '2026-11-10', 30, 'DIWALI SPECIAL', TRUE),
  ('Christmas', '2026-12-25', '2026-12-26', 30, 'CHRISTMAS OFFER', TRUE),
  ('New Year', '2027-01-01', '2027-01-01', 35, 'NEW YEAR SPECIAL', TRUE),
  ('Pongal', '2027-01-14', '2027-01-17', 25, 'PONGAL OFFER', TRUE);
