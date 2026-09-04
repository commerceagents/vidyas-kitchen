-- Full WhatsApp conversation log. Run in the Supabase SQL editor.
--
-- One row per inbound or outbound message. `whatsapp_sessions` only holds the
-- live cart; this table is the archive a client can open later.
-- Safe to run twice.

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind TEXT NOT NULL,
  body TEXT,
  payload JSONB,
  provider TEXT,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created
  ON whatsapp_messages (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_messages_created
  ON whatsapp_messages (created_at DESC);

-- Meta retries a webhook when it does not see 200. The same inbound id must
-- not become two rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_wa_id
  ON whatsapp_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

COMMENT ON TABLE whatsapp_messages IS
  'Every WhatsApp line we sent or received, keyed by phone. Not wiped by session reset.';

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'whatsapp_messages'
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON whatsapp_messages', pol.policyname);
  END LOOP;

  CREATE POLICY "Service role manages whatsapp messages" ON whatsapp_messages
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
END $$;

-- Confirm: one policy, service_role only.
SELECT policyname, roles FROM pg_policies WHERE tablename = 'whatsapp_messages';
