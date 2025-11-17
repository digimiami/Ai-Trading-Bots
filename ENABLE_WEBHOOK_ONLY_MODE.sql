-- Enable webhook-only mode for TradingView bots
-- This makes bots only trade via webhooks (TradingView alerts), skipping scheduled executions

-- Enable for specific TradingView bots
UPDATE trading_bots
SET webhook_only = true
WHERE id IN (
  '02511945-ef73-47df-822d-15608d1bac9e',  -- BTC TRADIGVEW
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087'   -- ETH TRADINGVIEW
);

-- Verify the update
SELECT 
  id,
  name,
  status,
  webhook_only,
  paper_trading,
  webhook_trigger_immediate
FROM trading_bots
WHERE id IN (
  '02511945-ef73-47df-822d-15608d1bac9e',
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
);

-- To disable webhook-only mode (return to normal operation):
-- UPDATE trading_bots
-- SET webhook_only = false
-- WHERE id = 'your-bot-id';

