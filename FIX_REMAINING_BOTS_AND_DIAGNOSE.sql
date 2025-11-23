-- ============================================
-- FIX REMAINING BOTS + DIAGNOSE WHY NO TRADES
-- ============================================

-- PART 1: Fix the 3 bots with null values
UPDATE trading_bots
SET strategy = '{"type":"scalping","rsiThreshold":50,"adxThreshold":10,"bbWidthThreshold":0.01,"emaSlope":0.1,"atrPercentage":1.0,"vwapDistance":2.0,"momentumThreshold":0.3,"useMLPrediction":true,"minSamplesForML":50,"super_aggressive":true,"immediate_execution":true}'::json,
    strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
      'rsi_oversold', 50,
      'rsi_overbought', 50,
      'adx_threshold', 10,
      'cooldownBars', 0,
      'cooldown_bars', 0,
      'checkHTFADX', false,
      'disable_htf_adx_check', true,
      'immediate_execution', true,
      'super_aggressive', true,
      'immediate_trading', true
    )
WHERE id IN (
  '76c27213-0bb0-4d43-87a3-c13a3cd566c2',  -- "21222"
  'ea3038cc-ff8e-41fd-a760-da9a8b599669',  -- "Hybrid Trend + Mean Reversion Strategy - HMARUSDT"
  '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead',  -- "Trend Following Strategy-Find Trading Pairs - DOGEUSDT"
  'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874'   -- "Trendline Breakout Strategy - SOLUSDT"
);

-- PART 2: Fix bots with rsi_oversold: "0" (too aggressive, might cause issues)
UPDATE trading_bots
SET strategy_config = strategy_config || jsonb_build_object(
  'rsi_oversold', 50,
  'rsi_overbought', 50,
  'adx_threshold', 10
)
WHERE paper_trading = true
  AND status = 'running'
  AND (
    (strategy_config->>'rsi_oversold')::numeric = 0
    OR (strategy_config->>'rsi_overbought')::numeric = 100
    OR (strategy_config->>'adx_threshold')::numeric = 0
  );

-- PART 3: Check recent bot activity logs for strategy evaluation results
SELECT 
  bal.created_at,
  tb.name as bot_name,
  tb.symbol,
  bal.category,
  bal.level,
  bal.message,
  bal.details
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '10 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND (
    bal.category = 'strategy'
    OR bal.message LIKE '%shouldTrade%'
    OR bal.message LIKE '%Strategy conditions%'
    OR bal.message LIKE '%RSI%'
    OR bal.message LIKE '%ADX%'
  )
ORDER BY bal.created_at DESC
LIMIT 100;

-- PART 4: Check for errors in bot execution
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.level,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '10 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.level = 'error'
ORDER BY bal.created_at DESC
LIMIT 50;

-- PART 5: Check if bots are actually being executed
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '5 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.category = 'system'
  AND bal.message LIKE '%PAPER%'
ORDER BY bal.created_at DESC
LIMIT 50;

-- PART 6: Verify all fixes applied
SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb->>'rsiThreshold') as strategy_rsi_threshold,
  (strategy::jsonb->>'immediate_execution') as strategy_immediate_execution,
  strategy_config->>'rsi_oversold' as config_rsi_oversold,
  strategy_config->>'immediate_execution' as config_immediate_execution,
  strategy_config->>'super_aggressive' as config_super_aggressive
FROM trading_bots
WHERE paper_trading = true
  AND status = 'running'
ORDER BY name;

