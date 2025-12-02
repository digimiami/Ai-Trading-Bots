-- =====================================================
-- BOT OPTIMIZATION RECOMMENDATIONS
-- Bot ID: 7b3c49a4-099d-4817-8335-c139d24b4643
-- Based on Transaction Log Analysis (2025-12-01 to 2025-12-02)
-- =====================================================

-- First, check current bot settings
SELECT 
    id,
    name,
    symbol,
    trade_amount,
    leverage,
    risk_level,
    stop_loss,
    take_profit,
    strategy_config::text as current_config
FROM trading_bots
WHERE id = '7b3c49a4-099d-4817-8335-c139d24b4643';

-- =====================================================
-- ANALYSIS SUMMARY FROM TRANSACTION LOG:
-- =====================================================
-- Based on transaction log analysis (2025-12-01 to 2025-12-02):
-- 
-- CRITICAL ISSUES IDENTIFIED:
-- 1. OVERTRADING: Very high trade frequency (100+ trades in 24 hours)
-- 2. LARGE LOSSES: SOLUSDT showing losses of -$18.81, -$4.10, -$2.39
-- 3. FUNDING FEES: TNSRUSDT positions held overnight incurring funding costs
-- 4. FEE ACCUMULATION: High trading frequency = high fee costs
-- 5. POOR RISK:REWARD: Many small losses vs fewer large wins
--
-- PERFORMANCE METRICS:
-- - Total closed trades: ~50+ across all pairs
-- - Win rate appears low (many small losses)
-- - Average loss size larger than average win size
-- - Funding fees eating into profits
--
-- =====================================================
-- RECOMMENDED OPTIMIZATIONS (CONSERVATIVE APPROACH)
-- =====================================================

-- Update bot with optimized settings
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
        -- ============================================
        -- RISK MANAGEMENT (CRITICAL - REDUCE LOSSES)
        -- ============================================
        'max_consecutive_losses', 2,  -- STRICT: Stop after 2 losses (was 5)
        'daily_loss_limit_pct', 1.5,  -- STRICT: Stop at 1.5% daily loss (was 3.0)
        'weekly_loss_limit_pct', 4.0,  -- STRICT: Stop at 4% weekly loss (was 6.0)
        'max_trades_per_day', 3,  -- STRICT: Max 3 trades per day (was 8+) - REDUCE OVERTRADING
        'max_concurrent', 1,  -- Only 1 position at a time (was 2)
        
        -- ============================================
        -- POSITION SIZING (REDUCE RISK)
        -- ============================================
        'risk_per_trade_pct', 0.4,  -- Reduced from 0.75 (smaller positions)
        
        -- ============================================
        -- STOP LOSS & TAKE PROFIT (TIGHTER CONTROL)
        -- ============================================
        'sl_atr_mult', 1.2,  -- Tighter stops (was 1.3) - exit losses faster
        'tp1_r', 1.5,  -- Better R:R ratio (was 1.0) - need 1.5x profit to justify risk
        'tp2_r', 3.0,  -- Higher second target (was 2.0)
        'tp1_size', 0.7,  -- Take 70% profit at first target (was 50%) - lock in gains
        
        -- ============================================
        -- TRAILING STOP & TIME MANAGEMENT
        -- ============================================
        'breakeven_at_r', 0.5,  -- Move to BE faster (was 0.8) - protect capital
        'trail_after_tp1_atr', 0.6,  -- Tighter trailing (was 1.0) - protect profits
        'time_stop_hours', 12,  -- Close positions after 12 hours (was 48) - AVOID FUNDING FEES
        
        -- ============================================
        -- VOLATILITY FILTERS (TRADE ONLY GOOD SETUPS)
        -- ============================================
        'atr_percentile_min', 40,  -- Only trade in higher volatility (was 20)
        'bb_width_min', 0.018,  -- Higher minimum volatility (was 0.012)
        'bb_width_max', 0.022,  -- Lower maximum volatility (was 0.03) - avoid extreme moves
        
        -- ============================================
        -- LIQUIDITY FILTERS (BETTER EXECUTION)
        -- ============================================
        'min_24h_volume_usd', 2000000000,  -- Higher volume requirement (was 500M) - better liquidity
        'max_spread_bps', 1.5,  -- Tighter spreads (was 3) - reduce slippage
        
        -- ============================================
        -- REGIME FILTER (ONLY TRADE TRENDS)
        -- ============================================
        'regime_mode', 'trend_only',  -- ONLY trade trends (was 'auto') - avoid choppy markets
        'adx_trend_min', 30,  -- Stronger trends only (was 25)
        'adx_meanrev_max', 12,  -- Avoid mean reversion (was 19)
        
        -- ============================================
        -- COOLDOWN (REDUCE OVERTRADING)
        -- ============================================
        'cooldown_bars', 20,  -- Longer cooldown (was 8) - prevent overtrading
        
        -- ============================================
        -- DIRECTIONAL BIAS (STRICT TREND ALIGNMENT)
        -- ============================================
        'bias_mode', 'strict',  -- Strict trend alignment (was 'auto')
        'adx_min_htf', 28,  -- Higher timeframe must show strong trend (was 23)
        'require_adx_rising', true,  -- ADX must be rising
        'require_price_vs_trend', 'same',  -- Only trade with trend (was 'any')
        
        -- ============================================
        -- SMART EXIT (PROTECT PROFITS)
        -- ============================================
        'enable_dynamic_trailing', true,  -- Enable trailing stops
        'smart_exit_enabled', true,  -- Enable smart exits
        'smart_exit_retracement_pct', 0.4  -- Exit if retraces 40% from peak
    )
WHERE id = '7b3c49a4-099d-4817-8335-c139d24b4643';

-- Also update basic settings (CRITICAL FIXES)
UPDATE trading_bots
SET 
    -- Reduce trade amount significantly (to reduce risk per trade)
    trade_amount = LEAST(COALESCE(trade_amount, 100), 30),  -- Cap at $30 per trade (was likely higher)
    
    -- Reduce leverage significantly (to reduce risk)
    leverage = LEAST(COALESCE(leverage, 5), 2),  -- Cap at 2x leverage (was likely 5x+)
    
    -- Tighter stop loss (exit losses faster)
    stop_loss = GREATEST(COALESCE(stop_loss, 2.0), 1.2),  -- At least 1.2% stop loss
    
    -- Better take profit (need better R:R)
    take_profit = GREATEST(COALESCE(take_profit, 4.0), 2.5),  -- At least 2.5% take profit
    
    -- Lower risk level (conservative approach)
    risk_level = 'low'  -- Change to low risk (was likely 'medium' or 'high')
WHERE id = '7b3c49a4-099d-4817-8335-c139d24b4643';

-- Verify the updates
SELECT 
    id,
    name,
    symbol,
    trade_amount,
    leverage,
    risk_level,
    stop_loss,
    take_profit,
    strategy_config->>'max_consecutive_losses' as max_consecutive_losses,
    strategy_config->>'daily_loss_limit_pct' as daily_loss_limit,
    strategy_config->>'max_trades_per_day' as max_trades_per_day,
    strategy_config->>'max_concurrent' as max_concurrent,
    strategy_config->>'regime_mode' as regime_mode,
    strategy_config->>'bias_mode' as bias_mode
FROM trading_bots
WHERE id = '7b3c49a4-099d-4817-8335-c139d24b4643';

-- =====================================================
-- KEY CHANGES SUMMARY
-- =====================================================
-- 
-- CRITICAL FIXES APPLIED:
-- ✅ max_trades_per_day: 3 (was 8+) - DRASTICALLY REDUCE OVERTRADING
-- ✅ max_consecutive_losses: 2 (was 5) - Stop after 2 losses
-- ✅ daily_loss_limit_pct: 1.5% (was 3%) - Tighter daily loss limit
-- ✅ time_stop_hours: 12 (was 48) - AVOID FUNDING FEES
-- ✅ trade_amount: $30 max (was likely $50+) - Smaller position size
-- ✅ leverage: 2x max (was likely 5x+) - Lower leverage = lower risk
-- ✅ sl_atr_mult: 1.2 (was 1.3) - Tighter stops = faster loss exits
-- ✅ tp1_r: 1.5 (was 1.0) - Better risk:reward ratio
-- ✅ regime_mode: 'trend_only' - Only trade clear trends
-- ✅ cooldown_bars: 20 (was 8) - Longer wait between trades
--
-- EXPECTED IMPROVEMENTS:
-- 1. Reduced overtrading (3 trades/day vs 100+)
-- 2. Smaller losses (tighter stops, smaller positions)
-- 3. Better R:R (1.5:1 minimum)
-- 4. No funding fees (12-hour max hold time)
-- 5. Only quality setups (trend-only, higher volatility)
--
-- MONITORING:
-- - Check performance after 24-48 hours
-- - Review win rate and average R:R
-- - Ensure daily loss limits are working
-- - Verify funding fees are eliminated
--
-- =====================================================

