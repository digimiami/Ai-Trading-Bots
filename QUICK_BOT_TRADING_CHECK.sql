-- ============================================
-- QUICK DIAGNOSTIC: WHY BOTS NOT TRADING
-- ============================================

-- 1. MAIN ISSUES FROM RECENT LOGS
SELECT 
    '=== MAIN BLOCKING ISSUES ===' as check_type,
    tb.name as bot_name,
    tb.symbol,
    tb.paper_trading,
    bal.message as last_message,
    bal.timestamp as last_activity,
    CASE 
        WHEN bal.message LIKE '%No trading signals%' THEN '❌ Strategy conditions not met'
        WHEN bal.message LIKE '%Cooldown%' THEN '⏸️ Cooldown active'
        WHEN bal.message LIKE '%ADX%below minimum%' THEN '❌ ADX too low'
        WHEN bal.message LIKE '%price not above EMA%' THEN '❌ Price/EMA condition not met'
        WHEN bal.message LIKE '%shorts disabled%' THEN '❌ Shorts disabled, only longs allowed'
        WHEN bal.message LIKE '%insufficient balance%' THEN '❌ Insufficient balance'
        WHEN bal.message LIKE '%API key%' THEN '❌ API key issue'
        ELSE '⚠️ Other issue'
    END as issue_type
FROM trading_bots tb
LEFT JOIN LATERAL (
    SELECT message, timestamp
    FROM bot_activity_logs
    WHERE bot_id = tb.id
        AND (message LIKE '%No trading signals%' 
             OR message LIKE '%Cooldown%'
             OR message LIKE '%ADX%'
             OR message LIKE '%Strategy signal%'
             OR message LIKE '%insufficient%'
             OR message LIKE '%API%'
             OR level = 'error')
    ORDER BY timestamp DESC
    LIMIT 1
) bal ON true
WHERE tb.status = 'running'
ORDER BY tb.name;

-- 2. STRATEGY CONFIG ISSUES
SELECT 
    '=== STRATEGY CONFIG ISSUES ===' as check_type,
    tb.name,
    tb.symbol,
    tb.strategy,
    tb.strategy_config->>'adx_min_htf' as adx_min_htf,
    tb.strategy_config->>'adx_trend_min' as adx_trend_min,
    tb.strategy_config->>'adx_min' as adx_min,
    tb.strategy_config->>'cooldown_bars' as cooldown_bars,
    tb.strategy_config->>'bias_mode' as bias_mode,
    CASE 
        WHEN (tb.strategy_config->>'adx_min_htf')::numeric > 20 THEN '⚠️ ADX thresholds too high'
        WHEN (tb.strategy_config->>'cooldown_bars')::numeric > 10 THEN '⚠️ Cooldown too long'
        WHEN tb.strategy_config->>'bias_mode' = 'long' THEN '⚠️ Only longs allowed'
        WHEN tb.strategy_config->>'bias_mode' = 'short' THEN '⚠️ Only shorts allowed'
        ELSE '✅ Config OK'
    END as config_issue
FROM trading_bots tb
WHERE tb.status = 'running'
    AND (
        (tb.strategy_config->>'adx_min_htf')::numeric > 20
        OR (tb.strategy_config->>'cooldown_bars')::numeric > 10
        OR tb.strategy_config->>'bias_mode' IN ('long', 'short')
    )
ORDER BY tb.name;

-- 3. RECENT ERRORS SUMMARY
SELECT 
    '=== RECENT ERRORS ===' as check_type,
    tb.name,
    tb.symbol,
    COUNT(*) as error_count,
    STRING_AGG(DISTINCT SUBSTRING(bal.message, 1, 80), ' | ') as error_messages
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.timestamp > NOW() - INTERVAL '6 hours'
    AND tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol
ORDER BY error_count DESC;

-- 4. COOLDOWN STATUS
SELECT 
    '=== COOLDOWN STATUS ===' as check_type,
    tb.name,
    tb.symbol,
    COALESCE((tb.strategy_config->>'cooldown_bars')::numeric, 8) as cooldown_bars,
    MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.message LIKE '%✅%') as last_trade,
    EXTRACT(EPOCH FROM (NOW() - MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.message LIKE '%✅%'))) / 60 as minutes_since_trade,
    CASE 
        WHEN COALESCE((tb.strategy_config->>'cooldown_bars')::numeric, 8) = 0 THEN '✅ Disabled'
        WHEN MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.message LIKE '%✅%') IS NULL THEN '⚠️ No trades yet'
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.message LIKE '%✅%'))) / 60 < 5 THEN '⏸️ Just traded'
        ELSE '✅ Can trade'
    END as cooldown_status
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id 
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol, tb.strategy_config
ORDER BY tb.name;

-- 5. API KEY STATUS (REAL TRADING ONLY)
SELECT 
    '=== API KEY STATUS ===' as check_type,
    tb.name,
    tb.symbol,
    tb.exchange,
    CASE 
        WHEN ak.id IS NULL THEN '❌ NO API KEY'
        WHEN ak.is_active = false THEN '❌ INACTIVE'
        ELSE '✅ OK'
    END as api_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
WHERE tb.status = 'running' 
    AND tb.paper_trading = false
    AND (ak.id IS NULL OR ak.is_active = false)
ORDER BY tb.name;

