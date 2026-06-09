-- Add pending_options column to whatsapp_sessions table for serverless-safe option storage

ALTER TABLE whatsapp_sessions
ADD COLUMN IF NOT EXISTS pending_options JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN whatsapp_sessions.pending_options IS 'Stores numbered reply options for the current session state';
