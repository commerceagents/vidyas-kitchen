-- Driver arrival: the driver is at the door but hasn't handed the food over yet.
--
-- Deliberately a timestamp rather than a new order status. Arrival is a moment
-- inside out_for_delivery, not a stage of its own: the order can still end as
-- delivered or undelivered, and adding a status would mean touching every
-- transition table, dashboard tab and status filter in the app.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_arrived_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.driver_arrived_at IS
  'When the driver marked themselves at the customer''s door. Cleared if the order leaves out_for_delivery.';
