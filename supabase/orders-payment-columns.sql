-- Optional: run in Supabase SQL editor if orders lacks Razorpay / app fields.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_link_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
