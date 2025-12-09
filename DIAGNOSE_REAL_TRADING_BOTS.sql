-- ============================================================================
-- DIAGNOSE WHY REAL TRADING BOTS ARE NOT EXECUTING TRADES
-- ============================================================================
-- This script checks multiple potential causes:
-- 1. Bot status and configuration
-- 2. Safety limits (risk management)
-- 3. Subscription/trial limits
-- 4. API keys status
-- 5. Recent bot activity and errors
-- 6. Execution schedule
-- ============================================================================

-- ============================================================================
-- 1. OVERVIEW: Real Trading Bots Status
-- ============================================================================
SELECT 
    '=== REAL TRADING BOTS OVERVIEW ===' as category,
    COUNT(*) FILTER (WHERE paper_trading = false OR paper_trading IS NULL) as total_real_bots,
    COUNT(*) FILTER (WHERE (paper_trading = false OR paper_trading IS NULL) AND status = 'running') as running_real_bots,
    COUNT(*) FILTER (WHERE (paper_trading = false OR paper_trading IS NULL) AND status = 'stopped') as stopped_real_bots,
    COUNT(*) FILTER (WHERE (paper_trading = false OR paper_trading IS NULL) AND status = 'paused') as paused_real_bots
FROM trading_bots;

-- ============================================================================
-- 2. REAL TRADING BOTS DETAILED STATUS
-- ============================================================================
SELECT 
    '=== REAL TRADING BOTS DETAILED STATUS ===' as category,
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.paper_trading,
    tb.exchange,
    tb.trading_type,
    tb.user_id,
    u.email as user_email,
    u.role as user_role,
    tb.next_execution_at,
    tb.last_execution_at,
    CASE 
        WHEN tb.next_execution_at IS NULL THEN 'No schedule'
        WHEN tb.next_execution_at > NOW() THEN 'Scheduled'
        WHEN tb.next_execution_at <= NOW() THEN 'OVERDUE - Should execute'
        ELSE 'Unknown'
    END as execution_status,
    EXTRACT(EPOCH FROM (NOW() - tb.last_execution_at)) / 60 as minutes_since_last_execution,
    tb.health_status,
    tb.created_at
FROM trading_bots tb
LEFT JOIN users u ON tb.user_id = u.id
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
ORDER BY tb.status, tb.next_execution_at DESC NULLS LAST;

-- ============================================================================
-- 3. CHECK SUBSCRIPTION/TRIAL LIMITS (Why trades might be blocked)
-- ============================================================================
SELECT 
    '=== SUBSCRIPTION/TRIAL LIMITS CHECK ===' as category,
    u.id as user_id,
    u.email,
    u.role,
    -- Check if user can trade
    can_user_trade(u.id, 'real') as trade_permission,
    -- Get subscription details
    us.status as subscription_status,
    us.expires_at as subscription_expires,
    us.trial_started_at,
    us.trial_period_days,
    CASE 
        WHEN us.trial_started_at IS NOT NULL AND us.trial_period_days IS NOT NULL THEN
            EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER
        ELSE NULL
    END as trial_days_elapsed,
    CASE 
        WHEN us.trial_started_at IS NOT NULL AND us.trial_period_days IS NOT NULL THEN
            us.trial_period_days - EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER
        ELSE NULL
    END as trial_days_remaining,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    sp.max_trades_per_day,
    -- Count today's trades
    (SELECT COUNT(*) 
     FROM trades t 
     WHERE t.user_id = u.id 
       AND DATE(t.created_at) = CURRENT_DATE
       AND t.status IN ('filled', 'completed', 'open')) as trades_today,
    -- Check if trial expired
    CASE 
        WHEN us.trial_started_at IS NOT NULL 
         AND us.trial_period_days IS NOT NULL 
         AND EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER >= us.trial_period_days THEN 'EXPIRED'
        WHEN us.trial_started_at IS NOT NULL THEN 'ACTIVE'
        ELSE 'NO_TRIAL'
    END as trial_status
FROM users u
LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE u.id IN (
    SELECT DISTINCT user_id 
    FROM trading_bots 
    WHERE (paper_trading = false OR paper_trading IS NULL) 
      AND status = 'running'
)
ORDER BY u.email;

-- ============================================================================
-- 4. CHECK SAFETY LIMITS (Risk Management)
-- ============================================================================
WITH bot_trade_stats AS (
    SELECT 
        bot_id,
        user_id,
        -- Daily loss
        COALESCE(SUM(
            CASE 
                WHEN DATE(executed_at) = CURRENT_DATE 
                 AND status IN ('closed', 'filled', 'completed')
                 AND pnl < 0 THEN ABS(pnl)
                ELSE 0
            END
        ), 0) as daily_loss,
        -- Weekly loss
        COALESCE(SUM(
            CASE 
                WHEN executed_at >= NOW() - INTERVAL '7 days'
                 AND status IN ('closed', 'filled', 'completed')
                 AND pnl < 0 THEN ABS(pnl)
                ELSE 0
            END
        ), 0) as weekly_loss,
        -- Consecutive losses (last 10 trades)
        (
            SELECT COUNT(*)
            FROM (
                SELECT pnl
                FROM trades
                WHERE bot_id = tb.id
                  AND status IN ('closed', 'filled', 'completed')
                ORDER BY executed_at DESC
                LIMIT 10
            ) recent_trades
            WHERE pnl < 0
        ) as consecutive_losses_count,
        -- Trades today
        COUNT(*) FILTER (
            WHERE DATE(executed_at) = CURRENT_DATE
              AND status IN ('filled', 'completed', 'open')
        ) as trades_today,
        -- Open positions
        COUNT(*) FILTER (WHERE status = 'open') as open_positions
    FROM trades t
    JOIN trading_bots tb ON t.bot_id = tb.id
    WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
      AND tb.status = 'running'
    GROUP BY bot_id, user_id, tb.id
)
SELECT 
    '=== SAFETY LIMITS CHECK (RISK MANAGEMENT) ===' as category,
    tb.id as bot_id,
    tb.name as bot_name,
    tb.symbol,
    bts.daily_loss,
    bts.weekly_loss,
    bts.consecutive_losses_count,
    bts.trades_today,
    bts.open_positions,
    -- Get max trades per day from strategy config
    COALESCE(
        (tb.strategy_config->>'max_trades_per_day')::INTEGER,
        8
    ) as max_trades_per_day,
    -- Check if daily limit reached
    CASE 
        WHEN bts.trades_today >= COALESCE((tb.strategy_config->>'max_trades_per_day')::INTEGER, 8) THEN 'LIMIT_REACHED'
        ELSE 'OK'
    END as daily_trade_limit_status,
    -- Get daily loss limit from strategy config (default 3%)
    COALESCE(
        (tb.strategy_config->>'daily_loss_limit_pct')::NUMERIC,
        3.0
    ) as daily_loss_limit_pct,
    -- Get weekly loss limit from strategy config (default 6%)
    COALESCE(
        (tb.strategy_config->>'weekly_loss_limit_pct')::NUMERIC,
        6.0
    ) as weekly_loss_limit_pct,
    -- Get max consecutive losses from strategy config (default 5)
    COALESCE(
        (tb.strategy_config->>'max_consecutive_losses')::INTEGER,
        5
    ) as max_consecutive_losses,
    -- Check if any limit is breached
    CASE 
        WHEN bts.trades_today >= COALESCE((tb.strategy_config->>'max_trades_per_day')::INTEGER, 8) THEN 'Daily trade limit'
        WHEN bts.consecutive_losses_count >= COALESCE((tb.strategy_config->>'max_consecutive_losses')::INTEGER, 5) THEN 'Consecutive losses limit'
        ELSE 'OK'
    END as safety_limit_status
FROM trading_bots tb
LEFT JOIN bot_trade_stats bts ON bts.bot_id = tb.id
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
  AND tb.status = 'running'
ORDER BY tb.name;

-- ============================================================================
-- 5. CHECK API KEYS STATUS
-- ============================================================================
SELECT 
    '=== API KEYS STATUS ===' as category,
    u.id as user_id,
    u.email,
    COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'bybit') as bybit_keys,
    COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'okx') as okx_keys,
    COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'bitunix') as bitunix_keys,
    -- Check if bots need API keys
    COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'bybit' AND tb.status = 'running') as bybit_bots,
    COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'okx' AND tb.status = 'running') as okx_bots,
    COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'bitunix' AND tb.status = 'running') as bitunix_bots,
    -- Check for missing API keys
    CASE 
        WHEN COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'bybit' AND tb.status = 'running') > 0 
         AND COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'bybit') = 0 THEN 'MISSING BYBIT KEY'
        WHEN COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'okx' AND tb.status = 'running') > 0 
         AND COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'okx') = 0 THEN 'MISSING OKX KEY'
        WHEN COUNT(DISTINCT tb.id) FILTER (WHERE tb.exchange = 'bitunix' AND tb.status = 'running') > 0 
         AND COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'bitunix') = 0 THEN 'MISSING BITUNIX KEY'
        ELSE 'OK'
    END as api_key_status
FROM users u
LEFT JOIN api_keys ak ON ak.user_id = u.id
LEFT JOIN trading_bots tb ON tb.user_id = u.id 
    AND (tb.paper_trading = false OR tb.paper_trading IS NULL)
    AND tb.status = 'running'
WHERE u.id IN (
    SELECT DISTINCT user_id 
    FROM trading_bots 
    WHERE (paper_trading = false OR paper_trading IS NULL) 
      AND status = 'running'
)
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT tb.id) > 0
ORDER BY u.email;

-- ============================================================================
-- 6. RECENT BOT ACTIVITY LOGS (Check for errors/warnings)
-- ============================================================================
SELECT 
    '=== RECENT BOT ACTIVITY LOGS (LAST 24H) ===' as category,
    bal.bot_id,
    tb.name as bot_name,
    tb.symbol,
    bal.level,
    bal.category,
    bal.message,
    bal.created_at,
    bal.details
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
  AND tb.status = 'running'
  AND bal.created_at >= NOW() - INTERVAL '24 hours'
  AND (
      bal.level IN ('error', 'warning') 
      OR bal.message ILIKE '%blocked%'
      OR bal.message ILIKE '%limit%'
      OR bal.message ILIKE '%subscription%'
      OR bal.message ILIKE '%trial%'
      OR bal.message ILIKE '%safety%'
      OR bal.message ILIKE '%permission%'
  )
ORDER BY bal.created_at DESC
LIMIT 50;

-- ============================================================================
-- 7. RECENT TRADES (Check if any trades executed recently)
-- ============================================================================
SELECT 
    '=== RECENT REAL TRADES (LAST 24H) ===' as category,
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE DATE(executed_at) = CURRENT_DATE) as trades_today,
    COUNT(*) FILTER (WHERE status = 'open') as open_trades,
    COUNT(*) FILTER (WHERE status IN ('filled', 'completed')) as completed_trades,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_trades,
    SUM(pnl) FILTER (WHERE pnl IS NOT NULL) as total_pnl,
    MIN(executed_at) as earliest_trade,
    MAX(executed_at) as latest_trade
FROM trades t
JOIN trading_bots tb ON t.bot_id = tb.id
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
  AND t.executed_at >= NOW() - INTERVAL '24 hours';

-- ============================================================================
-- 8. BOTS WITH OVERDUE EXECUTION (Should have executed but didn't)
-- ============================================================================
SELECT 
    '=== BOTS WITH OVERDUE EXECUTION ===' as category,
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.next_execution_at,
    tb.last_execution_at,
    EXTRACT(EPOCH FROM (NOW() - tb.next_execution_at)) / 60 as minutes_overdue,
    CASE 
        WHEN tb.next_execution_at IS NULL THEN 'No schedule set'
        WHEN tb.next_execution_at > NOW() THEN 'Scheduled (not yet)'
        WHEN tb.next_execution_at <= NOW() THEN 'OVERDUE - Should execute'
        ELSE 'Unknown'
    END as execution_status,
    tb.health_status,
    u.email as user_email
FROM trading_bots tb
LEFT JOIN users u ON tb.user_id = u.id
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
  AND tb.status = 'running'
  AND (
      tb.next_execution_at IS NULL 
      OR tb.next_execution_at <= NOW() - INTERVAL '5 minutes'
  )
ORDER BY tb.next_execution_at ASC NULLS FIRST;

-- ============================================================================
-- 9. SUMMARY: Potential Blocking Issues
-- ============================================================================
WITH issues AS (
    -- Subscription/trial issues
    SELECT 
        u.id as user_id,
        u.email,
        'SUBSCRIPTION_ISSUE' as issue_type,
        CASE 
            WHEN us.trial_started_at IS NOT NULL 
             AND us.trial_period_days IS NOT NULL 
             AND EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER >= us.trial_period_days 
            THEN 'Trial expired'
            WHEN us.id IS NULL THEN 'No active subscription'
            WHEN us.expires_at IS NOT NULL AND us.expires_at < NOW() THEN 'Subscription expired'
            ELSE 'Unknown subscription issue'
        END as issue_description
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
    WHERE u.id IN (
        SELECT DISTINCT user_id 
        FROM trading_bots 
        WHERE (paper_trading = false OR tb.paper_trading IS NULL) 
          AND status = 'running'
    )
    AND (
        us.id IS NULL 
        OR (us.trial_started_at IS NOT NULL 
            AND us.trial_period_days IS NOT NULL 
            AND EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER >= us.trial_period_days)
        OR (us.expires_at IS NOT NULL AND us.expires_at < NOW())
    )
    
    UNION ALL
    
    -- API key issues
    SELECT 
        u.id as user_id,
        u.email,
        'MISSING_API_KEY' as issue_type,
        'Missing API key for exchange: ' || tb.exchange as issue_description
    FROM users u
    JOIN trading_bots tb ON tb.user_id = u.id
    LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.exchange = tb.exchange
    WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
      AND tb.status = 'running'
      AND ak.id IS NULL
)
SELECT 
    '=== SUMMARY: POTENTIAL BLOCKING ISSUES ===' as category,
    issue_type,
    COUNT(DISTINCT user_id) as affected_users,
    STRING_AGG(DISTINCT email, ', ') as affected_user_emails,
    STRING_AGG(DISTINCT issue_description, ' | ') as issue_descriptions
FROM issues
GROUP BY issue_type
ORDER BY issue_type;

-- ============================================================================
-- 10. QUICK FIX SUGGESTIONS
-- ============================================================================
SELECT 
    '=== QUICK FIX SUGGESTIONS ===' as category,
    CASE 
        WHEN COUNT(*) FILTER (
            WHERE us.trial_started_at IS NOT NULL 
             AND us.trial_period_days IS NOT NULL 
             AND EXTRACT(DAY FROM (NOW() - us.trial_started_at))::INTEGER >= us.trial_period_days
        ) > 0 THEN 'Some users have expired trials - upgrade their plans'
        WHEN COUNT(*) FILTER (WHERE us.id IS NULL) > 0 THEN 'Some users have no subscription - assign Testing plan'
        WHEN COUNT(*) FILTER (WHERE ak.id IS NULL AND tb.status = 'running') > 0 THEN 'Some bots missing API keys - add API keys'
        WHEN COUNT(*) FILTER (WHERE tb.next_execution_at IS NULL AND tb.status = 'running') > 0 THEN 'Some bots have no execution schedule - check cron job'
        ELSE 'No obvious issues found - check bot activity logs for detailed errors'
    END as recommendation
FROM trading_bots tb
LEFT JOIN users u ON tb.user_id = u.id
LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.exchange = tb.exchange
WHERE (tb.paper_trading = false OR tb.paper_trading IS NULL)
  AND tb.status = 'running';

