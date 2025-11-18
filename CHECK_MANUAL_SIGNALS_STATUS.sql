-- Check manual trade signals status for recent webhooks
-- This will show if signals are being created and what their status is

SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  mts.status,
  mts.side,
  mts.mode,
  mts.created_at,
  mts.processed_at,
  mts.reason,
  mts.size_multiplier,
  mts.error,
  CASE 
    WHEN mts.status = 'pending' THEN '⏳ Waiting to be processed'
    WHEN mts.status = 'processing' THEN '🔄 Currently being processed'
    WHEN mts.status = 'completed' THEN '✅ Completed (check if trade was created)'
    WHEN mts.status = 'failed' THEN '❌ Failed (check error message)'
    ELSE '❓ Unknown status'
  END as status_description
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY mts.created_at DESC
LIMIT 20;

-- Check if trades were created for completed signals
SELECT 
  mts.id as signal_id,
  mts.bot_id,
  tb.name as bot_name,
  mts.status as signal_status,
  mts.side,
  mts.mode,
  mts.created_at as signal_created,
  t.id as trade_id,
  t.status as trade_status,
  t.price,
  t.amount,
  t.executed_at
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
LEFT JOIN trades t ON t.bot_id = mts.bot_id 
  AND t.side = mts.side 
  AND t.executed_at >= mts.created_at 
  AND t.executed_at <= mts.created_at + INTERVAL '5 minutes'
WHERE mts.created_at >= NOW() - INTERVAL '1 hour'
  AND mts.status = 'completed'
ORDER BY mts.created_at DESC
LIMIT 20;

-- Check bot status
SELECT 
  id,
  name,
  status,
  paper_trading,
  webhook_only,
  symbol,
  exchange
FROM trading_bots
WHERE id IN (
  '02511945-ef73-47df-822d-15608d1bac9e', -- BTC TRADIGVEW
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087'  -- ETH TRADINGVIEW
);

