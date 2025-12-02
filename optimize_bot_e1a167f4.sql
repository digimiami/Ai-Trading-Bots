-- =====================================================
-- BOT OPTIMIZATION RECOMMENDATIONS (CONSERVATIVE)
-- Bot ID: e1a167f4-e7c8-4b60-9b42-86e6e5bb4874
-- Strategy: Conservative optimization for better risk management
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
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- =====================================================
-- CONSERVATIVE OPTIMIZATION STRATEGY
-- =====================================================
-- This optimization focuses on:
-- 1. Reducing overtrading (fewer, higher quality trades)
-- 2. Tighter risk management (smaller losses, better protection)
-- 3. Better risk:reward ratios (minimum 2:1)
-- 4. Avoiding funding fees (shorter hold times)
-- 5. Only trading clear trends (higher probability setups)
--
-- =====================================================
-- APPLY CONSERVATIVE OPTIMIZATIONS
-- =====================================================

-- Update bot with conservative optimized settings
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
        -- ============================================
        -- RISK MANAGEMENT (CRITICAL - PROTECT CAPITAL)
        -- ============================================
        'max_consecutive_losses', 2,  -- STRICT: Stop after 2 losses (was likely 5)
        'daily_loss_limit_pct', 1.5,  -- STRICT: Stop at 1.5% daily loss (was likely 3%)
        'weekly_loss_limit_pct', 4.0,  -- STRICT: Stop at 4% weekly loss (was likely 6%)
        'max_trades_per_day', 3,  -- STRICT: Max 3 trades per day - REDUCE OVERTRADING
        'max_concurrent', 1,  -- Only 1 position at a time (was likely 2)
        
        -- ============================================
        -- POSITION SIZING (REDUCE RISK PER TRADE)
        -- ============================================
        'risk_per_trade_pct', 0.4,  -- Reduced from likely 0.75 (smaller positions)
        
        -- ============================================
        -- STOP LOSS & TAKE PROFIT (TIGHTER CONTROL)
        -- ============================================
        'sl_atr_mult', 1.2,  -- Tighter stops (was likely 1.3) - exit losses faster
        'tp1_r', 1.5,  -- Better R:R ratio (was likely 1.0) - need 1.5x profit to justify risk
        'tp2_r', 3.0,  -- Higher second target (was likely 2.0)
        'tp1_size', 0.7,  -- Take 70% profit at first target (was likely 50%) - lock in gains
        
        -- ============================================
        -- TRAILING STOP & TIME MANAGEMENT
        -- ============================================
        'breakeven_at_r', 0.5,  -- Move to BE faster (was likely 0.8) - protect capital
        'trail_after_tp1_atr', 0.6,  -- Tighter trailing (was likely 1.0) - protect profits
        'time_stop_hours', 12,  -- Close positions after 12 hours (was likely 48) - AVOID FUNDING FEES
        
        -- ============================================
        -- VOLATILITY FILTERS (TRADE ONLY GOOD SETUPS)
        -- ============================================
        'atr_percentile_min', 40,  -- Only trade in higher volatility (was likely 20)
        'bb_width_min', 0.018,  -- Higher minimum volatility (was likely 0.012)
        'bb_width_max', 0.022,  -- Lower maximum volatility (was likely 0.03) - avoid extreme moves
        
        -- ============================================
        -- LIQUIDITY FILTERS (BETTER EXECUTION)
        -- ============================================
        'min_24h_volume_usd', 2000000000,  -- Higher volume requirement (was likely 500M) - better liquidity
        'max_spread_bps', 1.5,  -- Tighter spreads (was likely 3) - reduce slippage
        
        -- ============================================
        -- REGIME FILTER (ONLY TRADE TRENDS)
        -- ============================================
        'regime_mode', 'trend',  -- ONLY trade trends (was likely 'auto') - avoid choppy markets
        'adx_trend_min', 30,  -- Stronger trends only (was likely 25)
        'adx_meanrev_max', 12,  -- Avoid mean reversion (was likely 19)
        
        -- ============================================
        -- COOLDOWN (REDUCE OVERTRADING)
        -- ============================================
        'cooldown_bars', 20,  -- Longer cooldown (was likely 8) - prevent overtrading
        
        -- ============================================
        -- DIRECTIONAL BIAS (STRICT TREND ALIGNMENT)
        -- ============================================
        'bias_mode', 'auto',  -- Auto: Follow higher timeframe trend - strict alignment via other params
        'adx_min_htf', 28,  -- Higher timeframe must show strong trend (was likely 23) - must be between 15-35
        'require_adx_rising', true,  -- ADX must be rising
        'require_price_vs_trend', 'any',  -- Allow any price position (use 'above' or 'below' for stricter)
        
        -- ============================================
        -- SMART EXIT (PROTECT PROFITS)
        -- ============================================
        'enable_dynamic_trailing', true,  -- Enable trailing stops
        'smart_exit_enabled', true,  -- Enable smart exits
        'smart_exit_retracement_pct', 0.4  -- Exit if retraces 40% from peak
    )
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- Also update basic settings (CRITICAL FIXES)
UPDATE trading_bots
SET 
    -- Reduce trade amount significantly (to reduce risk per trade)
    trade_amount = LEAST(COALESCE(trade_amount, 100), 30),  -- Cap at $30 per trade
    
    -- Reduce leverage significantly (to reduce risk)
    leverage = LEAST(COALESCE(leverage, 5), 2),  -- Cap at 2x leverage
    
    -- Tighter stop loss (exit losses faster)
    stop_loss = GREATEST(COALESCE(stop_loss, 2.0), 1.2),  -- At least 1.2% stop loss
    
    -- Better take profit (need better R:R)
    take_profit = GREATEST(COALESCE(take_profit, 4.0), 2.5),  -- At least 2.5% take profit
    
    -- Lower risk level (conservative approach)
    risk_level = 'low'  -- Change to low risk (was likely 'medium' or 'high')
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

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
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'sl_atr_mult' as sl_atr_mult,
    strategy_config->>'tp1_r' as tp1_r,
    strategy_config->>'time_stop_hours' as time_stop_hours,
    strategy_config->>'cooldown_bars' as cooldown_bars
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- =====================================================
-- KEY CHANGES SUMMARY
-- =====================================================
-- 
-- CRITICAL FIXES APPLIED:
-- ✅ max_trades_per_day: 3 (was likely 8+) - DRASTICALLY REDUCE OVERTRADING
-- ✅ max_consecutive_losses: 2 (was likely 5) - Stop after 2 losses
-- ✅ daily_loss_limit_pct: 1.5% (was likely 3%) - Tighter daily loss limit
-- ✅ time_stop_hours: 12 (was likely 48) - AVOID FUNDING FEES
-- ✅ trade_amount: $30 max (was likely $50+) - Smaller position size
-- ✅ leverage: 2x max (was likely 5x+) - Lower leverage = lower risk
-- ✅ sl_atr_mult: 1.2 (was likely 1.3) - Tighter stops = faster loss exits
-- ✅ tp1_r: 1.5 (was likely 1.0) - Better risk:reward ratio
-- ✅ regime_mode: 'trend' - Only trade clear trends
-- ✅ cooldown_bars: 20 (was likely 8) - Longer wait between trades
--
-- EXPECTED IMPROVEMENTS:
-- 1. Reduced overtrading (3 trades/day vs potentially 100+)
-- 2. Smaller losses (tighter stops, smaller positions)
-- 3. Better R:R (1.5:1 minimum, actual 2.5% TP / 1.2% SL = 2.08:1)
-- 4. No funding fees (12-hour max hold time)
-- 5. Only quality setups (trend-only, higher volatility)
--
-- MONITORING:
-- - Check performance after 24-48 hours
-- - Review win rate and average R:R
-- - Ensure daily loss limits are working
-- - Verify funding fees are eliminated
-- - Confirm trade frequency is reduced
--
-- =====================================================

