-- Start ALL stopped bots and make them super aggressive
-- =============================================

-- 1. Set all stopped bots to "running" status
UPDATE trading_bots
SET status = 'running'
WHERE status != 'running';

-- 2. Update ALL bots (now running) to have super aggressive strategy config
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
}'::jsonb;

-- 3. Update strategy JSON
-- Strategy column is TEXT, so cast to JSONB, merge, then cast back to TEXT
UPDATE trading_bots
SET strategy = (
  COALESCE(
    NULLIF(strategy, '')::jsonb,
    '{}'::jsonb
  ) || '{"type": "scalping", "immediate_trading": true, "super_aggressive": true}'::jsonb
)::text
WHERE strategy IS NULL 
   OR strategy = ''
   OR (strategy::jsonb->>'type' IS NULL OR strategy::jsonb->>'type' = 'unknown');

-- 4. Verify the update
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
ORDER BY status DESC, created_at DESC;

-- 5. Count bots by status
SELECT 
  status,
  COUNT(*) as count
FROM trading_bots
GROUP BY status
ORDER BY count DESC;

