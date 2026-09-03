-- Run this in the Supabase SQL editor AFTER the matching deploy is live.
--
-- Two things happen here:
--   1. `drivers` and `cod_blocks` lose their "Allow all for anon" policies.
--   2. A tiny `auth_attempts` table + atomic increment function gives the
--      kitchen PIN login a rate limit that survives serverless cold starts.
--
-- WHY 1 MATTERS: the anon key ships inside the public JS bundle, so a policy
-- that allows everything to anon means anyone could read drivers.pin_hash
-- straight from the Supabase REST API and grind a 4–6 digit PIN offline. The
-- dashboard no longer touches either table from the browser — driver
-- management goes through server actions and COD blocks through
-- /api/orders/cod-block, both on the service role, which bypasses RLS.

-- ── 1. Lock the two internal tables ──────────────────────────────────────────

ALTER TABLE drivers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drivers;
DROP POLICY IF EXISTS "Allow all for anon" ON cod_blocks;

-- Deliberately no replacement policies: with RLS on and no policy, anon and
-- authenticated get nothing, and the service role still gets everything.

-- NOT TOUCHED HERE: whatsapp_sessions. It holds carts and delivery addresses
-- keyed by phone number and needed the same treatment, but only once
-- src/lib/whatsapp-session.ts stopped using the anon client. That is done —
-- see migrations-whatsapp-sessions-rls.sql.

-- ── 2. Rate limit for the kitchen PIN ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_attempts (
  scope             TEXT NOT NULL,
  identifier        TEXT NOT NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until      TIMESTAMPTZ,
  PRIMARY KEY (scope, identifier)
);

ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
-- Service role only, same as above.

-- The whole point of this function is that read-modify-write happens in one
-- statement. Two guesses arriving at two different serverless instances at the
-- same moment cannot both read "attempts = 3" and both write "4".
CREATE OR REPLACE FUNCTION register_auth_failure(
  p_scope          TEXT,
  p_identifier     TEXT,
  p_max_attempts   INTEGER,
  p_window_seconds INTEGER,
  p_lock_seconds   INTEGER
)
RETURNS TABLE (attempts INTEGER, locked_until TIMESTAMPTZ)
LANGUAGE sql
AS $$
  INSERT INTO auth_attempts AS a (scope, identifier, attempts, window_started_at)
  VALUES (p_scope, p_identifier, 1, now())
  ON CONFLICT (scope, identifier) DO UPDATE
  SET
    attempts = CASE
      WHEN a.window_started_at < now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE a.attempts + 1
    END,
    window_started_at = CASE
      WHEN a.window_started_at < now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE a.window_started_at
    END,
    locked_until = CASE
      WHEN (CASE
              WHEN a.window_started_at < now() - make_interval(secs => p_window_seconds) THEN 1
              ELSE a.attempts + 1
            END) >= p_max_attempts
        THEN now() + make_interval(secs => p_lock_seconds)
      ELSE a.locked_until
    END
  RETURNING a.attempts, a.locked_until;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC, which would let anyone
-- holding the anon key call this over RPC and lock the kitchen out of its own
-- dashboard.
REVOKE EXECUTE ON FUNCTION register_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION register_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION register_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION register_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect rowsecurity = true and zero rows from the policy query:
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN ('drivers','cod_blocks','auth_attempts');
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('drivers','cod_blocks','auth_attempts');
