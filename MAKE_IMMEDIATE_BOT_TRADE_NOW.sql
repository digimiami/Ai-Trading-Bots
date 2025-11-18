-- =============================================
-- Make Immediate Trading Bot Trade RIGHT NOW
-- Run this AFTER creating a bot from Pablo Ready
-- =============================================

-- Step 1: Find the bot you just created
-- Replace 'YOUR_BOT_NAME_HERE' with the actual bot name
-- Example: 'Immediate Trading Bot - Custom Pairs - BTCUSDT'

-- Step 2: Update the bot to have ULTRA-LENIENT settings
UPDATE trading_bots
SET 
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    -- Scalping Strategy - Ultra Lenient
    'adx_min', 5,  -- Very low ADX requirement (was 10)
    'min_volume_requirement', 0.1,  -- Very low volume (was 0.2)
    'volume_multiplier', 0.3,  -- Very low volume multiplier (was 0.5)
    'min_volatility_atr', 0.05,  -- Very low volatility requirement (was 0.1)
    'rsi_oversold', 50,  -- More lenient RSI oversold (was 40)
    'rsi_overbought', 50,  -- More lenient RSI overbought (was 60)
    'time_filter_enabled', false,  -- No time restrictions
    'cooldown_bars', 0,  -- No cooldown (was 1)
    'immediate_execution', true,
    'fast_entry', true
  )::jsonb,
  timeframe = '5m'  -- Ensure it's 5m for scalping
WHERE name LIKE '%Immediate Trading Bot%'
  AND status = 'running'
  AND created_at > NOW() - INTERVAL '1 hour';  -- Only update recently created bots

-- Step 3: Verify the update
SELECT 
  id,
  name,
  symbol,
  timeframe,
  status,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'immediate_execution' as immediate_execution
FROM trading_bots
WHERE name LIKE '%Immediate Trading Bot%'
  AND status = 'running'
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check recent bot activity logs to see why it's not trading
SELECT 
  id,
  bot_id,
  level,
  category,
  message,
  details,
  created_at
FROM bot_activity_logs
WHERE bot_id IN (
  SELECT id FROM trading_bots 
  WHERE name LIKE '%Immediate Trading Bot%' 
  AND status = 'running'
)
ORDER BY created_at DESC
LIMIT 20;

