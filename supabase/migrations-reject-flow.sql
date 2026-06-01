-- Rejection / refund columns on orders table.
-- Run in Supabase SQL editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT;

COMMENT ON COLUMN orders.rejected_at IS 'Timestamp when kitchen rejected the order.';
COMMENT ON COLUMN orders.refund_amount IS 'Amount refunded (INR) via Razorpay.';
COMMENT ON COLUMN orders.refund_status IS 'initiated | refunded | refund_failed';
