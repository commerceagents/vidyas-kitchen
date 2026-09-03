-- Patch: add missing Tamil Nadu festivals that were not in the original seed.
-- Run in Supabase SQL editor (safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING).

INSERT INTO festivals (name, date_start, date_end, discount_override, chip_label, active)
VALUES
  ('Krishna Jayanti',           '2026-09-04', '2026-09-04', 20, 'KRISHNA JAYANTI',  FALSE),
  ('Navaratri',                 '2026-10-02', '2026-10-11', 20, 'NAVARATRI OFFER',  FALSE),
  ('Vijaya Dasami (Dussehra)',  '2026-10-12', '2026-10-12', 20, 'FESTIVE OFFER',    FALSE),
  ('Karthigai Deepam',          '2026-11-30', '2026-12-01', 20, 'KARTHIGAI OFFER',  FALSE)
ON CONFLICT DO NOTHING;
