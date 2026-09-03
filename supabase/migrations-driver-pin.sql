-- Driver PIN login: store only a hash. The app never writes the raw PIN.
-- Run in the Supabase SQL editor before drivers can sign in.

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pin_hash TEXT;

COMMENT ON COLUMN drivers.pin_hash IS 'HMAC-SHA256 hex of the driver PIN. Never store the PIN itself.';
