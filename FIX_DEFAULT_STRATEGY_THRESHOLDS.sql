-- CRITICAL FIX: Update strategy JSON for bots with "unknown" strategy type
-- The default strategy evaluation uses strategy.rsiThreshold and strategy.adxThreshold
-- These are currently too strict (RSI 70/30, ADX 25), causing "No trading signals"

-- Update strategy JSON to have VERY lenient thresholds
-- RSI threshold of 50 means: RSI > 50 = sell, RSI < 50 = buy (ALWAYS generates signal!)
-- ADX threshold of 3 means: ADX > 3 = trade (almost always true)
UPDATE trading_bots
SET strategy = jsonb_build_object(
  'type', 'default',
  'name', 'Default Strategy',
  'rsiThreshold', 50,  -- Changed from 70 to 50 (RSI > 50 = sell, RSI < 50 = buy - ALWAYS trades!)
  'adxThreshold', 3,  -- Changed from 25 to 3 (very lenient - allows trades in choppy markets)
  'bbWidthThreshold', 0.005,  -- Lowered from 0.02 (very lenient)
  'emaSlope', 0.05,  -- Lowered from 0.5 (very lenient)
  'atrPercentage', 0.1,  -- Lowered from 2.5 (very lenient)
  'vwapDistance', 0.1,  -- Lowered from 1.2 (very lenient)
  'momentumThreshold', 0.05,  -- Lowered from 0.8 (very lenient)
  'useMLPrediction', false,
  'minSamplesForML', 100
)::text
WHERE status = 'running'
  AND (
    -- Update bots with "unknown" strategy type
    strategy::text NOT LIKE '%hybrid_trend_meanreversion%'
    AND strategy::text NOT LIKE '%scalping%'
    AND strategy::text NOT LIKE '%advanced_scalping%'
    AND strategy::text NOT LIKE '%trendline_breakout%'
    -- OR strategy has strict thresholds
    OR (strategy::text LIKE '%"rsiThreshold":70%' OR strategy::text LIKE '%"rsiThreshold": 70%')
    OR (strategy::text LIKE '%"adxThreshold":25%' OR strategy::text LIKE '%"adxThreshold": 25%')
  );

-- Also update strategy_config to be very lenient (for strategy-specific evaluations)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  'cooldown_bars', 0,
  'session_filter_enabled', false,
  'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  'adx_min_htf', 15,  -- Minimum allowed by validation (15-35 range)
  'adx_trend_min', 5,  -- Very low
  'adx_min', 5,  -- Very low
  'adx_min_reversal', 3,  -- Very low
  'adx_meanrev_max', 80,  -- Very high
  'rsi_oversold', 55,  -- Very lenient (allows trades when RSI is neutral)
  'rsi_overbought', 45,  -- Very lenient (allows trades when RSI is neutral)
  'momentum_threshold', 0.05,  -- Very low
  'vwap_distance', 0.1,  -- Very low
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  'require_adx_rising', false,
  'regime_mode', 'auto',
  'min_volatility_atr', 0.05,  -- Very low for scalping
  'min_volume_requirement', 0.3,  -- Very low
  'ml_confidence_threshold', 0.3,  -- Very low
  'time_filter_enabled', false,
  'disable_htf_adx_check', false  -- Default to false (can be enabled per bot via UI)
)
WHERE status = 'running'
  AND (strategy::text NOT LIKE '%hybrid_trend_meanreversion%' AND strategy::text NOT LIKE '%Hybrid Trend%');

-- For hybrid_trend_meanreversion strategy - Use minimum allowed values
-- Note: adx_min_htf must be between 15-35 per validation, so we use 15 (minimum)
-- The code will check for disable_htf_adx_check flag to bypass HTF ADX check
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  'adx_min_htf', 15,  -- Minimum allowed by validation (15-35 range)
  'adx_trend_min', 0,  -- 0 = DISABLE current timeframe ADX check (no validation on this)
  'adx_min', 0,  -- 0 = DISABLE ADX check (no validation on this)
  'adx_min_reversal', 0,  -- 0 = DISABLE ADX reversal check (no validation on this)
  'adx_meanrev_max', 100,  -- Very high (effectively disables this check)
  'disable_htf_adx_check', true,  -- Flag to bypass HTF ADX check in code (CRITICAL)
  'rsi_oversold', 55,  -- Very lenient
  'rsi_overbought', 45,  -- Very lenient
  'momentum_threshold', 0.05,  -- Very low
  'vwap_distance', 0.1,  -- Very low
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  'require_adx_rising', false,
  'cooldown_bars', 0,
  'session_filter_enabled', false
)
WHERE status = 'running'
  AND (strategy::text LIKE '%hybrid_trend_meanreversion%' OR strategy::text LIKE '%Hybrid Trend%');

-- For scalping strategy - make ALL requirements very lenient
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  'min_volatility_atr', 0,  -- 0 = DISABLE volatility check (was 0.3)
  'adx_min', 0,  -- 0 = DISABLE ADX check (was 20, too strict)
  'rsi_oversold', 55,  -- Very lenient
  'rsi_overbought', 45,  -- Very lenient
  'volume_multiplier', 0.5,  -- Very low (was 1.2)
  'min_volume_requirement', 0,  -- 0 = DISABLE volume check (was 1.2)
  'time_filter_enabled', false,  -- Disable time filter
  'cooldown_bars', 0,
  'session_filter_enabled', false
)
WHERE status = 'running'
  AND (strategy::text LIKE '%scalping%' OR strategy::text LIKE '%Scalping%');

-- Show what was updated
SELECT 
  id,
  name,
  symbol,
  status,
  CASE 
    WHEN strategy::text LIKE '%hybrid_trend_meanreversion%' THEN 'hybrid_trend_meanreversion'
    WHEN strategy::text LIKE '%scalping%' THEN 'scalping'
    WHEN strategy::text LIKE '%advanced_scalping%' THEN 'advanced_scalping'
    WHEN strategy::text LIKE '%trendline_breakout%' THEN 'trendline_breakout'
    ELSE 'default'
  END as strategy_type,
  (strategy::jsonb->>'rsiThreshold')::int as rsi_threshold,
  (strategy::jsonb->>'adxThreshold')::int as adx_threshold,
  (strategy_config->>'cooldown_bars')::int as cooldown_bars,
  (strategy_config->>'adx_min_htf')::int as adx_min_htf,
  (strategy_config->>'adx_trend_min')::int as adx_trend_min,
  (strategy_config->>'rsi_oversold')::int as rsi_oversold,
  (strategy_config->>'disable_htf_adx_check')::boolean as disable_htf_adx_check
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

