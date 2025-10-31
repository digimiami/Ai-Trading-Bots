-- ============================================
-- BALANCE REQUIREMENTS CHECK
-- ============================================
-- This script shows what balance is needed for each bot
-- and checks if the account has enough funds
-- ============================================

-- Get current market prices and calculate required balances
WITH bot_requirements AS (
    SELECT 
        tb.id,
        tb.name,
        tb.exchange,
        tb.symbol,
        tb.status,
        tb.risk_level,
        tb.leverage,
        tb.strategy_config,
        -- Calculate trade amount based on risk level
        CASE 
            WHEN tb.risk_level = 'low' THEN 50
            WHEN tb.risk_level = 'medium' THEN 50 * 1.5
            WHEN tb.risk_level = 'high' THEN 50 * 2.0
            ELSE 50
        END * COALESCE((tb.strategy_config->>'max_concurrent')::int, 2) AS base_trade_amount,
        -- Estimate order value (will need to fetch current price for accurate)
        CASE 
            WHEN tb.symbol LIKE '%USDT' THEN 350.0  -- Rough estimate, will vary with price
            ELSE 350.0
        END AS estimated_price_per_trade
    FROM trading_bots tb
    WHERE tb.status = 'running'
),
recent_failures AS (
    SELECT 
        bal.bot_id,
        COUNT(*) AS insufficient_balance_errors,
        MAX(bal.timestamp) AS last_failure,
        MAX(bal.details->>'error') AS last_error_message
    FROM bot_activity_logs bal
    JOIN trading_bots tb ON bal.bot_id = tb.id
    WHERE bal.timestamp > NOW() - INTERVAL '24 hours'
        AND bal.level = 'warning'
        AND bal.message LIKE '%Insufficient balance%'
        AND tb.status = 'running'
    GROUP BY bal.bot_id
)
SELECT 
    br.name AS "Bot Name",
    br.exchange AS "Exchange",
    br.symbol AS "Symbol",
    br.status AS "Status",
    br.risk_level AS "Risk Level",
    br.leverage AS "Leverage",
    br.base_trade_amount AS "Base Trade Amount ($)",
    br.estimated_price_per_trade AS "Estimated Order Value ($)",
    COALESCE(rf.insufficient_balance_errors, 0) AS "Balance Errors (24h)",
    CASE 
        WHEN COALESCE(rf.insufficient_balance_errors, 0) > 0 THEN '❌ INSUFFICIENT BALANCE'
        ELSE '✅ OK'
    END AS "Balance Status",
    CASE 
        WHEN rf.last_failure IS NOT NULL 
        THEN TO_CHAR(rf.last_failure, 'YYYY-MM-DD HH24:MI')
        ELSE 'N/A'
    END AS "Last Failure"
FROM bot_requirements br
LEFT JOIN recent_failures rf ON br.id = rf.bot_id
ORDER BY 
    CASE WHEN rf.insufficient_balance_errors > 0 THEN 0 ELSE 1 END,
    br.name;

-- ============================================
-- SUMMARY: TOTAL REQUIRED BALANCE
-- ============================================
SELECT 
    '=== BALANCE REQUIREMENTS SUMMARY ===' AS section;

WITH bot_requirements AS (
    SELECT 
        tb.id,
        tb.name,
        tb.risk_level,
        tb.leverage,
        tb.strategy_config,
        CASE 
            WHEN tb.risk_level = 'low' THEN 50
            WHEN tb.risk_level = 'medium' THEN 50 * 1.5
            WHEN tb.risk_level = 'high' THEN 50 * 2.0
            ELSE 50
        END * COALESCE((tb.strategy_config->>'max_concurrent')::int, 2) AS base_trade_amount
    FROM trading_bots tb
    WHERE tb.status = 'running'
)
SELECT 
    COUNT(*) AS "Total Running Bots",
    SUM(base_trade_amount) AS "Total Required Base ($)",
    ROUND(AVG(base_trade_amount), 2) AS "Average Per Bot ($)",
    MAX(base_trade_amount) AS "Max Single Bot ($)",
    MIN(base_trade_amount) AS "Min Single Bot ($)"
FROM bot_requirements;

-- ============================================
-- RECOMMENDATIONS
-- ============================================
SELECT 
    '=== RECOMMENDATIONS ===' AS section;

SELECT 
    'Solution 1: Reduce Trade Amounts' AS "Option",
    'Reduce risk_level or max_concurrent in strategy_config to lower the required balance per trade.' AS "Description",
    'UPDATE trading_bots SET strategy_config = jsonb_set(strategy_config, ''{max_concurrent}'', ''1'') WHERE status = ''running'';' AS "SQL Example"
UNION ALL
SELECT 
    'Solution 2: Add More Funds' AS "Option",
    'Deposit more USDT to your Bybit account to meet the balance requirements.' AS "Description",
    'Check your Bybit wallet balance and add funds if needed.' AS "SQL Example"
UNION ALL
SELECT 
    'Solution 3: Pause Some Bots' AS "Option",
    'Pause bots with highest balance requirements to free up resources for others.' AS "Description",
    'UPDATE trading_bots SET status = ''paused'' WHERE name IN (''Bot Name Here'');' AS "SQL Example"
UNION ALL
SELECT 
    'Solution 4: Adjust Risk Levels' AS "Option",
    'Change risk_level from ''high'' to ''medium'' or ''low'' to reduce trade amounts.' AS "Description",
    'UPDATE trading_bots SET risk_level = ''medium'' WHERE risk_level = ''high'' AND status = ''running'';' AS "SQL Example";

