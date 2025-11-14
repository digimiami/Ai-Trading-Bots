-- =============================================
-- URGENT: Run This SQL in Supabase Dashboard NOW
-- =============================================
-- This will immediately fix the Pablo Ready bot:
-- 1. Change BTCUSDT → SOLUSDT
-- 2. Change 1h → 1d
-- 3. Disable Multi TP and Trailing SL
-- =============================================

-- Step 1: Update the bot record
UPDATE public.pablo_ready_bots
SET 
  symbol = 'SOLUSDT',
  timeframe = '1d',
  strategy_config = jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{enable_tp}',
      'false'::jsonb
    ),
    '{enable_trail_sl}',
    'false'::jsonb
  ),
  description = 'Advanced trendline breakout strategy using linear regression with volume confirmation. Optimized for SOLUSDT on Daily timeframe.'
WHERE name = 'Trendline Breakout Strategy';

-- Step 2: Verify the update worked
SELECT 
  id,
  name,
  symbol,
  timeframe,
  strategy_config->>'enable_tp' as enable_tp,
  strategy_config->>'enable_trail_sl' as enable_trail_sl,
  enabled
FROM public.pablo_ready_bots
WHERE name = 'Trendline Breakout Strategy';

-- Expected result:
-- symbol: SOLUSDT
-- timeframe: 1d
-- enable_tp: false
-- enable_trail_sl: false

