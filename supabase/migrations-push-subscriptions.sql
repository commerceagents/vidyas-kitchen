-- Browser push notifications. Run in the Supabase SQL editor.
--
-- One row per device that has opted in. Filed by phone number because that is
-- what an order carries, and always in +91XXXXXXXXXX form — a subscription
-- stored under bare digits would simply never be found when we go to send.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_phone ON push_subscriptions(phone_number);

-- This table holds the keys needed to push a notification to someone's phone,
-- and the anon key is public — it ships in the browser bundle. Anything
-- readable by anon here is readable by anyone. Only the server touches it.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'push_subscriptions'
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON push_subscriptions', pol.policyname);
  END LOOP;

  CREATE POLICY "Service role manages push subscriptions" ON push_subscriptions
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
END $$;

-- Existing rows may predate the normalised format; bring them into line so
-- they keep working instead of silently going quiet.
UPDATE push_subscriptions
SET phone_number = '+91' || RIGHT(REGEXP_REPLACE(phone_number, '\D', '', 'g'), 10)
WHERE phone_number !~ '^\+91[0-9]{10}$'
  AND LENGTH(REGEXP_REPLACE(phone_number, '\D', '', 'g')) >= 10;

-- Confirm: one policy, service_role only.
SELECT policyname, roles FROM pg_policies WHERE tablename = 'push_subscriptions';
