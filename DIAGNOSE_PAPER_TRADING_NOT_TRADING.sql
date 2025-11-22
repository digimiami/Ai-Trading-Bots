-- Diagnose why paper trading bots are not placing orders
-- Run this in Supabase SQL Editor

-- 1. Check paper trading bots and their strategy configurations
SELECT 
    b.id,
    b.name,
    b.symbol,
    b.paper_trading,
    b.status,
    b.strategy_type,
    -- Extract strategy config
    b.strategy::json->>'rsiThreshold' as rsi_threshold,
    b.strategy::json->>'adxThreshold' as adx_threshold,
    b.strategy::json->>'type' as strategy_type_from_config,
    b.strategy::json->>'name' as strategy_name,
    b.strategy::json->>'useMLPrediction' as use_ml_prediction,
    b.strategy::json->>'cooldown_bars' as cooldown_bars,
    b.strategy::json->>'immediate_execution' as immediate_execution,
    -- Check recent logs
    (SELECT COUNT(*) FROM bot_activity_logs 
     WHERE bot_id = b.id 
     AND created_at > NOW() - INTERVAL '1 hour'
     AND message LIKE '%Strategy conditions not met%') as conditions_not_met_count,
    (SELECT COUNT(*) FROM bot_activity_logs 
     WHERE bot_id = b.id 
     AND created_at > NOW() - INTERVAL '1 hour'
     AND message LIKE '%ML Prediction%') as ml_prediction_count,
    -- Check for recent trades
    (SELECT COUNT(*) FROM paper_trading_trades 
     WHERE bot_id = b.id 
     AND created_at > NOW() - INTERVAL '24 hours') as trades_last_24h,
    -- Check for open positions
    (SELECT COUNT(*) FROM paper_trading_positions 
     WHERE bot_id = b.id 
     AND status = 'open') as open_positions
FROM trading_bots b
WHERE b.paper_trading = true
ORDER BY b.name;

-- 2. Check recent activity logs for paper trading bots
SELECT 
    b.name,
    bal.level,
    bal.category,
    bal.message,
    bal.created_at,
    bal.details
FROM bot_activity_logs bal
JOIN trading_bots b ON b.id = bal.bot_id
WHERE b.paper_trading = true
  AND bal.created_at > NOW() - INTERVAL '2 hours'
  AND (
    bal.message LIKE '%Strategy conditions not met%'
    OR bal.message LIKE '%ML Prediction%'
    OR bal.message LIKE '%Market data%'
  )
ORDER BY bal.created_at DESC
LIMIT 50;

-- 3. Check if bots have valid strategy configurations
SELECT 
    b.id,
    b.name,
    b.symbol,
    CASE 
        WHEN b.strategy IS NULL THEN '❌ NULL strategy'
        WHEN b.strategy::text = '{}' THEN '❌ Empty strategy'
        WHEN b.strategy::json->>'rsiThreshold' IS NULL 
         AND b.strategy::json->>'adxThreshold' IS NULL
         AND b.strategy::json->>'type' IS NULL THEN '❌ No strategy parameters'
        ELSE '✅ Has strategy config'
    END as strategy_status,
    b.strategy::text as strategy_json
FROM trading_bots b
WHERE b.paper_trading = true
ORDER BY b.name;

-- 4. Check cooldown status
SELECT 
    b.id,
    b.name,
    b.symbol,
    COALESCE((b.strategy::json->>'cooldown_bars')::int, 0) as cooldown_bars,
    (SELECT MAX(created_at) FROM paper_trading_trades WHERE bot_id = b.id) as last_trade_time,
    CASE 
        WHEN (SELECT MAX(created_at) FROM paper_trading_trades WHERE bot_id = b.id) IS NULL 
        THEN 'No trades yet'
        WHEN (SELECT MAX(created_at) FROM paper_trading_trades WHERE bot_id = b.id) > NOW() - INTERVAL '1 hour'
        THEN 'Recent trade (< 1h ago)'
        ELSE 'Can trade (no recent trades)'
    END as cooldown_status
FROM trading_bots b
WHERE b.paper_trading = true
ORDER BY b.name;

