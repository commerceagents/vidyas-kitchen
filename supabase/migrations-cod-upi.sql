-- How a pay-at-door order was settled: cash or UPI (same kitchen VPA / printed QR).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_settled_via TEXT;
