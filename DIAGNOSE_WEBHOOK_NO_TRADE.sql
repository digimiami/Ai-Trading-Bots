-- Diagnostic query to check why webhook didn't create a trade on Bybit
-- Run this after a webhook test to see what happened

-- 1. Check if manual_trade_signal was created
SELECT 
  id,
  bot_id,
  side,
  mode,
  status,
  created_at,
  processed_at,
  error,
  reason,
  size_multiplier
FROM manual_trade_signals
WHERE bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check bot configuration
SELECT 
  id,
  name,
  status,
  paper_trading,
  symbol,
  exchange,
  trading_type,
  trade_amount,
  user_id
FROM trading_bots
WHERE id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087';

-- 3. Check bot-executor logs for this bot (most recent execution)
SELECT 
  id,
  bot_id,
  level,
  category,
  message,
  details,
  created_at
FROM bot_activity_logs
WHERE bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;

-- 4. Check if any trades were created (real or paper)
SELECT 
  id,
  bot_id,
  side,
  symbol,
  price,
  amount as quantity,
  status,
  created_at,
  'real' as trade_type
FROM trades
WHERE bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5

UNION ALL

SELECT 
  id,
  bot_id,
  side,
  symbol,
  entry_price as price,
  quantity,
  status,
  created_at,
  'paper' as trade_type
FROM paper_trading_trades
WHERE bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check API keys for this bot's user
SELECT 
  ak.id,
  ak.user_id,
  ak.exchange,
  ak.is_testnet,
  ak.is_active,
  ak.created_at,
  u.email
FROM api_keys ak
JOIN auth.users u ON u.id = ak.user_id
WHERE ak.user_id = (
  SELECT user_id FROM trading_bots WHERE id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
)
ORDER BY ak.created_at DESC;

-- 6. Check for execution flow logs (cooldown, trading hours, safety checks, etc.)
SELECT 
  id,
  bot_id,
  level,
  category,
  message,
  details->>'step' as step,
  details->>'stopped' as stopped,
  details->>'passed' as passed,
  created_at
FROM bot_activity_logs
WHERE bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND created_at >= NOW() - INTERVAL '1 hour'
  AND (
    message LIKE '%cooldown%' OR
    message LIKE '%trading hours%' OR
    message LIKE '%safety%' OR
    message LIKE '%market data%' OR
    message LIKE '%strategy%' OR
    message LIKE '%manual%' OR
    message LIKE '%REAL TRADING%' OR
    message LIKE '%PAPER TRADING%'
  )
ORDER BY created_at DESC;

