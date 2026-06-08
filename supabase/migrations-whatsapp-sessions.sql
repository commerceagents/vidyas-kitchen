-- WhatsApp session state for conversational cart/browsing flow
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  cart JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_item_id UUID,
  selected_variant TEXT,
  selected_qty INTEGER DEFAULT 1,
  delivery_date DATE,
  delivery_slot_kind TEXT,
  delivery_address TEXT,
  last_active TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON whatsapp_sessions
  FOR ALL USING (true) WITH CHECK (true);
