-- COMPREHENSIVE DIAGNOSIS: Why Are None of the Bots Trading (Paper/Real)?
-- ========================================================================
-- Run this script to get a complete picture of what's blocking your bots

-- ================================
-- SECTION 1: BOT STATUS OVERVIEW
-- ================================
SELECT '=== BOT STATUS OVERVIEW ===' as section;

SELECT 
  status,
  COUNT(*) as total_bots,
  COUNT(*) FILTER (WHERE paper_trading = true) as paper_bots,
  COUNT(*) FILTER (WHERE paper_trading = false) as real_bots,
  STRING_AGG(DISTINCT name, ', ') FILTER (WHERE paper_trading = false) as real_bot_names
FROM trading_bots
GROUP BY status
ORDER BY total_bots DESC;

-- ================================
-- SECTION 2: RUNNING BOTS DETAILS
-- ================================
SELECT '' as spacer;
SELECT '=== RUNNING BOTS CONFIGURATION ===' as section;

SELECT 
  id,
  name,
  symbol,
  status,
  paper_trading,
  strategy::jsonb->>'type' as strategy_type,
  strategy_config->>'immediate_execution' as immediate_exec,
  strategy_config->>'super_aggressive' as super_aggressive,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'cooldown_bars' as cooldown,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  exchange,
  updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading DESC, created_at DESC;

-- ================================
-- SECTION 3: RECENT ACTIVITY (Last 2 hours)
-- ================================
SELECT '' as spacer;
SELECT '=== RECENT BOT ACTIVITY (Last 2 hours) ===' as section;

SELECT 
  tb.name as bot_name,
  tb.paper_trading,
  tb.symbol,
  bal.level,
  bal.message,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.created_at > NOW() - INTERVAL '2 hours'
ORDER BY bal.created_at DESC
LIMIT 50;

-- ================================
-- SECTION 4: STRATEGY SIGNALS (Last 2 hours)
-- ================================
SELECT '' as spacer;
SELECT '=== STRATEGY SIGNAL ANALYSIS (Last 2 hours) ===' as section;

WITH signal_analysis AS (
  SELECT 
    tb.id,
    tb.name,
    tb.paper_trading,
    tb.symbol,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy signal: BUY%' OR bal.message LIKE '%Strategy signal: SELL%') as buy_sell_signals,
    COUNT(*) FILTER (WHERE bal.message LIKE '%⏸️ Strategy signal:%' OR bal.message LIKE '%No trading signals%') as no_signal_count,
    COUNT(*) FILTER (WHERE bal.message LIKE '%conditions not met%') as conditions_not_met,
    MAX(bal.created_at) FILTER (WHERE bal.message LIKE '%Strategy signal:%') as last_signal_time,
    (SELECT bal2.message FROM bot_activity_logs bal2 WHERE bal2.bot_id = tb.id AND bal2.message LIKE '%Strategy signal:%' ORDER BY bal2.created_at DESC LIMIT 1) as last_signal_message
  FROM trading_bots tb
  LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id AND bal.created_at > NOW() - INTERVAL '2 hours'
  WHERE tb.status = 'running'
  GROUP BY tb.id, tb.name, tb.paper_trading, tb.symbol
)
SELECT 
  name,
  paper_trading,
  symbol,
  buy_sell_signals as positive_signals,
  no_signal_count as negative_signals,
  conditions_not_met,
  last_signal_time,
  LEFT(last_signal_message, 150) as last_signal_preview
FROM signal_analysis
ORDER BY paper_trading DESC, last_signal_time DESC NULLS LAST;

-- ================================
-- SECTION 5: RECENT TRADES (Last 24 hours)
-- ================================
SELECT '' as spacer;
SELECT '=== RECENT TRADES (Last 24 hours) ===' as section;

-- Real trades
SELECT 
  'REAL TRADES' as trade_type,
  t.created_at,
  tb.name as bot_name,
  t.symbol,
  t.side,
  t.amount,
  t.price,
  t.status
FROM trades t
JOIN trading_bots tb ON t.bot_id = tb.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC
LIMIT 20;

-- Paper trades
SELECT 
  'PAPER TRADES' as trade_type,
  ptt.created_at,
  tb.name as bot_name,
  ptt.symbol,
  ptt.side,
  ptt.quantity,
  ptt.entry_price as price,
  ptt.status
FROM paper_trading_trades ptt
JOIN trading_bots tb ON ptt.bot_id = tb.id
WHERE ptt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ptt.created_at DESC
LIMIT 20;

-- ================================
-- SECTION 6: API KEY STATUS (Real Trading Only)
-- ================================
SELECT '' as spacer;
SELECT '=== API KEY STATUS (Real Trading Bots) ===' as section;

SELECT 
  tb.id,
  tb.name,
  tb.exchange,
  tb.paper_trading,
  CASE 
    WHEN tb.paper_trading = true THEN '✅ PAPER (No API needed)'
    WHEN ak.id IS NULL THEN '❌ NO API KEY'
    WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
    WHEN ak.exchange != tb.exchange THEN '⚠️ EXCHANGE MISMATCH'
    ELSE '✅ API KEY ACTIVE'
  END as api_status,
  ak.created_at as api_key_created
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.status = 'running'
ORDER BY tb.paper_trading DESC, api_status;

-- ================================
-- SECTION 7: ERRORS (Last 6 hours)
-- ================================
SELECT '' as spacer;
SELECT '=== ERRORS (Last 6 hours) ===' as section;

SELECT 
  tb.name as bot_name,
  tb.paper_trading,
  bal.level,
  bal.message,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.level = 'error'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
ORDER BY bal.created_at DESC
LIMIT 30;

-- ================================
-- SECTION 8: PROBLEM SUMMARY
-- ================================
SELECT '' as spacer;
SELECT '=== PROBLEM SUMMARY ===' as section;

WITH problem_analysis AS (
  -- Check for stopped bots
  SELECT 
    'Bots Not Running' as problem,
    COUNT(*) as affected_count,
    STRING_AGG(name, ', ') as affected_bots,
    1 as priority
  FROM trading_bots
  WHERE status != 'running'
  
  UNION ALL
  
  -- Check for bots with no recent activity
  SELECT 
    'No Activity (2h)' as problem,
    COUNT(DISTINCT tb.id) as affected_count,
    STRING_AGG(DISTINCT tb.name, ', ') as affected_bots,
    2 as priority
  FROM trading_bots tb
  LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id AND bal.created_at > NOW() - INTERVAL '2 hours'
  WHERE tb.status = 'running'
    AND bal.id IS NULL
  
  UNION ALL
  
  -- Check for bots only getting "no signal" messages
  SELECT 
    'Only "No Signal" Messages (2h)' as problem,
    COUNT(DISTINCT tb.id) as affected_count,
    STRING_AGG(DISTINCT tb.name, ', ') as affected_bots,
    3 as priority
  FROM trading_bots tb
  WHERE tb.status = 'running'
    AND EXISTS (
      SELECT 1 FROM bot_activity_logs bal 
      WHERE bal.bot_id = tb.id 
        AND bal.created_at > NOW() - INTERVAL '2 hours'
        AND bal.message LIKE '%⏸️ Strategy signal:%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM bot_activity_logs bal 
      WHERE bal.bot_id = tb.id 
        AND bal.created_at > NOW() - INTERVAL '2 hours'
        AND (bal.message LIKE '%✅ Strategy signal: BUY%' OR bal.message LIKE '%✅ Strategy signal: SELL%')
    )
  
  UNION ALL
  
  -- Check for recent errors
  SELECT 
    'Recent Errors (6h)' as problem,
    COUNT(DISTINCT bal.bot_id) as affected_count,
    STRING_AGG(DISTINCT tb.name, ', ') as affected_bots,
    4 as priority
  FROM bot_activity_logs bal
  JOIN trading_bots tb ON bal.bot_id = tb.id
  WHERE tb.status = 'running'
    AND bal.level = 'error'
    AND bal.created_at > NOW() - INTERVAL '6 hours'
  
  UNION ALL
  
  -- Check for missing API keys (real trading only)
  SELECT 
    'Missing API Keys (Real Trading)' as problem,
    COUNT(*) as affected_count,
    STRING_AGG(tb.name, ', ') as affected_bots,
    5 as priority
  FROM trading_bots tb
  LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
  WHERE tb.status = 'running'
    AND tb.paper_trading = false
    AND ak.id IS NULL
  
  UNION ALL
  
  -- Check for no trades in last 24h
  SELECT 
    'No Trades Executed (24h)' as problem,
    (SELECT COUNT(*) FROM trading_bots WHERE status = 'running' AND paper_trading = false) as affected_count,
    'All real trading bots' as affected_bots,
    6 as priority
  WHERE NOT EXISTS (
    SELECT 1 FROM trades WHERE created_at > NOW() - INTERVAL '24 hours'
  )
  
  UNION ALL
  
  SELECT 
    'No Paper Trades (24h)' as problem,
    (SELECT COUNT(*) FROM trading_bots WHERE status = 'running' AND paper_trading = true) as affected_count,
    'All paper trading bots' as affected_bots,
    7 as priority
  WHERE NOT EXISTS (
    SELECT 1 FROM paper_trading_trades WHERE created_at > NOW() - INTERVAL '24 hours'
  )
)
SELECT 
  problem,
  affected_count,
  LEFT(affected_bots, 200) as sample_affected_bots
FROM problem_analysis
WHERE affected_count > 0
ORDER BY priority;

-- ================================
-- SECTION 9: SAMPLE STRATEGY CONDITIONS
-- ================================
SELECT '' as spacer;
SELECT '=== SAMPLE STRATEGY CONDITIONS (Why No Signals?) ===' as section;

SELECT 
  bal.bot_id,
  tb.name,
  tb.paper_trading,
  bal.message,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.message LIKE '%conditions not met%'
  AND bal.created_at > NOW() - INTERVAL '2 hours'
ORDER BY bal.created_at DESC
LIMIT 10;

-- ================================
-- SECTION 10: RECOMMENDED ACTIONS
-- ================================
SELECT '' as spacer;
SELECT '=== RECOMMENDED ACTIONS ===' as section;
SELECT '
RECOMMENDATIONS BASED ON DIAGNOSIS:

1. If bots are STOPPED:
   - Run START_ALL_STOPPED_BOTS.sql to start them

2. If bots are RUNNING but NOT GENERATING SIGNALS:
   - Strategy conditions are too restrictive
   - Run FORCE_ALL_BOTS_TO_TRADE.sql to make them super aggressive
   - This sets: adx_min=0, cooldown=0, immediate_execution=true, etc.

3. If bots are GENERATING SIGNALS but NOT EXECUTING:
   - Check for API key issues (real trading)
   - Check for errors in error logs
   - Check position limits or account restrictions

4. If specific bots have ERRORS:
   - Review the error messages above
   - Common issues: invalid quantity, insufficient balance, symbol not found

5. If NO TRADES in 24h (but signals exist):
   - There may be a bug in the executeTrade function
   - Check bot_activity_logs for "Trade execution" messages
   - Verify Bybit API connectivity

NEXT STEPS:
- Review the sections above to identify the root cause
- Start with SECTION 8: PROBLEM SUMMARY
- Then review SECTION 9: Why are conditions not met?
- Finally, run the appropriate fix script based on findings
' as recommendations;

