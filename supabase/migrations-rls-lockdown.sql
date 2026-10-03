-- Run this once in the Supabase SQL editor.
--
-- The anon key is inside the public website, so any table with row security
-- off (the "UNRESTRICTED" badge) can be read and written by anyone who has
-- that key. This turns row security on for the leftover tables, hides promo
-- codes and pricing-agent settings from the public key, and stops the public
-- key from calling the offer functions.

ALTER TABLE IF EXISTS inventory_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_complaints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'banners') THEN
    EXECUTE 'ALTER TABLE banners ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for anon" ON banners';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read banners" ON banners';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'offers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read offers" ON offers';
    EXECUTE $p$
      CREATE POLICY "Public can read live automatic offers"
        ON offers FOR SELECT
        TO anon, authenticated
        USING (kind = 'auto' AND active = true)
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_pricing_decisions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read AI pricing decisions" ON ai_pricing_decisions';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_pricing_config') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read AI pricing config" ON ai_pricing_config';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dish_discount_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read dish discount settings" ON dish_discount_settings';
  END IF;
END $$;

-- These functions run as the table owner. Postgres lets the public key call
-- them unless that right is taken away, which would let a stranger burn or
-- undo an offer.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
