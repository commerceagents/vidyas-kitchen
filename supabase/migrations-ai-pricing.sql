-- AI Pricing Decisions: tracks every recommendation and action by the AI pricing agent.
-- Run in Supabase SQL editor if not using migrations tool.

CREATE TABLE IF NOT EXISTS ai_pricing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'increase_discount', 'decrease_discount', 'remove_discount',
        'festival_activate', 'festival_deactivate', 'meal_boost'
    )),
    old_discount NUMERIC,
    new_discount NUMERIC,
    reasoning TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'auto_applied')),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_pricing_decisions_status ON ai_pricing_decisions (status);
CREATE INDEX IF NOT EXISTS idx_ai_pricing_decisions_dish ON ai_pricing_decisions (dish_id);
CREATE INDEX IF NOT EXISTS idx_ai_pricing_decisions_decided ON ai_pricing_decisions (decided_at DESC);

ALTER TABLE ai_pricing_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AI pricing decisions"
  ON ai_pricing_decisions FOR SELECT
  USING (true);

COMMENT ON TABLE ai_pricing_decisions IS 'AI agent pricing recommendations; applied via cron or dashboard approval';

-- Agent config: global on/off switch and parameters
CREATE TABLE IF NOT EXISTS ai_pricing_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ai_pricing_config (key, value) VALUES
  ('agent_enabled', 'true'::jsonb),
  ('max_discount_pct', '50'::jsonb),
  ('min_margin_pct', '20'::jsonb),
  ('max_menu_discount_ratio', '0.6'::jsonb),
  ('auto_apply_threshold_pct', '25'::jsonb),
  ('low_performer_days', '14'::jsonb),
  ('low_performer_threshold', '0.3'::jsonb),
  ('festival_advance_days', '7'::jsonb),
  ('last_run_at', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE ai_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AI pricing config"
  ON ai_pricing_config FOR SELECT
  USING (true);

COMMENT ON TABLE ai_pricing_config IS 'Global config for AI pricing agent: limits, thresholds, and state';
