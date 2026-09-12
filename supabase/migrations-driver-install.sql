-- Add has_installed_app boolean flag to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS has_installed_app BOOLEAN NOT NULL DEFAULT false;
