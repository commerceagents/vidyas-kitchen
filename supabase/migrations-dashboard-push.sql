-- Web push subscriptions for Dashboard admins.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS dashboard_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_push_created ON dashboard_push_subscriptions(created_at);

-- Secure table: only server-side service_role can read/write push keys
ALTER TABLE dashboard_push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'dashboard_push_subscriptions'
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON dashboard_push_subscriptions', pol.policyname);
  END LOOP;

  CREATE POLICY "Service role manages dashboard push subscriptions" ON dashboard_push_subscriptions
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
END $$;
