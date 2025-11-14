-- Direct fix for Pablo Ready bot - Run this immediately
-- Updates the bot to SOLUSDT, 1d timeframe, and disables Multi TP/Trailing SL

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

-- Verify the update
SELECT 
  id,
  name,
  symbol,
  timeframe,
  strategy_config->>'enable_tp' as enable_tp,
  strategy_config->>'enable_trail_sl' as enable_trail_sl
FROM public.pablo_ready_bots
WHERE name = 'Trendline Breakout Strategy';

