-- Check bot configuration for completed signals (standalone query)
SELECT 
  tb.id,
  tb.name,
  tb.status,
  tb.paper_trading,
  tb.webhook_only,
  tb.exchange,
  tb.symbol,
  tb.trading_type,
  COUNT(mts.id) as completed_signals,
  MAX(mts.created_at) as latest_signal
FROM trading_bots tb
LEFT JOIN manual_trade_signals mts ON mts.bot_id = tb.id 
  AND mts.status = 'completed' 
  AND mts.created_at >= NOW() - INTERVAL '2 hours'
WHERE tb.id IN (
  SELECT DISTINCT bot_id 
  FROM manual_trade_signals 
  WHERE status = 'completed' 
    AND mode = 'real'
    AND created_at >= NOW() - INTERVAL '2 hours'
)
GROUP BY tb.id, tb.name, tb.status, tb.paper_trading, tb.webhook_only, tb.exchange, tb.symbol, tb.trading_type;

