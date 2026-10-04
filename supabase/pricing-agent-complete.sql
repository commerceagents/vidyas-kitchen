-- Optional. The pricing agent already stores festival dishes, per-dish percents,
-- and offer outcomes in ai_pricing_config, so the dashboard works before this.
-- Run in the Supabase SQL editor when you want the festival category column
-- and a status value for cards whose dates have passed.

ALTER TABLE festivals ADD COLUMN IF NOT EXISTS relevant_categories TEXT NOT NULL DEFAULT 'all';

ALTER TABLE ai_pricing_decisions DROP CONSTRAINT IF EXISTS ai_pricing_decisions_status_check;
ALTER TABLE ai_pricing_decisions
  ADD CONSTRAINT ai_pricing_decisions_status_check
  CHECK (status IN ('pending', 'applied', 'rejected', 'auto_applied', 'expired'));
