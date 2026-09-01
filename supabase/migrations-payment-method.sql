-- Run in Supabase SQL editor.
-- Tracks how the customer paid (upi / card / cod) so the kitchen dashboard and
-- driver app can tell a Cash-on-Delivery order apart from an already-settled
-- online payment (driver needs to know to collect cash at the door).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'upi';

