-- WhatsApp bot upgrade. Run this in the Supabase SQL editor.
--
-- Safe to run before or after the deploy, and safe to run twice — every
-- statement is IF NOT EXISTS or an idempotent UPDATE. Running it *before* the
-- deploy is better: the new code writes these columns, and until they exist
-- src/lib/whatsapp-session.ts has to drop them and retry on every write.
--
-- Sections:
--   1. whatsapp_sessions — language, rating comment state, order proposals
--   2. orders            — rating comment
--   3. app_installs      — the PWA "installed" beacon
--   4. menu_items        — retailer_id and image_url normalisation

-- ── 1. whatsapp_sessions ─────────────────────────────────────────────────────
--
-- `lang` was an in-memory Map, so every serverless cold start forgot it and
-- dropped a Tanglish regular back into English mid-order. NULL is meaningful:
-- it means this number has never been asked, which is what makes the language
-- picker appear exactly once.

ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS lang TEXT;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS rating_order_id UUID;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS proposal JSONB;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS recent_turns JSONB;

COMMENT ON COLUMN whatsapp_sessions.lang IS
  'Chosen reply language: en | tanglish. NULL = never asked, so show the picker.';
COMMENT ON COLUMN whatsapp_sessions.rating_order_id IS
  'Order whose stars just landed and which is awaiting a one-line comment.';
COMMENT ON COLUMN whatsapp_sessions.proposal IS
  'Priced, validated order from a conversational request, held until the customer taps Confirm. The AI never writes to orders.';
COMMENT ON COLUMN whatsapp_sessions.recent_turns IS
  'Last few chat turns. The AI used to be handed an empty history on every message, so it could not follow a two-message conversation.';

-- Anything already stored has to be one of the two registers.
ALTER TABLE whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_lang_check;
ALTER TABLE whatsapp_sessions
  ADD CONSTRAINT whatsapp_sessions_lang_check
  CHECK (lang IS NULL OR lang IN ('en', 'tanglish'));

-- ── 2. orders: rating comment ────────────────────────────────────────────────
--
-- Stars alone tell you a delivery went badly but never why. The bot now asks
-- for one line after the stars land.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_comment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.rating_comment IS 'One-line customer comment captured after the star rating.';
COMMENT ON COLUMN orders.rating_at IS 'When the star rating was given.';

-- Throttle for the out-for-delivery location pin. The driver app reports GPS
-- every few seconds; without this the customer would get a wall of pins.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_pin_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.driver_pin_sent_at IS
  'When the last driver location pin was sent to the customer over WhatsApp.';

-- ── 2b. users: marketing opt-out ─────────────────────────────────────────────
--
-- Required by Meta for MARKETING-category templates, and honoured by
-- campaignAudience() in src/lib/whatsapp-marketing.ts. Order updates are
-- transactional and are never affected by this flag.

ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.marketing_opt_out IS
  'TRUE once the customer replies STOP. Excludes them from marketing templates only.';

-- ── 3. app_installs ──────────────────────────────────────────────────────────
--
-- The PWA posts here on `appinstalled` so the bot stops offering "Install app"
-- to someone who already has it, and can use that button slot for Track order
-- or Order again instead.

CREATE TABLE IF NOT EXISTS app_installs (
  phone_number TEXT PRIMARY KEY,
  user_agent   TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_installs IS
  'One row per phone number known to have installed the PWA. Written by /api/push/app-installed.';

-- Same posture as whatsapp_sessions: service role only. The anon key ships in
-- the public JS bundle, and this table maps phone numbers to devices.
ALTER TABLE app_installs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON app_installs;

-- ── 4. menu_items: retailer_id and image_url ─────────────────────────────────
--
-- Both must be present and must match the Meta catalog content IDs, because
-- Meta rejects an entire product message if one retailer ID is unknown.
--
-- The older add-retailer-id.sql derived retailer_id from image_url with an
-- ILIKE match, which mislabelled FRESH CREAM MUTTON CURRY: 'MUTTON CURRY'
-- matches it too. This maps by exact name instead, so a collision is
-- impossible.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS retailer_id TEXT;

UPDATE menu_items AS m
SET retailer_id = v.retailer_id
FROM (VALUES
  ('BLACK PEPPER CHICKEN GRAVY',               'chk-pepper-gravy'),
  ('CHILLY CHICKEN GRAVY',                     'chk-chilly-gravy'),
  ('CHICKEN GRAVY (MOM''S RECIPE)',            'chk-mom-gravy'),
  ('CHICKEN GRAVY SISTER''S RECIPE',           'chk-sis-gravy'),
  ('IDLI SPECIAL CHICKEN GRAVY',               'chk-idli-gravy'),
  ('PEPPER CHICKEN (SISTER-IN-LAW''S RECIPE)', 'chk-pepper-sil'),
  ('CHICKEN WINGS',                            'chk-wings'),
  ('CHILLY CHICKEN (DRY)',                     'chk-chilly-dry'),
  ('FRESH CREAM MUTTON CURRY',                 'mut-cream-curry'),
  ('GRANDMA MUTTON KEEMA',                     'mut-grandma-keema'),
  ('MUTTON KEEMA GRAVY',                       'mut-keema-gravy'),
  ('MUTTON CURRY',                             'mut-curry'),
  ('MUTTON STEW',                              'mut-stew'),
  ('SPICY MUTTON GRAVY',                       'mut-spicy-gravy'),
  ('MUTTON CHUKKA',                            'mut-chukka'),
  ('EGG CHALNA',                               'egg-chalna'),
  ('EGG CURRY',                                'egg-curry')
) AS v(name, retailer_id)
WHERE UPPER(TRIM(m.name)) = v.name
  AND (m.retailer_id IS DISTINCT FROM v.retailer_id);

-- Every image file is named after its retailer_id, so once that is right the
-- image follows. This also splits the three mutton dishes that were sharing a
-- single photo.
UPDATE menu_items
SET image_url = '/menu-images/' || retailer_id || '.jpg'
WHERE retailer_id IS NOT NULL
  AND (image_url IS NULL OR image_url IS DISTINCT FROM '/menu-images/' || retailer_id || '.jpg');

-- MY FAV CHICKEN is in this table but is not on the app menu and is not in the
-- Meta catalog, so there is no authored 500gm price for it and nothing for a
-- catalog card to point at. Hidden rather than sold at a guessed price. Set
-- is_available back to TRUE once it has been added to the app menu data and
-- the catalog CSV.
UPDATE menu_items
SET is_available = FALSE
WHERE UPPER(TRIM(name)) = 'MY FAV CHICKEN'
  AND retailer_id IS NULL;

-- ── Verify ───────────────────────────────────────────────────────────────────
--
-- Expect 17 rows, every one with a retailer_id and a matching image_url:
--
-- SELECT name, retailer_id, image_url, is_available
--   FROM menu_items
--  WHERE retailer_id IS NOT NULL
--  ORDER BY category, name;
--
-- Expect zero rows — anything listed here is on sale with no catalog identity:
--
-- SELECT name FROM menu_items WHERE is_available AND retailer_id IS NULL;
--
-- Expect the three new columns:
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'whatsapp_sessions'
--    AND column_name IN ('lang', 'rating_order_id', 'proposal');
