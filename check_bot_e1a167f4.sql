-- =====================================================
-- BOT CONFIGURATION CHECK
-- Bot ID: e1a167f4-e7c8-4b60-9b42-86e6e5bb4874
-- =====================================================

-- Check current bot settings
SELECT 
    id,
    name,
    symbol,
    exchange,
    trading_type,
    status,
    trade_amount,
    leverage,
    risk_level,
    stop_loss,
    take_profit,
    pnl,
    pnl_percentage,
    total_trades,
    win_rate,
    last_trade_at,
    created_at,
    updated_at
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- =====================================================
-- CHECK ADVANCED STRATEGY CONFIGURATION
-- =====================================================

SELECT 
    id,
    name,
    symbol,
    -- Risk Management
    strategy_config->>'max_consecutive_losses' as max_consecutive_losses,
    strategy_config->>'daily_loss_limit_pct' as daily_loss_limit_pct,
    strategy_config->>'weekly_loss_limit_pct' as weekly_loss_limit_pct,
    strategy_config->>'max_trades_per_day' as max_trades_per_day,
    strategy_config->>'max_concurrent' as max_concurrent,
    strategy_config->>'risk_per_trade_pct' as risk_per_trade_pct,
    
    -- Stop Loss & Take Profit
    strategy_config->>'sl_atr_mult' as sl_atr_mult,
    strategy_config->>'tp1_r' as tp1_r,
    strategy_config->>'tp2_r' as tp2_r,
    strategy_config->>'tp1_size' as tp1_size,
    
    -- Trailing & Time Management
    strategy_config->>'breakeven_at_r' as breakeven_at_r,
    strategy_config->>'trail_after_tp1_atr' as trail_after_tp1_atr,
    strategy_config->>'time_stop_hours' as time_stop_hours,
    
    -- Volatility Filters
    strategy_config->>'atr_percentile_min' as atr_percentile_min,
    strategy_config->>'bb_width_min' as bb_width_min,
    strategy_config->>'bb_width_max' as bb_width_max,
    
    -- Liquidity Filters
    strategy_config->>'min_24h_volume_usd' as min_24h_volume_usd,
    strategy_config->>'max_spread_bps' as max_spread_bps,
    
    -- Regime & Bias
    strategy_config->>'regime_mode' as regime_mode,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'adx_meanrev_max' as adx_meanrev_max,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'require_adx_rising' as require_adx_rising,
    strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
    
    -- Cooldown
    strategy_config->>'cooldown_bars' as cooldown_bars,
    
    -- Smart Exit
    strategy_config->>'enable_dynamic_trailing' as enable_dynamic_trailing,
    strategy_config->>'smart_exit_enabled' as smart_exit_enabled,
    strategy_config->>'smart_exit_retracement_pct' as smart_exit_retracement_pct,
    
    -- Full config (for debugging)
    strategy_config::text as full_strategy_config
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- =====================================================
-- CHECK RECENT TRADES (Last 30 days)
-- =====================================================

SELECT 
    COUNT(*) as total_trades,
    COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
    COUNT(CASE WHEN pnl = 0 OR pnl IS NULL THEN 1 END) as breakeven_trades,
    ROUND(COUNT(CASE WHEN pnl > 0 THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN pnl IS NOT NULL THEN 1 END), 0) * 100, 2) as win_rate_pct,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl,
    ROUND(AVG(CASE WHEN pnl > 0 THEN pnl END)::numeric, 2) as avg_win,
    ROUND(AVG(CASE WHEN pnl < 0 THEN pnl END)::numeric, 2) as avg_loss,
    ROUND(ABS(AVG(CASE WHEN pnl > 0 THEN pnl END)::numeric / NULLIF(AVG(CASE WHEN pnl < 0 THEN pnl END)::numeric, 0)), 2) as profit_factor,
    MIN(COALESCE(executed_at, created_at)) as first_trade,
    MAX(COALESCE(executed_at, created_at)) as last_trade
FROM trades
WHERE bot_id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874'
  AND COALESCE(executed_at, created_at) >= NOW() - INTERVAL '30 days';

-- =====================================================
-- CHECK RECENT TRADES DETAILS (Last 10 trades)
-- =====================================================

SELECT 
    id,
    symbol,
    side,
    price,
    amount,
    pnl,
    fee,
    status,
    executed_at,
    exchange_order_id,
    created_at,
    updated_at
FROM trades
WHERE bot_id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874'
ORDER BY COALESCE(executed_at, created_at) DESC
LIMIT 10;

-- =====================================================
-- CHECK FOR POTENTIAL ISSUES
-- =====================================================

-- Check if bot is running
SELECT 
    CASE 
        WHEN status = 'running' THEN '✅ Bot is running'
        WHEN status = 'paused' THEN '⚠️ Bot is paused'
        WHEN status = 'stopped' THEN '❌ Bot is stopped'
        ELSE '❓ Unknown status: ' || status
    END as status_check
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- Check for high leverage
SELECT 
    CASE 
        WHEN leverage > 5 THEN '⚠️ HIGH LEVERAGE: ' || leverage || 'x (Consider reducing to 2-3x)'
        WHEN leverage > 3 THEN '⚠️ Moderate leverage: ' || leverage || 'x'
        ELSE '✅ Safe leverage: ' || leverage || 'x'
    END as leverage_check
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- Check for high trade amount
SELECT 
    CASE 
        WHEN trade_amount > 100 THEN '⚠️ HIGH TRADE AMOUNT: $' || trade_amount || ' (Consider reducing to $30-50)'
        WHEN trade_amount > 50 THEN '⚠️ Moderate trade amount: $' || trade_amount
        ELSE '✅ Safe trade amount: $' || trade_amount
    END as trade_amount_check
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- Check for missing risk management
SELECT 
    CASE 
        WHEN (strategy_config->>'max_consecutive_losses') IS NULL THEN '❌ Missing: max_consecutive_losses'
        WHEN (strategy_config->>'daily_loss_limit_pct') IS NULL THEN '❌ Missing: daily_loss_limit_pct'
        WHEN (strategy_config->>'max_trades_per_day') IS NULL THEN '❌ Missing: max_trades_per_day'
        WHEN (strategy_config->>'max_concurrent') IS NULL THEN '❌ Missing: max_concurrent'
        ELSE '✅ Risk management settings present'
    END as risk_management_check
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

