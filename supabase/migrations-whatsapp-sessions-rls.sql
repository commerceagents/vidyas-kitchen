-- Run this in the Supabase SQL editor AFTER the matching deploy is live.
--
-- This finishes the job migrations-dashboard-session-rls.sql explicitly left
-- open: `whatsapp_sessions` loses its "Allow all for anon" policy.
--
-- WHY IT MATTERS: the anon key ships inside the public JS bundle, so a policy
-- that allows everything to anon meant anyone could read every WhatsApp
-- customer's delivery address and cart straight from the Supabase REST API,
-- and overwrite them — swapping the address on a stranger's in-progress order.
--
-- WHY IT IS SAFE NOW: src/lib/whatsapp-session.ts reads and writes this table
-- through createServerSupabase() (service role, bypasses RLS) instead of the
-- browser anon client. Nothing client-side imports it — the pure cart maths the
-- copy builders needed moved to src/lib/whatsapp-cart.ts, which touches no
-- database at all.

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON whatsapp_sessions;

-- Deliberately no replacement policy: with RLS on and no policy, anon and
-- authenticated get nothing, and the service role still gets everything.

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect rowsecurity = true and zero rows from the policy query:
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'whatsapp_sessions';
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'whatsapp_sessions';
--
-- Then send "hi" to the bot from a phone: a reply means the service-role path
-- is working. A silent bot means SUPABASE_SERVICE_ROLE_KEY is missing in
-- Vercel — createServerSupabase() falls back to the anon key, which this
-- migration has just locked out.
