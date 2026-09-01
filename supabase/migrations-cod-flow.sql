-- Run in Supabase SQL editor.
--
-- Separates PAYMENT SETTLEMENT from the ORDER LIFECYCLE.
--
-- Before this migration a Cash-on-Delivery order was written straight to
-- status='paid' at checkout, so it was indistinguishable from a settled
-- Razorpay order: the kitchen counted the cash as revenue before the driver
-- had even left, and the customer got a "we received your payment" message.
--
-- `orders.status`         = where the food is (pending_payment → ... → delivered)
-- `orders.payment_status` = where the money is (pending | paid | failed)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Set when a driver confirms cash was handed over at the door.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ;

-- Why a COD collection failed: refused / unreachable / wrong_address / other.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_failure_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS undelivered_at TIMESTAMPTZ;

-- Backfill: every historical order that got past pending_payment was, under the
-- old model, genuinely settled (online) or wrongly auto-settled (COD). Treat
-- them all as paid so revenue reporting doesn't retroactively change.
UPDATE orders
SET payment_status = CASE
  WHEN status = 'pending_payment' THEN 'pending'
  ELSE 'paid'
END
WHERE payment_status IS NULL;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);

-- Phone numbers barred from Cash on Delivery after a failed collection.
-- Deleting the row (kitchen dashboard "Unblock") restores COD access.
CREATE TABLE IF NOT EXISTS cod_blocks (
  phone TEXT PRIMARY KEY,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL
);
