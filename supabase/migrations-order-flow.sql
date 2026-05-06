-- Run in Supabase SQL Editor (order flow: slots + ratings + optional column docs).
-- Safe to re-run: IF NOT EXISTS

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_kind TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_stars SMALLINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_comment TEXT;

COMMENT ON COLUMN orders.delivery_slot IS 'Timestamptz: scheduled slot start (IST wall time stored as instant).';
COMMENT ON COLUMN orders.delivery_slot_kind IS 'breakfast | lunch | dinner';
