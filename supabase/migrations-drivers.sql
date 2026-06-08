-- Drivers table for managing delivery drivers
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anon key full access (dashboard uses anon key)
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON drivers
  FOR ALL USING (true) WITH CHECK (true);
