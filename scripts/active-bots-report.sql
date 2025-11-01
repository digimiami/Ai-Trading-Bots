-- ============================================
-- ACTIVE BOTS COMPREHENSIVE REPORT
-- Pablo AI Trading Bot - Active Bots Analysis
-- Generated: Now
-- ============================================

-- ============================================
-- 1. OVERVIEW SUMMARY
-- ============================================
SELECT 
    'OVERVIEW SUMMARY' as section,
    COUNT(*) as total_bots,
    COUNT(CASE WHEN status = 'running' THEN 1 END) as running_bots,
    COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_bots,
    COUNT(CASE WHEN status = 'stopped' THEN 1 END) as stopped_bots,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl,
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2) as avg_pnl_per_bot,
    ROUND(SUM(COALESCE(total_trades, 0))::numeric, 0) as total_trades_all_bots,
    ROUND(AVG(COALESCE(win_rate, 0))::numeric, 2) as avg_win_rate,
    ROUND(SUM(COALESCE(pnl_percentage, 0))::numeric, 2) as total_pnl_percentage
FROM trading_bots;

-- ============================================
-- 2. ACTIVE/RUNNING BOTS DETAILED LIST
-- ============================================
SELECT 
    'ACTIVE BOTS DETAILS' as section,
    id,
    name,
    exchange,
    trading_type,
    symbol,
    timeframe,
    status,
    leverage,
    risk_level,
    trade_amount,
    stop_loss,
    take_profit,
    COALESCE(total_trades, 0) as total_trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate_pct,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl_usd,
    ROUND(COALESCE(pnl_percentage, 0)::numeric, 2) as pnl_percentage,
    last_trade_at,
    created_at,
    updated_at,
    -- Strategy Config Info
    CASE 
        WHEN strategy_config IS NOT NULL THEN 
            COALESCE((strategy_config->>'max_trades_per_day')::text, 'N/A')
        ELSE 'N/A'
    END as max_trades_per_day,
    CASE 
        WHEN strategy_config IS NOT NULL THEN 
            COALESCE((strategy_config->>'cooldown_bars')::text, 'N/A')
        ELSE 'N/A'
    END as cooldown_bars,
    CASE 
        WHEN strategy_config IS NOT NULL THEN 
            CASE 
                WHEN (strategy_config->>'session_filter_enabled')::boolean THEN 'Enabled'
                ELSE 'Disabled'
            END
        ELSE 'N/A'
    END as session_filter
FROM trading_bots
WHERE status IN ('running', 'active')
ORDER BY 
    CASE 
        WHEN status = 'running' THEN 1
        WHEN status = 'active' THEN 2
        ELSE 3
    END,
    COALESCE(pnl, 0) DESC;

-- ============================================
-- 3. PERFORMANCE RANKING (Top & Bottom)
-- ============================================
-- Top 5 Performers
SELECT 
    'TOP PERFORMERS' as section,
    name,
    symbol,
    exchange,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl_usd,
    ROUND(COALESCE(pnl_percentage, 0)::numeric, 2) as pnl_pct,
    COALESCE(total_trades, 0) as trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate_pct,
    last_trade_at
FROM trading_bots
WHERE status IN ('running', 'active')
ORDER BY COALESCE(pnl, 0) DESC
LIMIT 5;

-- Worst 5 Performers
SELECT 
    'WORST PERFORMERS' as section,
    name,
    symbol,
    exchange,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl_usd,
    ROUND(COALESCE(pnl_percentage, 0)::numeric, 2) as pnl_pct,
    COALESCE(total_trades, 0) as trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate_pct,
    last_trade_at
FROM trading_bots
WHERE status IN ('running', 'active')
ORDER BY COALESCE(pnl, 0) ASC
LIMIT 5;

-- ============================================
-- 4. TRADE ACTIVITY (24 HOURS)
-- ============================================
SELECT 
    '24H TRADE ACTIVITY' as section,
    b.name as bot_name,
    b.symbol,
    b.exchange,
    COUNT(t.id) as trades_24h,
    SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END) as filled_trades,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_trades,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_trades,
    ROUND(SUM(CASE WHEN t.status = 'filled' THEN COALESCE(t.amount, 0) ELSE 0 END)::numeric, 4) as volume_24h,
    ROUND(SUM(CASE WHEN t.status = 'filled' THEN COALESCE(t.pnl, 0) ELSE 0 END)::numeric, 2) as pnl_24h,
    MAX(t.created_at) as last_trade_time
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.created_at >= NOW() - INTERVAL '24 hours'
WHERE b.status IN ('running', 'active')
GROUP BY b.id, b.name, b.symbol, b.exchange
ORDER BY trades_24h DESC, last_trade_time DESC NULLS LAST;

-- ============================================
-- 5. RISK SUMMARY BY BOT
-- ============================================
SELECT 
    'RISK SUMMARY' as section,
    name,
    symbol,
    exchange,
    trade_amount,
    leverage,
    ROUND(trade_amount * leverage * 1.5, 2) as max_order_value,
    ROUND(trade_amount * leverage * 1.5 * (stop_loss / 100), 2) as max_loss_per_trade,
    risk_level,
    CASE 
        WHEN strategy_config IS NOT NULL THEN 
            COALESCE((strategy_config->>'max_trades_per_day')::text, 'N/A')
        ELSE 'N/A'
    END as max_trades_per_day,
    COALESCE(total_trades, 0) as current_trades,
    last_trade_at
FROM trading_bots
WHERE status IN ('running', 'active')
ORDER BY max_order_value DESC;

-- ============================================
-- 6. ACCOUNT BALANCE REQUIREMENTS
-- ============================================
SELECT 
    'BALANCE REQUIREMENTS' as section,
    'Minimum USDT Needed' as requirement,
    ROUND(SUM(trade_amount * leverage * 1.5)::numeric, 2) as total_required_usdt,
    'Recommended with 30% Buffer' as recommendation,
    ROUND(SUM(trade_amount * leverage * 1.5) * 1.3, 2) as recommended_balance_usdt,
    COUNT(*) as active_bots_count,
    'Covers all active bots maximum positions' as note
FROM trading_bots
WHERE status IN ('running', 'active');

-- ============================================
-- 7. RECENT TRADES (Last 10)
-- ============================================
SELECT 
    'RECENT TRADES' as section,
    t.id as trade_id,
    t.created_at,
    b.name as bot_name,
    b.symbol,
    t.exchange,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    ROUND(COALESCE(t.pnl, 0)::numeric, 2) as pnl,
    t.status,
    t.executed_at,
    t.exchange_order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE b.status IN ('running', 'active')
ORDER BY t.created_at DESC
LIMIT 10;

-- ============================================
-- 8. BOTS WITH NO RECENT ACTIVITY (Warnings)
-- ============================================
SELECT 
    'INACTIVE WARNING' as section,
    name,
    symbol,
    exchange,
    status,
    last_trade_at,
    CASE 
        WHEN last_trade_at IS NULL THEN 'Never traded'
        WHEN last_trade_at < NOW() - INTERVAL '24 hours' THEN 'No trades in 24h'
        WHEN last_trade_at < NOW() - INTERVAL '12 hours' THEN 'No trades in 12h'
        ELSE 'Recently active'
    END as activity_status,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(last_trade_at, created_at))) / 3600 as hours_since_last_trade
FROM trading_bots
WHERE status IN ('running', 'active')
    AND (
        last_trade_at IS NULL 
        OR last_trade_at < NOW() - INTERVAL '12 hours'
    )
ORDER BY COALESCE(last_trade_at, created_at) ASC;

-- ============================================
-- 9. STRATEGY CONFIGURATION SUMMARY
-- ============================================
SELECT 
    'STRATEGY CONFIG' as section,
    name,
    symbol,
    COALESCE((strategy_config->>'max_trades_per_day')::text, 'Not Set') as max_trades_per_day,
    COALESCE((strategy_config->>'cooldown_bars')::text, 'Not Set') as cooldown_bars,
    CASE 
        WHEN (strategy_config->>'session_filter_enabled')::boolean THEN 'Yes'
        ELSE 'No'
    END as session_filter_enabled,
    CASE 
        WHEN strategy_config->>'allowed_hours_utc' IS NOT NULL THEN 
            'Set (' || jsonb_array_length(strategy_config->'allowed_hours_utc') || ' hours)'
        ELSE 'Not Set'
    END as allowed_hours,
    COALESCE((strategy_config->>'risk_per_trade_pct')::text, 'Not Set') as risk_per_trade_pct,
    COALESCE((strategy_config->>'max_concurrent')::text, 'Not Set') as max_concurrent
FROM trading_bots
WHERE status IN ('running', 'active')
ORDER BY name;

-- ============================================
-- 10. EXCHANGE SUMMARY
-- ============================================
SELECT 
    'EXCHANGE SUMMARY' as section,
    exchange,
    COUNT(*) as bot_count,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl,
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2) as avg_pnl,
    ROUND(SUM(COALESCE(total_trades, 0))::numeric, 0) as total_trades,
    ROUND(AVG(COALESCE(win_rate, 0))::numeric, 2) as avg_win_rate
FROM trading_bots
WHERE status IN ('running', 'active')
GROUP BY exchange
ORDER BY bot_count DESC;

-- ============================================
-- 11. CONTRACT PERFORMANCE SUMMARY (P&L & FEES)
-- ============================================
-- Calculate fees from trade volume if not stored in database
-- Bybit: Spot 0.1%, Futures 0.055%
-- OKX: Spot 0.08%, Futures 0.05%
SELECT 
    'CONTRACT PERFORMANCE' as section,
    b.symbol as contract,
    b.name as bot_name,
    b.exchange,
    b.trading_type,
    b.status,
    COUNT(t.id) as total_trades,
    ROUND(SUM(COALESCE(t.pnl, 0))::numeric, 2) as total_net_pnl,
    ROUND(
        SUM(
            COALESCE(t.fee, 0) + 
            CASE 
                -- Calculate fee if not stored: volume * fee_rate
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055) -- 0.055%
                                ELSE (t.amount * t.price * 0.001) -- 0.1% spot
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005) -- 0.05%
                                ELSE (t.amount * t.price * 0.0008) -- 0.08% spot
                            END
                        ELSE (t.amount * t.price * 0.001) -- Default 0.1%
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as total_fees_paid,
    ROUND(
        SUM(COALESCE(t.pnl, 0))::numeric - 
        SUM(
            COALESCE(t.fee, 0) + 
            CASE 
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055)
                                ELSE (t.amount * t.price * 0.001)
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005)
                                ELSE (t.amount * t.price * 0.0008)
                            END
                        ELSE (t.amount * t.price * 0.001)
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as net_profit_loss,
    ROUND(AVG(COALESCE(t.pnl, 0))::numeric, 2) as avg_pnl_per_trade,
    ROUND(
        AVG(
            COALESCE(t.fee, 0) + 
            CASE 
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055)
                                ELSE (t.amount * t.price * 0.001)
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005)
                                ELSE (t.amount * t.price * 0.0008)
                            END
                        ELSE (t.amount * t.price * 0.001)
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as avg_fee_per_trade,
    MAX(t.created_at) as last_trade_at
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
GROUP BY b.id, b.name, b.symbol, b.exchange, b.trading_type, b.status
ORDER BY net_profit_loss DESC NULLS LAST;

-- ============================================
-- 12. AGGREGATE CONTRACT SUMMARY (All Contracts - Active & Inactive Bots)
-- ============================================
SELECT 
    'AGGREGATE CONTRACT SUMMARY' as section,
    b.symbol as contract,
    b.exchange,
    COUNT(DISTINCT b.id) as bot_count,
    COUNT(DISTINCT CASE WHEN b.status IN ('running', 'active') THEN b.id END) as active_bot_count,
    COUNT(DISTINCT CASE WHEN b.status NOT IN ('running', 'active') THEN b.id END) as inactive_bot_count,
    COUNT(t.id) as total_trades,
    ROUND(SUM(COALESCE(t.pnl, 0))::numeric, 2) as total_net_pnl,
    ROUND(
        SUM(
            COALESCE(t.fee, 0) + 
            CASE 
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055)
                                ELSE (t.amount * t.price * 0.001)
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005)
                                ELSE (t.amount * t.price * 0.0008)
                            END
                        ELSE (t.amount * t.price * 0.001)
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as total_fees_paid,
    ROUND(
        SUM(COALESCE(t.pnl, 0))::numeric - 
        SUM(
            COALESCE(t.fee, 0) + 
            CASE 
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055)
                                ELSE (t.amount * t.price * 0.001)
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005)
                                ELSE (t.amount * t.price * 0.0008)
                            END
                        ELSE (t.amount * t.price * 0.001)
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as net_profit_loss,
    ROUND(AVG(COALESCE(t.pnl, 0))::numeric, 2) as avg_pnl_per_trade,
    ROUND(
        AVG(
            COALESCE(t.fee, 0) + 
            CASE 
                WHEN COALESCE(t.fee, 0) = 0 AND t.amount IS NOT NULL AND t.price IS NOT NULL THEN
                    CASE 
                        WHEN b.exchange = 'bybit' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.00055)
                                ELSE (t.amount * t.price * 0.001)
                            END
                        WHEN b.exchange = 'okx' THEN
                            CASE 
                                WHEN b.trading_type = 'futures' THEN (t.amount * t.price * 0.0005)
                                ELSE (t.amount * t.price * 0.0008)
                            END
                        ELSE (t.amount * t.price * 0.001)
                    END
                ELSE COALESCE(t.fee, 0)
            END
        )::numeric, 2
    ) as avg_fee_per_trade,
    MAX(t.created_at) as last_trade_at
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
GROUP BY b.symbol, b.exchange
ORDER BY net_profit_loss DESC NULLS LAST;

-- ============================================
-- END OF REPORT
-- ============================================

