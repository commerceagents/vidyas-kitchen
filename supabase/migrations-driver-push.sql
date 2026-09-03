-- Web push for drivers. Run in the Supabase SQL editor.
--
-- Kept apart from `push_subscriptions` (customers) because the two are keyed by
-- different things: a customer is found by the phone number on the order, a
-- driver by their row in `drivers`. One device can legitimately appear in both
-- tables — a driver who also orders dinner — and the same endpoint arriving
-- twice must not overwrite the other side's row.

CREATE TABLE IF NOT EXISTS driver_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_push_driver ON driver_push_subscriptions(driver_id);

-- These rows hold the keys needed to push to a driver's phone, and the anon key
-- ships in the browser bundle. Server only.
ALTER TABLE driver_push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'driver_push_subscriptions'
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON driver_push_subscriptions', pol.policyname);
  END LOOP;

  CREATE POLICY "Service role manages driver push subscriptions" ON driver_push_subscriptions
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
END $$;

-- Confirm: one policy, service_role only.
SELECT policyname, roles FROM pg_policies WHERE tablename = 'driver_push_subscriptions';
