-- QUICK FIX SCRIPT - Run this immediately to stop the errors
-- This will dramatically reduce trade amounts and pause problematic bots

-- ============================================
-- EMERGENCY FIX: Reduce all trade amounts to $5-10
-- ============================================
UPDATE trading_bots 
SET 
    trade_amount = 10.00,  -- Reduce to $10 per trade
    leverage = 2,          -- Reduce leverage to 2x
    updated_at = NOW()
WHERE status = 'active';

-- ============================================
-- PAUSE ALL OKX BOTS (API issues)
-- ============================================
UPDATE trading_bots 
SET 
    status = 'paused',
    updated_at = NOW()
WHERE exchange = 'okx';

-- ============================================
-- PAUSE HIGH-RISK BOTS TEMPORARILY
-- ============================================
UPDATE trading_bots 
SET 
    status = 'paused',
    updated_at = NOW()
WHERE symbol IN ('BTCUSDT', 'ETHUSDT', 'SOLUSDT') 
AND status = 'active';

-- ============================================
-- VERIFY THE FIXES
-- ============================================
SELECT 
    'EMERGENCY FIX APPLIED' as status,
    COUNT(*) as total_bots,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bots,
    COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_bots,
    ROUND(AVG(trade_amount), 2) as avg_trade_amount,
    ROUND(SUM(trade_amount * leverage * 1.5), 2) as total_required_usdt
FROM trading_bots;

-- Show the new, safer configuration
SELECT 
    'NEW SAFE CONFIGURATION' as info,
    name,
    symbol,
    exchange,
    trade_amount,
    leverage,
    ROUND(trade_amount * leverage * 1.5, 2) as max_order_value,
    status
FROM trading_bots 
WHERE status = 'active'
ORDER BY symbol;
