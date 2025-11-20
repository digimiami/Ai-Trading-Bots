-- Fix strategy evaluation issues - make strategies much more lenient
-- This addresses the "No trading signals detected" problem

UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  -- Disable cooldown completely
  'cooldown_bars', 0,
  
  -- Disable trading hours filter
  'session_filter_enabled', false,
  'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  
  -- VERY lenient ADX thresholds (minimum allowed by validation)
  'adx_min_htf', 15,  -- Minimum allowed (15-35 range)
  'adx_trend_min', 10,  -- Lowered from 12
  'adx_min', 10,  -- Lowered from default
  'adx_min_reversal', 5,  -- Very low for mean reversion
  'adx_meanrev_max', 70,  -- Very high (allows more mean reversion opportunities)
  'adx_min_continuation', 8,  -- For scalping continuation
  'adx_min_reversal', 5,  -- For scalping reversal
  
  -- Very lenient RSI thresholds
  'rsi_oversold', 50,  -- Increased from 45 (more lenient - allows trades when RSI is neutral)
  'rsi_overbought', 50,  -- Decreased from 55 (more lenient - allows trades when RSI is neutral)
  
  -- Very lenient momentum and VWAP
  'momentum_threshold', 0.1,  -- Lowered from 0.2 (very lenient)
  'vwap_distance', 0.2,  -- Lowered from 0.3 (very lenient)
  
  -- Allow both long and short trades
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  
  -- Remove restrictive filters
  'require_adx_rising', false,  -- Don't require ADX to be rising
  'regime_mode', 'auto',
  
  -- For scalping strategy - very lenient volatility
  'min_volatility_atr', 0.1,  -- Lowered from 0.3 (very lenient)
  'atr_period', 14,
  
  -- Volume requirements - very lenient
  'min_volume_requirement', 0.5,  -- Lowered (allows low volume trades)
  'volume_multiplier_continuation', 0.5,  -- Lowered
  'volume_multiplier_reversal', 0.5,  -- Lowered
  'min_24h_volume_usd', 1000000,  -- Lowered from 500M (allows smaller coins)
  
  -- EMA settings - more lenient
  'ema_fast', 9,  -- Faster EMA for quicker signals
  'ema_slow', 21,  -- Standard slow EMA
  
  -- Confidence threshold - lower
  'ml_confidence_threshold', 0.4,  -- Lowered from 0.6 (more trades)
  
  -- Remove time filters
  'time_filter_enabled', false
)
WHERE status = 'running'
  AND (
    -- Update bots with "unknown" strategy type or no strategy config
    strategy::text NOT LIKE '%hybrid_trend_meanreversion%'
    AND strategy::text NOT LIKE '%scalping%'
    AND strategy::text NOT LIKE '%advanced_scalping%'
    AND strategy::text NOT LIKE '%trendline_breakout%'
    OR strategy_config IS NULL
    OR (strategy_config->>'adx_min_htf')::int > 15
    OR (strategy_config->>'adx_trend_min')::int > 10
  );

-- Also update bots that have strategy but still getting "no signals"
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
  'cooldown_bars', 0,
  'session_filter_enabled', false,
  'adx_min_htf', 15,
  'adx_trend_min', 10,
  'adx_min', 10,
  'adx_min_reversal', 5,
  'adx_meanrev_max', 70,
  'rsi_oversold', 50,
  'rsi_overbought', 50,
  'momentum_threshold', 0.1,
  'vwap_distance', 0.2,
  'bias_mode', 'both',
  'require_price_vs_trend', 'any',
  'require_adx_rising', false,
  'regime_mode', 'auto',
  'min_volatility_atr', 0.1,
  'min_volume_requirement', 0.5,
  'ml_confidence_threshold', 0.4,
  'time_filter_enabled', false
)
WHERE status = 'running'
  AND id IN (
    -- Bots that have been getting "no signals" frequently
    SELECT DISTINCT bot_id
    FROM bot_activity_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND (
        message LIKE '%No trading signals detected%'
        OR message LIKE '%Strategy conditions not met%'
      )
    GROUP BY bot_id
    HAVING COUNT(*) > 100  -- More than 100 "no signals" logs
  );

-- Show updated bots
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
    ELSE 'unknown'
  END as strategy_type,
  (strategy_config->>'cooldown_bars')::int as cooldown_bars,
  (strategy_config->>'adx_min_htf')::int as adx_min_htf,
  (strategy_config->>'adx_trend_min')::int as adx_trend_min,
  (strategy_config->>'rsi_oversold')::int as rsi_oversold,
  (strategy_config->>'bias_mode') as bias_mode
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

