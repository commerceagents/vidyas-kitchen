-- Run in Supabase SQL Editor (once). WhatsApp complaint flow + optional user flags.
-- Requires extension uuid-ossp (see schema.sql).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_pending_action TEXT;

CREATE TABLE IF NOT EXISTS customer_complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_phone ON customer_complaints(phone_number);
