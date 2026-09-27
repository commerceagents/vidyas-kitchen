-- Who the kitchen sent this order with. The customer tracking card reads these
-- so it can show the driver's name, and the number only after the call icon is tapped.
-- Run in the Supabase SQL editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_phone TEXT;

COMMENT ON COLUMN orders.driver_name IS 'Driver chosen in the dashboard when the order was dispatched.';
COMMENT ON COLUMN orders.driver_phone IS 'That driver''s phone, last 10 digits. Shown to the customer only after they tap call.';
