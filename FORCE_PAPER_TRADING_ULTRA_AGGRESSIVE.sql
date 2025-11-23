-- ============================================
-- ULTRA AGGRESSIVE PAPER TRADING FIX
-- ============================================
-- This makes paper trading bots trade on ANY RSI condition
-- regardless of EMA, ADX, volume, or other filters

-- PART 1: Update strategy_config to be ULTRA aggressive
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'rsi_oversold', 50,
  'rsi_overbought', 50,
  'adx_threshold', 0,  -- 0 = skip ADX check
  'adx_min', 0,  -- 0 = skip ADX check in scalping strategy
  'min_volatility_atr', 0,  -- 0 = skip volatility check
  'min_volume_requirement', 0,  -- 0 = skip volume check
  'cooldownBars', 0,
  'cooldown_bars', 0,
  'checkHTFADX', false,
  'disable_htf_adx_check', true,
  'immediate_execution', true,
  'super_aggressive', true,
  'immediate_trading', true,
  'time_filter_enabled', false  -- Disable time filter
)
WHERE paper_trading = true
  AND status = 'running';

-- PART 2: Also update strategy field to match
UPDATE trading_bots
SET strategy = '{"type":"scalping","rsiThreshold":50,"adxThreshold":0,"bbWidthThreshold":0.01,"emaSlope":0.1,"atrPercentage":0.5,"vwapDistance":0.5,"momentumThreshold":0.1,"useMLPrediction":true,"minSamplesForML":50,"super_aggressive":true,"immediate_execution":true}'::json
WHERE paper_trading = true
  AND status = 'running';

-- PART 3: Verify
SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb->>'rsiThreshold') as strategy_rsi,
  (strategy::jsonb->>'adxThreshold') as strategy_adx,
  strategy_config->>'rsi_oversold' as config_rsi_oversold,
  strategy_config->>'adx_min' as config_adx_min,
  strategy_config->>'immediate_execution' as config_immediate_execution,
  strategy_config->>'super_aggressive' as config_super_aggressive,
  strategy_config->>'min_volatility_atr' as config_min_volatility,
  strategy_config->>'min_volume_requirement' as config_min_volume
FROM trading_bots
WHERE paper_trading = true
  AND status = 'running'
ORDER BY name
LIMIT 10;

