-- Saved delivery addresses (Home / Work / one the customer names) follow the
-- account rather than the handset, so they survive a reinstall or a new phone.
-- Run in the Supabase SQL editor.
--
-- Stored as JSON rather than rows because it is always read and written as a
-- complete set of three slots, never queried across customers.

ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_places JSONB;

COMMENT ON COLUMN users.saved_places IS
  'Array of {id,label,address,lat,lng} for the fixed home/work/other slots.';

-- Confirm.
SELECT COUNT(*) AS saved_places_column
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'saved_places';
