-- Migration: Add webhook_only mode to trading_bots
-- Description: Allows bots to only trade via webhooks (TradingView alerts), skipping scheduled/cron executions

-- Add webhook_only column to trading_bots table
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS webhook_only BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN trading_bots.webhook_only IS 'If true, bot only executes trades from webhook triggers (TradingView alerts). Scheduled/cron executions are skipped, but manual trade signals are still processed.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_trading_bots_webhook_only 
ON trading_bots(webhook_only) 
WHERE webhook_only = true;

