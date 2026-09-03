-- RLS Migration: Lock down the four core tables
--
-- BEFORE RUNNING: confirm SUPABASE_SERVICE_ROLE_KEY is set in Vercel
-- production env vars. If it is not set, enabling RLS will immediately break
-- checkout (the server routes fall back to the anon key, which RLS will block).
--
-- Also: deploy the refactored DashboardDataContext and PhoneLoginScreen code
-- BEFORE running this, or the dashboard will silently show zero orders.

ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items   ENABLE ROW LEVEL SECURITY;

-- menu_items: public read is safe (it is just the menu)
CREATE POLICY "menu_items_public_read"
  ON menu_items FOR SELECT USING (true);

-- orders, order_items, users: NO anon read or write.
-- All access goes through server API routes using the service role key.
-- The service role bypasses RLS automatically in Supabase.
-- Deliberately no anon policies for these three tables.

-- Verify after applying:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN ('orders','order_items','users','menu_items');
-- All four should show rowsecurity = true.
