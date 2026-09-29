-- Festival and promo banners. Run in the Supabase SQL editor.
-- Approval is stored. Whether a banner is on the homepage is computed from
-- its dates at read time, so a past end date drops it without a manual switch.

CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT,
    message_text TEXT NOT NULL,
    discount_pct NUMERIC NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('ai_generated', 'manual')),
    approval TEXT NOT NULL DEFAULT 'pending_approval'
      CHECK (approval IN ('pending_approval', 'approved', 'rejected')),
    festival_id UUID,
    whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT banners_window CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS banners_festival_idx ON banners (festival_id);
CREATE INDEX IF NOT EXISTS banners_window_idx ON banners (start_date, end_date);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved banners" ON banners;
CREATE POLICY "Anyone can read approved banners"
  ON banners FOR SELECT
  USING (approval = 'approved');

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read banner images" ON storage.objects;
CREATE POLICY "Public read banner images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');
