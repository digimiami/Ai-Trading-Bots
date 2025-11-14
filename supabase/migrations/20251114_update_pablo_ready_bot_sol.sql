-- Update Pablo Ready bot to SOLUSDT, 1d timeframe, and disable Multi TP/Trailing SL
-- This migration fixes any existing records that have wrong values

-- Update if symbol is BTCUSDT
UPDATE public.pablo_ready_bots
SET 
  symbol = 'SOLUSDT',
  timeframe = '1d',
  strategy_config = strategy_config || '{"enable_tp": false, "enable_trail_sl": false}'::jsonb
WHERE name = 'Trendline Breakout Strategy'
  AND (symbol = 'BTCUSDT' OR timeframe = '1h');

-- Update if symbol is already SOLUSDT but wrong timeframe or settings
UPDATE public.pablo_ready_bots
SET 
  timeframe = '1d',
  strategy_config = strategy_config || '{"enable_tp": false, "enable_trail_sl": false}'::jsonb
WHERE name = 'Trendline Breakout Strategy'
  AND symbol = 'SOLUSDT'
  AND (timeframe != '1d' OR 
       COALESCE((strategy_config->>'enable_tp')::boolean, true) IS DISTINCT FROM false OR
       COALESCE((strategy_config->>'enable_trail_sl')::boolean, true) IS DISTINCT FROM false);

-- Ensure all Trendline Breakout Strategy bots have correct settings
UPDATE public.pablo_ready_bots
SET 
  symbol = 'SOLUSDT',
  timeframe = '1d',
  strategy_config = COALESCE(strategy_config, '{}'::jsonb) || '{"enable_tp": false, "enable_trail_sl": false}'::jsonb
WHERE name = 'Trendline Breakout Strategy';

