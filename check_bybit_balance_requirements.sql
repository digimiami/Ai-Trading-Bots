-- Check Bybit account balance and trading limits
-- This will help you understand your available funds

-- First, let's check what bots are trying to trade and their requirements
SELECT 
    'BOT REQUIREMENTS' as info_type,
    COUNT(*) as total_active_bots,
    SUM(trade_amount * leverage * 1.5) as total_required_usdt,
    AVG(trade_amount * leverage * 1.5) as avg_order_value,
    MAX(trade_amount * leverage * 1.5) as max_order_value,
    MIN(trade_amount * leverage * 1.5) as min_order_value
FROM trading_bots 
WHERE status = 'active';

-- Show individual bot requirements
SELECT 
    'INDIVIDUAL BOT REQUIREMENTS' as info_type,
    name,
    symbol,
    trade_amount,
    leverage,
    ROUND(trade_amount * leverage * 1.5, 2) as required_usdt_per_trade,
    trading_type,
    status
FROM trading_bots 
WHERE status = 'active'
ORDER BY required_usdt_per_trade DESC;

-- Check recent trade attempts and their values
SELECT 
    'RECENT TRADE ATTEMPTS' as info_type,
    symbol,
    amount,
    price,
    ROUND(amount * price, 2) as order_value,
    status,
    executed_at
FROM trades 
WHERE executed_at >= NOW() - INTERVAL '1 hour'
ORDER BY executed_at DESC
LIMIT 10;

-- Summary of what you need in your Bybit account
SELECT 
    'ACCOUNT REQUIREMENTS SUMMARY' as info_type,
    'Minimum USDT needed for all active bots' as requirement,
    ROUND(SUM(trade_amount * leverage * 1.5), 2) as usdt_needed,
    'Recommended: Add 20% buffer' as recommendation,
    ROUND(SUM(trade_amount * leverage * 1.5) * 1.2, 2) as recommended_balance
FROM trading_bots 
WHERE status = 'active';
