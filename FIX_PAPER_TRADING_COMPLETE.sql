-- ============================================
-- COMPLETE PAPER TRADING FIX
-- ============================================
-- This fixes ALL issues preventing paper trading from working
-- Run this ENTIRE file in Supabase SQL Editor

-- PART 1: Fix the OLD 'strategy' field (this is what bot-executor reads!)
-- This is the CRITICAL fix - the bot-executor reads from 'strategy' not 'strategy_config'
UPDATE trading_bots
SET strategy = '{"type":"scalping","rsiThreshold":50,"adxThreshold":10,"bbWidthThreshold":0.01,"emaSlope":0.1,"atrPercentage":1.0,"vwapDistance":2.0,"momentumThreshold":0.3,"useMLPrediction":true,"minSamplesForML":50,"super_aggressive":true,"immediate_execution":true}'::json
WHERE paper_trading = true
  AND status = 'running';

-- PART 2: Ensure strategy_config also has correct values
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
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
WHERE paper_trading = true
  AND status = 'running';

-- PART 3: Verify the fix
SELECT 
  id,
  name,
  symbol,
  paper_trading,
  status,
  (strategy::jsonb->>'rsiThreshold') as old_rsi_threshold,
  (strategy::jsonb->>'adxThreshold') as old_adx_threshold,
  (strategy::jsonb->>'immediate_execution') as old_immediate_execution,
  strategy_config->>'rsi_oversold' as new_rsi_oversold,
  strategy_config->>'immediate_execution' as new_immediate_execution,
  strategy_config->>'super_aggressive' as new_super_aggressive
FROM trading_bots
WHERE paper_trading = true
  AND status = 'running'
ORDER BY name;

-- PART 4: Check if paper trading accounts exist
SELECT 
  pta.user_id,
  u.email,
  pta.balance,
  pta.initial_balance,
  pta.created_at
FROM paper_trading_accounts pta
LEFT JOIN auth.users u ON pta.user_id = u.id
ORDER BY pta.created_at DESC;

-- PART 5: Check recent paper trading activity
SELECT 
  COUNT(*) as total_paper_trades,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as trades_last_hour,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '10 minutes' THEN 1 END) as trades_last_10min,
  MAX(created_at) as last_trade_time
FROM paper_trading_trades;

-- PART 6: Check for errors in bot logs (last 10 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.level,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '10 minutes'
  AND bal.level = 'error'
  AND tb.paper_trading = true
ORDER BY bal.created_at DESC
LIMIT 50;

