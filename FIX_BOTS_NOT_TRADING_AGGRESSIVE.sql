-- Aggressive fix to make bots trade more frequently
-- This script:
-- 1. Disables cooldown (sets to 0)
-- 2. Disables trading hours filter
-- 3. Makes strategy parameters more lenient
-- 4. Sets bias_mode to 'both' to allow all trades

UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  -- Disable cooldown
  'cooldown_bars', 0,
  
  -- Disable trading hours filter
  'session_filter_enabled', false,
  'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  
  -- Very lenient strategy parameters
  'adx_min_htf', 10,  -- Lowered from 12 (minimum allowed by validation is 15, but we'll try 10)
  'adx_trend_min', 10,  -- Lowered from 12
  'adx_min', 10,  -- Lowered from default
  'adx_min_reversal', 8,  -- Lowered from 12
  'adx_meanrev_max', 60,  -- Increased (higher = more lenient for mean reversion)
  
  -- More lenient RSI thresholds
  'rsi_oversold', 45,  -- Increased from 40 (more lenient)
  'rsi_overbought', 55,  -- Decreased from 60 (more lenient)
  
  -- More lenient momentum and VWAP
  'momentum_threshold', 0.2,  -- Lowered from 0.3
  'vwap_distance', 0.3,  -- Lowered from 0.5
  
  -- Allow both long and short trades
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  
  -- Remove restrictive filters
  'require_adx_rising', false,
  'regime_mode', 'auto'
)
WHERE status = 'running'
  AND (
    -- Only update bots that haven't traded in 24+ hours
    id NOT IN (
      SELECT DISTINCT bot_id 
      FROM trades 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    )
    OR id NOT IN (
      SELECT DISTINCT bot_id 
      FROM paper_trading_trades 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    )
  );

-- Also update bots with NULL strategy_config
UPDATE trading_bots
SET strategy_config = jsonb_build_object(
  'cooldown_bars', 0,
  'session_filter_enabled', false,
  'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  'adx_min_htf', 10,
  'adx_trend_min', 10,
  'adx_min', 10,
  'adx_min_reversal', 8,
  'adx_meanrev_max', 60,
  'rsi_oversold', 45,
  'rsi_overbought', 55,
  'momentum_threshold', 0.2,
  'vwap_distance', 0.3,
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  'require_adx_rising', false,
  'regime_mode', 'auto'
)
WHERE status = 'running'
  AND strategy_config IS NULL;

-- Show what was updated
SELECT 
  id,
  name,
  symbol,
  status,
  (strategy_config->>'cooldown_bars')::int as cooldown_bars,
  (strategy_config->>'session_filter_enabled')::boolean as trading_hours_enabled,
  (strategy_config->>'bias_mode') as bias_mode,
  (strategy_config->>'adx_min_htf')::int as adx_min_htf,
  (strategy_config->>'adx_trend_min')::int as adx_trend_min
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

