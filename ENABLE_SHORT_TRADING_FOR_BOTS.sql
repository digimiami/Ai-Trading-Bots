-- Enable Short Trading for All Bots
-- This script updates bot configurations to allow both long and short trades

-- Step 1: Check current configurations
SELECT 
  id,
  name,
  symbol,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode'), 'NULL') as current_bias_mode,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'require_price_vs_trend'), 'NULL') as current_require_price_vs_trend,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction'), 'NULL') as current_trade_direction,
  CASE 
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') = 'long-only' THEN '⚠️ LONG ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') = 'short-only' THEN '⚠️ SHORT ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') IN ('both', 'auto') OR strategy_config IS NULL OR (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') IS NULL THEN '✅ BOTH ALLOWED'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Long Only' THEN '⚠️ LONG ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Short Only' THEN '⚠️ SHORT ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Both' OR strategy_config IS NULL OR (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') IS NULL THEN '✅ BOTH ALLOWED'
    ELSE '❓ UNKNOWN'
  END as current_status
FROM trading_bots
WHERE id IN (
  'ea3038cc-ff8e-41fd-a760-da9a8b599669', -- Hybrid Trend + Mean Reversion Strategy - HMARUSDT
  'cd3ed89b-e9f5-4056-9857-30a94d82764a', -- Trendline Breakout Strategy - SOLUSDT
  '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead', -- Trend Following Strategy-Find Trading Pairs - DOGEUSDT
  '16be35a3-d494-4b4b-b254-0ea0caa83ce6', -- BTC AI Strategy Presets
  'b4c422fd-c9f0-41c3-9fbe-13d0e5689345', -- ADA AGRE
  '5c9fe165-3a1d-4115-988d-cef9ac2e4ece'  -- ETH AGRE
)
ORDER BY name;

-- Step 2: Enable both directions for Hybrid Strategy bots
-- Set bias_mode to 'both' and require_price_vs_trend to 'any'
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb
  || '{"bias_mode": "both", "require_price_vs_trend": "any"}'::jsonb
WHERE id = 'ea3038cc-ff8e-41fd-a760-da9a8b599669'; -- Hybrid Trend + Mean Reversion Strategy

-- Step 3: Enable both directions for Trendline Breakout Strategy
-- Set trade_direction to 'Both'
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb
  || '{"trade_direction": "Both"}'::jsonb
WHERE id = 'cd3ed89b-e9f5-4056-9857-30a94d82764a'; -- Trendline Breakout Strategy

-- Step 4: Enable both directions for all other bots (set bias_mode to 'both' or 'auto')
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb
  || '{"bias_mode": "both"}'::jsonb
WHERE id IN (
  '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead', -- Trend Following Strategy-Find Trading Pairs - DOGEUSDT
  '16be35a3-d494-4b4b-b254-0ea0caa83ce6', -- BTC AI Strategy Presets
  'b4c422fd-c9f0-41c3-9fbe-13d0e5689345', -- ADA AGRE
  '5c9fe165-3a1d-4115-988d-cef9ac2e4ece'  -- ETH AGRE
);

-- Step 5: Verify the changes
SELECT 
  id,
  name,
  symbol,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode'), 'NULL') as new_bias_mode,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'require_price_vs_trend'), 'NULL') as new_require_price_vs_trend,
  COALESCE((COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction'), 'NULL') as new_trade_direction,
  CASE 
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') = 'long-only' THEN '⚠️ LONG ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') = 'short-only' THEN '⚠️ SHORT ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') IN ('both', 'auto') OR strategy_config IS NULL OR (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'bias_mode') IS NULL THEN '✅ BOTH ALLOWED'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Long Only' THEN '⚠️ LONG ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Short Only' THEN '⚠️ SHORT ONLY'
    WHEN (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') = 'Both' OR strategy_config IS NULL OR (COALESCE(strategy_config, '{}'::jsonb)::jsonb->>'trade_direction') IS NULL THEN '✅ BOTH ALLOWED'
    ELSE '❓ UNKNOWN'
  END as new_status
FROM trading_bots
WHERE id IN (
  'ea3038cc-ff8e-41fd-a760-da9a8b599669',
  'cd3ed89b-e9f5-4056-9857-30a94d82764a',
  '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead',
  '16be35a3-d494-4b4b-b254-0ea0caa83ce6',
  'b4c422fd-c9f0-41c3-9fbe-13d0e5689345',
  '5c9fe165-3a1d-4115-988d-cef9ac2e4ece'
)
ORDER BY name;

