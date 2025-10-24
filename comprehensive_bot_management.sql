-- Comprehensive Bot Management Script
-- This script will help you manage all aspects of your trading bots

-- ============================================
-- 1. CURRENT BOT STATUS OVERVIEW
-- ============================================
SELECT 
    'CURRENT BOT STATUS' as section,
    exchange,
    COUNT(*) as total_bots,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bots,
    COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_bots,
    COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_bots,
    ROUND(AVG(trade_amount), 2) as avg_trade_amount,
    ROUND(SUM(trade_amount * leverage * 1.5), 2) as total_required_usdt
FROM trading_bots 
GROUP BY exchange
ORDER BY exchange;

-- ============================================
-- 2. TRADE AMOUNT OPTIMIZATION
-- ============================================
-- Update trade amounts based on symbol volatility and value
UPDATE trading_bots 
SET 
    trade_amount = CASE 
        -- High-value, volatile pairs - conservative amounts
        WHEN symbol IN ('BTCUSDT', 'ETHUSDT') THEN 15.00
        -- Medium-value pairs - moderate amounts
        WHEN symbol IN ('BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT') THEN 20.00
        -- Lower-value pairs - slightly higher amounts
        WHEN symbol IN ('XRPUSDT', 'MATICUSDT', 'UNIUSDT', 'AVAXUSDT') THEN 25.00
        -- Default for any other pairs
        ELSE 20.00
    END,
    updated_at = NOW()
WHERE status = 'active';

-- ============================================
-- 3. LEVERAGE OPTIMIZATION
-- ============================================
-- Reduce leverage for high-risk pairs
UPDATE trading_bots 
SET 
    leverage = CASE 
        -- High-volatility pairs - lower leverage
        WHEN symbol IN ('BTCUSDT', 'ETHUSDT', 'SOLUSDT') THEN 3
        -- Medium-volatility pairs - moderate leverage
        WHEN symbol IN ('BNBUSDT', 'ADAUSDT', 'DOTUSDT') THEN 4
        -- Lower-volatility pairs - higher leverage
        WHEN symbol IN ('XRPUSDT', 'MATICUSDT', 'UNIUSDT', 'AVAXUSDT') THEN 5
        -- Default leverage
        ELSE 3
    END,
    updated_at = NOW()
WHERE status = 'active';

-- ============================================
-- 4. RISK MANAGEMENT SETTINGS
-- ============================================
-- Update stop loss and take profit for better risk management
UPDATE trading_bots 
SET 
    stop_loss = CASE 
        -- High-volatility pairs - wider stops
        WHEN symbol IN ('BTCUSDT', 'ETHUSDT', 'SOLUSDT') THEN 3.0
        -- Medium-volatility pairs - moderate stops
        WHEN symbol IN ('BNBUSDT', 'ADAUSDT', 'DOTUSDT') THEN 2.5
        -- Lower-volatility pairs - tighter stops
        WHEN symbol IN ('XRPUSDT', 'MATICUSDT', 'UNIUSDT', 'AVAXUSDT') THEN 2.0
        -- Default stop loss
        ELSE 2.5
    END,
    take_profit = CASE 
        -- High-volatility pairs - higher targets
        WHEN symbol IN ('BTCUSDT', 'ETHUSDT', 'SOLUSDT') THEN 6.0
        -- Medium-volatility pairs - moderate targets
        WHEN symbol IN ('BNBUSDT', 'ADAUSDT', 'DOTUSDT') THEN 5.0
        -- Lower-volatility pairs - lower targets
        WHEN symbol IN ('XRPUSDT', 'MATICUSDT', 'UNIUSDT', 'AVAXUSDT') THEN 4.0
        -- Default take profit
        ELSE 5.0
    END,
    updated_at = NOW()
WHERE status = 'active';

-- ============================================
-- 5. FINAL OPTIMIZED CONFIGURATION
-- ============================================
SELECT 
    'OPTIMIZED BOT CONFIGURATION' as section,
    name,
    symbol,
    exchange,
    trade_amount,
    leverage,
    stop_loss,
    take_profit,
    ROUND(trade_amount * leverage * 1.5, 2) as max_order_value,
    ROUND(trade_amount * leverage * 1.5 * 0.02, 2) as max_loss_per_trade,
    ROUND(trade_amount * leverage * 1.5 * 0.05, 2) as max_profit_per_trade,
    status
FROM trading_bots 
WHERE status = 'active'
ORDER BY max_order_value DESC;

-- ============================================
-- 6. ACCOUNT BALANCE REQUIREMENTS
-- ============================================
SELECT 
    'ACCOUNT BALANCE REQUIREMENTS' as section,
    'Minimum USDT needed' as requirement,
    ROUND(SUM(trade_amount * leverage * 1.5), 2) as usdt_needed,
    'Recommended with 30% buffer' as recommendation,
    ROUND(SUM(trade_amount * leverage * 1.5) * 1.3, 2) as recommended_balance,
    'This covers all active bots' as note
FROM trading_bots 
WHERE status = 'active';

-- ============================================
-- 7. PERFORMANCE SUMMARY
-- ============================================
SELECT 
    'PERFORMANCE SUMMARY' as section,
    COUNT(*) as total_bots,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bots,
    ROUND(AVG(win_rate), 2) as avg_win_rate,
    ROUND(SUM(pnl), 2) as total_pnl,
    ROUND(AVG(pnl_percentage), 2) as avg_pnl_percentage,
    MAX(last_trade_at) as last_trade_time
FROM trading_bots;
