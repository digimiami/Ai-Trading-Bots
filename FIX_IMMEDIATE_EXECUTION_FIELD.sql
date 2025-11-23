-- Fix: Rename immediate_trading to immediate_execution for code compatibility
-- The bot-executor checks for 'immediate_execution' not 'immediate_trading'

-- PART 1: ADD immediate_execution field to all paper trading bots
UPDATE trading_bots
SET strategy_config = strategy_config || jsonb_build_object('immediate_execution', true)
WHERE paper_trading = true
  AND status = 'running'
  AND strategy_config IS NOT NULL;

-- PART 2: Verify the update
SELECT 
  id,
  name,
  symbol,
  timeframe,
  strategy_config->>'immediate_execution' as immediate_execution,
  strategy_config->>'super_aggressive' as super_aggressive,
  strategy_config->>'immediate_trading' as immediate_trading_old,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'adx_threshold' as adx_threshold
FROM trading_bots
WHERE paper_trading = true
  AND status = 'running'
ORDER BY name;

