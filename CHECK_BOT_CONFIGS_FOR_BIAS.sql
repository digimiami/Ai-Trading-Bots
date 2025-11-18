-- Check bot configurations to see why they're only trading long
-- This will show bias_mode and trade_direction settings

SELECT 
  id,
  name,
  symbol,
  status,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'trade_direction' as trade_direction,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  strategy_config->>'htf_timeframe' as htf_timeframe,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '⚠️ RESTRICTED TO LONG ONLY'
    WHEN strategy_config->>'bias_mode' = 'short-only' THEN '⚠️ RESTRICTED TO SHORT ONLY'
    WHEN strategy_config->>'bias_mode' IN ('both', 'auto') OR strategy_config->>'bias_mode' IS NULL THEN '✅ BOTH ALLOWED'
    WHEN strategy_config->>'trade_direction' = 'Long Only' THEN '⚠️ RESTRICTED TO LONG ONLY'
    WHEN strategy_config->>'trade_direction' = 'Short Only' THEN '⚠️ RESTRICTED TO SHORT ONLY'
    WHEN strategy_config->>'trade_direction' = 'Both' OR strategy_config->>'trade_direction' IS NULL THEN '✅ BOTH ALLOWED'
    ELSE '❓ UNKNOWN'
  END as config_status,
  strategy_config as full_config
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

