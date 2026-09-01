-- Rejection / refund columns on orders table.
-- Run in Supabase SQL editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT;
-- Razorpay's own refund id (rfnd_…), so a disputed or failed refund can be
-- traced in their dashboard without matching on amount and date.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_id TEXT;

COMMENT ON COLUMN orders.rejected_at IS 'Timestamp when kitchen rejected the order.';
COMMENT ON COLUMN orders.refund_amount IS 'Amount refunded (INR) via Razorpay.';
COMMENT ON COLUMN orders.refund_status IS 'initiated | refunded | refund_failed';
COMMENT ON COLUMN orders.refund_id IS 'Razorpay refund id when the refund succeeded.';
