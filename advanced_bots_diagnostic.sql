-- ============================================
-- ADVANCED BOTS DIAGNOSTIC - Check Why Not Trading
-- Pablo AI Trading Bot - Advanced Bot Analysis
-- ============================================

-- 1. CHECK SPECIFIC ADVANCED BOTS STATUS
SELECT 
    'ADVANCED BOTS STATUS' as section,
    name as bot_name,
    exchange,
    symbol,
    status,
    trading_type,
    leverage,
    risk_level,
    total_trades,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate,
    last_trade_at,
    created_at,
    updated_at
FROM trading_bots
WHERE name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
ORDER BY name;

-- ============================================
-- 2. CHECK RECENT TRADES FOR THESE BOTS
SELECT 
    'RECENT TRADES' as section,
    t.id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    ROUND(COALESCE(t.pnl, 0)::numeric, 2) as pnl,
    t.status,
    t.exchange_order_id,
    t.error_message
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE b.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
ORDER BY t.created_at DESC
LIMIT 20;

-- ============================================
-- 3. CHECK BOT STRATEGIES AND CONFIGURATION
SELECT 
    'BOT STRATEGIES' as section,
    name as bot_name,
    strategy,
    trading_type,
    leverage,
    risk_level
FROM trading_bots
WHERE name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
);

-- ============================================
-- 4. CHECK API KEYS STATUS FOR THESE BOTS
SELECT 
    'API KEYS STATUS' as section,
    ak.exchange,
    ak.is_active,
    ak.is_testnet,
    ak.created_at,
    COUNT(tb.id) as bots_using_exchange
FROM api_keys ak
LEFT JOIN trading_bots tb ON ak.exchange = tb.exchange
WHERE tb.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
GROUP BY ak.exchange, ak.is_active, ak.is_testnet, ak.created_at;

-- ============================================
-- 5. CHECK BOT ACTIVITY LOGS FOR ERRORS
SELECT 
    'BOT LOGS' as section,
    bal.bot_id,
    b.name as bot_name,
    bal.level,
    bal.category,
    bal.message,
    bal.created_at
FROM bot_activity_logs bal
LEFT JOIN trading_bots b ON bal.bot_id = b.id
WHERE b.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
AND bal.level IN ('error', 'warning')
ORDER BY bal.created_at DESC
LIMIT 20;

-- ============================================
-- 6. CHECK FAILED TRADES WITH ERROR MESSAGES
SELECT 
    'FAILED TRADES' as section,
    t.id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    t.status,
    t.error_message,
    t.exchange_order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE b.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
AND t.status = 'failed'
ORDER BY t.created_at DESC
LIMIT 10;

-- ============================================
-- 7. CHECK MARKET DATA AVAILABILITY
SELECT 
    'MARKET DATA CHECK' as section,
    'BTCUSDT' as symbol,
    'bybit' as exchange,
    'Check if market data is available for BTC' as note
UNION ALL
SELECT 
    'MARKET DATA CHECK',
    'ETHUSDT',
    'bybit', 
    'Check if market data is available for ETH'
UNION ALL
SELECT 
    'MARKET DATA CHECK',
    'SOLUSDT',
    'bybit',
    'Check if market data is available for SOL'
UNION ALL
SELECT 
    'MARKET DATA CHECK',
    'BNBUSDT',
    'bybit',
    'Check if market data is available for BNB';

-- ============================================
-- 8. CHECK BOT EXECUTION FREQUENCY
SELECT 
    'EXECUTION FREQUENCY' as section,
    b.name as bot_name,
    COUNT(t.id) as total_trades,
    MIN(t.created_at) as first_trade,
    MAX(t.created_at) as last_trade,
    CASE 
        WHEN MAX(t.created_at) IS NULL THEN 'NEVER TRADED'
        WHEN MAX(t.created_at) < NOW() - INTERVAL '1 hour' THEN 'NOT TRADING RECENTLY'
        ELSE 'TRADING RECENTLY'
    END as trading_status
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
WHERE b.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
GROUP BY b.id, b.name
ORDER BY b.name;

-- ============================================
-- 9. CHECK BALANCE REQUIREMENTS
SELECT 
    'BALANCE CHECK' as section,
    'Check if sufficient USDT balance for trading' as note,
    'Minimum required: $10 per trade' as requirement,
    'Check Bybit account balance' as action;

-- ============================================
-- 10. SUMMARY DIAGNOSTIC
SELECT 
    'DIAGNOSTIC SUMMARY' as section,
    'Run this query to get complete picture of why advanced bots are not trading' as note,
    'Check: 1) Bot status, 2) API keys, 3) Recent trades, 4) Error logs, 5) Market data' as checklist;

