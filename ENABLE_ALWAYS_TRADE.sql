-- =============================================
-- ENABLE ALWAYS TRADE MODE FOR BOT
-- This script enables the "Always Trade" feature
-- Bot will trade on every execution cycle regardless of conditions
-- =============================================

-- OPTION 1: Enable for a specific bot by ID
-- Replace 'your-bot-id-here' with your actual bot ID
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade',
  'bias_mode', 'both',  -- 'both', 'long_only', or 'short_only'
  'max_trades_per_day', 20,
  'max_concurrent', 2,
  'cooldown_bars', 0,  -- No cooldown (trades every cycle)
  'risk_per_trade_pct', 1.0
)
WHERE id = 'your-bot-id-here';

-- OPTION 2: Enable for a bot by name
-- Replace 'Your Bot Name' with your actual bot name
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade',
  'bias_mode', 'both'
)
WHERE name = 'Your Bot Name';

-- OPTION 3: Enable for all paper trading bots (SAFE - Recommended for testing)
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade',
  'bias_mode', 'both',
  'max_trades_per_day', 20,
  'max_concurrent', 2
)
WHERE paper_trading = true
  AND status = 'running';

-- OPTION 4: Enable for a specific symbol (e.g., BTCUSDT)
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade',
  'bias_mode', 'both'
)
WHERE symbol = 'BTCUSDT'
  AND status = 'running';

-- =============================================
-- VERIFY THE CHANGE
-- =============================================

-- Check if always_trade is enabled
SELECT 
  id,
  name,
  symbol,
  paper_trading,
  status,
  strategy_config->>'always_trade' as always_trade_enabled,
  strategy_config->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode
FROM trading_bots 
WHERE strategy_config->>'always_trade' = 'true'
ORDER BY updated_at DESC;

-- =============================================
-- DISABLE ALWAYS TRADE (if needed)
-- =============================================

-- To disable Always Trade and return to normal strategy:
-- UPDATE trading_bots 
-- SET strategy_config = strategy_config - 'always_trade' - 'type'
-- WHERE id = 'your-bot-id-here';

-- =============================================
-- CREATE NEW BOT WITH ALWAYS TRADE
-- =============================================

-- Uncomment and modify to create a new bot with Always Trade enabled
/*
INSERT INTO trading_bots (
  user_id,
  name,
  exchange,
  trading_type,
  symbol,
  timeframe,
  leverage,
  trade_amount,
  stop_loss,
  take_profit,
  risk_level,
  status,
  strategy,
  strategy_config,
  paper_trading,
  created_at
)
SELECT 
  u.id as user_id,
  'Always Trade Bot - BTCUSDT' as name,
  'bybit' as exchange,
  'futures' as trading_type,
  'BTCUSDT' as symbol,
  '1h' as timeframe,
  3 as leverage,
  100 as trade_amount,
  2.0 as stop_loss,
  4.0 as take_profit,
  'medium' as risk_level,
  'running' as status,
  jsonb_build_object(
    'type', 'always_trade',
    'name', 'Always Trade Strategy'
  ) as strategy,
  jsonb_build_object(
    'always_trade', true,
    'type', 'always_trade',
    'bias_mode', 'both',
    'max_trades_per_day', 20,
    'max_concurrent', 2,
    'cooldown_bars', 0,
    'risk_per_trade_pct', 1.0
  ) as strategy_config,
  true as paper_trading,  -- Set to false for real trading
  NOW() as created_at
FROM auth.users u
WHERE u.email = 'your-email@example.com'  -- Change to your email
LIMIT 1;
*/

