-- Driver flow: drop-off coordinates + live driver position for proximity + map.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_last_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_last_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_location_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.delivery_lat IS 'Customer pin lat at checkout (WGS84).';
COMMENT ON COLUMN orders.delivery_lng IS 'Customer pin lng at checkout (WGS84).';
COMMENT ON COLUMN orders.driver_last_lat IS 'Last reported driver position (WGS84).';
COMMENT ON COLUMN orders.driver_last_lng IS 'Last reported driver position (WGS84).';
COMMENT ON COLUMN orders.driver_location_at IS 'When driver_last_* was last updated.';
