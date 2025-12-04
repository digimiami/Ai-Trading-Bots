-- =====================================================
-- Bot Executor Update Script for Bitunix Support
-- =====================================================
-- This script updates bot configurations and settings
-- related to the bot-executor Edge Function improvements
-- for Bitunix exchange support.
-- =====================================================

-- 1. Create table to track bot-executor deployments/versions
CREATE TABLE IF NOT EXISTS bot_executor_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) NOT NULL,
    description TEXT,
    changes JSONB DEFAULT '{}'::jsonb,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true
);

-- Add index for active versions
CREATE INDEX IF NOT EXISTS idx_bot_executor_versions_active 
ON bot_executor_versions(is_active, deployed_at DESC);

-- 2. Log current bot-executor update
INSERT INTO bot_executor_versions (version, description, changes)
VALUES (
    'v2.0.0-bitunix-fix',
    'Bitunix Exchange Support - Fixed order placement and price fetching',
    '{
        "order_endpoints": ["Removed invalid endpoints", "Added /api/v1/trade/order", "Added /api/v1/order"],
        "price_fetching": ["Enhanced logging", "Improved symbol matching", "Added CoinGecko fallback for major coins"],
        "signature_method": ["Updated to double SHA256", "Fixed nonce generation"],
        "base_urls": ["Added fapi.bitunix.com for futures", "Added api.bitunix.com for spot"]
    }'::jsonb
);

-- 3. Update Bitunix bot configurations to ensure proper settings
-- This ensures all Bitunix bots have correct trading type and exchange settings
UPDATE trading_bots
SET 
    exchange = 'bitunix',
    trading_type = COALESCE(trading_type, 'futures'),
    updated_at = NOW()
WHERE exchange = 'bitunix'
  AND (trading_type IS NULL OR trading_type = '');

-- 4. Add/Update strategy_config for Bitunix bots to ensure compatibility
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'bitunix_enabled', true,
    'bitunix_market_type', CASE 
        WHEN trading_type = 'futures' OR trading_type = 'linear' THEN 'futures'
        ELSE 'spot'
    END,
    'price_fallback_enabled', true,
    'coingecko_fallback', true
)
WHERE exchange = 'bitunix'
  AND (strategy_config->>'bitunix_enabled' IS NULL OR strategy_config->>'bitunix_enabled' = 'false');

-- 5. Create function to get active bot-executor version
CREATE OR REPLACE FUNCTION get_active_bot_executor_version()
RETURNS TABLE (
    version VARCHAR(50),
    description TEXT,
    deployed_at TIMESTAMP WITH TIME ZONE,
    changes JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bev.version,
        bev.description,
        bev.deployed_at,
        bev.changes
    FROM bot_executor_versions bev
    WHERE bev.is_active = true
    ORDER BY bev.deployed_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to log bot execution errors for Bitunix
CREATE TABLE IF NOT EXISTS bot_execution_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
    error_type VARCHAR(50), -- 'price_fetch', 'order_placement', 'api_error', etc.
    error_message TEXT,
    error_details JSONB DEFAULT '{}'::jsonb,
    exchange VARCHAR(20),
    symbol VARCHAR(20),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for error tracking
CREATE INDEX IF NOT EXISTS idx_bot_execution_errors_bot_id 
ON bot_execution_errors(bot_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_execution_errors_exchange 
ON bot_execution_errors(exchange, error_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_execution_errors_recent 
ON bot_execution_errors(occurred_at DESC)
WHERE occurred_at > NOW() - INTERVAL '7 days';

-- 7. Create view for Bitunix bot status
CREATE OR REPLACE VIEW bitunix_bots_status AS
SELECT 
    b.id,
    b.name,
    b.symbol,
    b.status,
    b.trading_type,
    b.exchange,
    b.risk_level,
    b.paper_trading,
    COUNT(DISTINCT t.id) as total_trades,
    COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as closed_trades,
    COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.pnl ELSE 0 END), 0) as total_pnl,
    COUNT(DISTINCT CASE WHEN bee.error_type = 'price_fetch' THEN bee.id END) as price_fetch_errors,
    COUNT(DISTINCT CASE WHEN bee.error_type = 'order_placement' THEN bee.id END) as order_errors,
    MAX(bee.occurred_at) as last_error_at,
    b.created_at,
    b.updated_at
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
LEFT JOIN bot_execution_errors bee ON bee.bot_id = b.id 
    AND bee.occurred_at > NOW() - INTERVAL '24 hours'
WHERE b.exchange = 'bitunix'
GROUP BY b.id, b.name, b.symbol, b.status, b.trading_type, b.exchange, 
         b.risk_level, b.paper_trading, b.created_at, b.updated_at;

-- 8. Grant permissions (adjust as needed for your RLS policies)
-- ALTER TABLE bot_executor_versions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bot_execution_errors ENABLE ROW LEVEL SECURITY;

-- 9. Create function to clean old error logs (optional, run periodically)
CREATE OR REPLACE FUNCTION clean_old_bot_execution_errors(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM bot_execution_errors
    WHERE occurred_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. Summary query to check Bitunix bots status
SELECT 
    'Bitunix Bots Summary' as report_type,
    COUNT(*) as total_bots,
    COUNT(CASE WHEN status = 'running' THEN 1 END) as running_bots,
    COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_bots,
    COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_bots,
    COUNT(CASE WHEN paper_trading = true THEN 1 END) as paper_trading_bots,
    COUNT(CASE WHEN trading_type = 'futures' THEN 1 END) as futures_bots,
    COUNT(CASE WHEN trading_type = 'spot' THEN 1 END) as spot_bots
FROM trading_bots
WHERE exchange = 'bitunix';

-- =====================================================
-- USAGE NOTES:
-- =====================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Check the summary at the end to see Bitunix bot status
-- 3. Use the view 'bitunix_bots_status' to monitor bot health
-- 4. Check 'bot_executor_versions' to track deployments
-- 5. Monitor 'bot_execution_errors' for troubleshooting
-- =====================================================

