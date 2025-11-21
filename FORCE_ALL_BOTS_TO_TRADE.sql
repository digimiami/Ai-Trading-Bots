-- Force ALL running bots to trade by making strategy evaluation super lenient
-- This will make bots trade on almost any market condition
-- =============================================

-- Update ALL running bots to have super aggressive/lenient strategy config
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || '{
  "bias_mode": "both",
  "adx_min": 0,
  "adx_min_htf": 15,
  "adx_trend_min": 0,
  "min_volume_requirement": 0,
  "volume_multiplier": 0,
  "min_volatility_atr": 0,
  "time_filter_enabled": false,
  "cooldown_bars": 0,
  "immediate_execution": true,
  "super_aggressive": true,
  "disable_htf_adx_check": true,
  "rsi_oversold": 0,
  "rsi_overbought": 100,
  "momentum_threshold": 0,
  "vwap_distance": 0,
  "require_price_vs_trend": false,
  "adx_min_continuation": 0,
  "adx_min_reversal": 0,
  "volume_multiplier_continuation": 0,
  "volume_multiplier_reversal": 0,
  "scalping_mode": true,
  "fast_entry": true
}'::jsonb
WHERE status = 'running';

-- Also ensure strategy type is set correctly for scalping bots
-- Strategy column is TEXT, so cast to JSONB, merge, then cast back to TEXT
UPDATE trading_bots
SET strategy = (
  COALESCE(
    NULLIF(strategy, '')::jsonb,
    '{}'::jsonb
  ) || '{"type": "scalping", "immediate_trading": true, "super_aggressive": true}'::jsonb
)::text
WHERE status = 'running'
  AND (strategy IS NULL OR strategy = '' OR (strategy::jsonb->>'type' IS NULL OR strategy::jsonb->>'type' = 'unknown'));

-- Verify the update
SELECT 
  id,
  name,
  status,
  paper_trading,
  strategy::jsonb->>'type' as strategy_type,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'immediate_execution' as immediate_execution,
  strategy_config->>'super_aggressive' as super_aggressive
FROM trading_bots
WHERE status = 'running'
ORDER BY created_at DESC;

