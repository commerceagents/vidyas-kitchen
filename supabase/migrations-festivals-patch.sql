-- Tamil Nadu full festival calendar patch — 2026 to 2028.
-- Safe to run multiple times. Uses name+year uniqueness via ON CONFLICT DO NOTHING.
-- Lunar festivals (marked *) need date updates each year; solar ones are fixed.
-- Run in Supabase SQL editor.

INSERT INTO festivals (name, date_start, date_end, discount_override, chip_label, active)
VALUES
  -- ── 2026 ────────────────────────────────────────────────────────────────────
  -- Already seeded in original migration (skipped automatically by ON CONFLICT):
  -- Puthandu Apr 14, Ramzan/Eid Mar 30, Vinayagar Chaturthi Sep 14, Independence Day Aug 15,
  -- Diwali Nov 8, Christmas Dec 25, New Year Jan 1 2027, Pongal Jan 14 2027.

  -- Newly added:
  ('Good Friday 2026',                '2026-04-03', '2026-04-03', 15, 'GOOD FRIDAY OFFER',    FALSE),
  ('Muharram 2026',                   '2026-07-06', '2026-07-06', 15, 'MUHARRAM OFFER',       FALSE),
  ('Republic Day 2026',               '2026-01-26', '2026-01-26', 10, 'REPUBLIC DAY OFFER',   FALSE),
  ('Milad un Nabi 2026',              '2026-09-05', '2026-09-05', 15, 'EID MILAD OFFER',      FALSE),
  ('Krishna Jayanti 2026',            '2026-09-04', '2026-09-04', 20, 'KRISHNA JAYANTI',      FALSE),
  ('Ayudha Puja 2026',                '2026-10-11', '2026-10-11', 15, 'FESTIVE OFFER',        FALSE),
  ('Navaratri 2026',                  '2026-10-02', '2026-10-11', 20, 'NAVARATRI OFFER',      FALSE),
  ('Vijaya Dasami 2026',              '2026-10-12', '2026-10-12', 20, 'FESTIVE OFFER',        FALSE),
  ('Karthigai Deepam 2026',           '2026-11-30', '2026-12-01', 20, 'KARTHIGAI OFFER',      FALSE),

  -- ── 2027 ────────────────────────────────────────────────────────────────────
  ('Republic Day 2027',               '2027-01-26', '2027-01-26', 10, 'REPUBLIC DAY OFFER',   FALSE),
  ('Good Friday 2027',                '2027-03-26', '2027-03-26', 15, 'GOOD FRIDAY OFFER',    FALSE),
  ('Ramzan / Eid 2027',               '2027-03-20', '2027-03-21', 35, 'EID SPECIAL',          FALSE),
  ('Puthandu 2027',                   '2027-04-14', '2027-04-15', 30, 'PUTHANDU OFFER',       FALSE),
  ('Muharram 2027',                   '2027-06-26', '2027-06-26', 15, 'MUHARRAM OFFER',       FALSE),
  ('Independence Day 2027',           '2027-08-15', '2027-08-15', 20, 'INDEPENDENCE OFFER',   FALSE),
  ('Milad un Nabi 2027',              '2027-08-25', '2027-08-25', 15, 'EID MILAD OFFER',      FALSE),
  ('Krishna Jayanti 2027',            '2027-08-24', '2027-08-24', 20, 'KRISHNA JAYANTI',      FALSE),
  ('Vinayagar Chaturthi 2027',        '2027-09-02', '2027-09-03', 25, 'FESTIVE OFFER',        FALSE),
  ('Navaratri 2027',                  '2027-10-21', '2027-10-30', 20, 'NAVARATRI OFFER',      FALSE),
  ('Vijaya Dasami 2027',              '2027-10-31', '2027-10-31', 20, 'FESTIVE OFFER',        FALSE),
  ('Ayudha Puja 2027',                '2027-10-30', '2027-10-30', 15, 'FESTIVE OFFER',        FALSE),
  ('Diwali 2027',                     '2027-10-28', '2027-10-30', 30, 'DIWALI SPECIAL',       FALSE),
  ('Karthigai Deepam 2027',           '2027-11-19', '2027-11-20', 20, 'KARTHIGAI OFFER',      FALSE),
  ('Christmas 2027',                  '2027-12-25', '2027-12-26', 30, 'CHRISTMAS OFFER',      FALSE),
  ('New Year 2028',                   '2028-01-01', '2028-01-01', 35, 'NEW YEAR SPECIAL',     FALSE),
  ('Pongal 2028',                     '2028-01-14', '2028-01-17', 25, 'PONGAL OFFER',         FALSE)

ON CONFLICT DO NOTHING;
