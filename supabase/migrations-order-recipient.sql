-- Run in Supabase SQL editor.
-- Lets a customer order for someone else (e.g. ordering from Chennai, delivering
-- to a friend in Sivakasi). When set, the driver contacts the recipient instead
-- of the account holder at delivery time.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
