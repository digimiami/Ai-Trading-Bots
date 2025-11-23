-- Simple diagnostic query - run each part separately

-- PART 1: Check recent strategy evaluation results (last 5 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '5 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.category = 'strategy'
ORDER BY bal.created_at DESC
LIMIT 30;

-- PART 2: Check for errors (last 5 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.level,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '5 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.level = 'error'
ORDER BY bal.created_at DESC
LIMIT 20;

-- PART 3: Check if bots are executing (last 5 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '5 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.category = 'system'
  AND bal.message LIKE '%PAPER%'
ORDER BY bal.created_at DESC
LIMIT 30;

-- PART 4: Check market data (last 5 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '5 minutes'
  AND tb.paper_trading = true
  AND tb.status = 'running'
  AND bal.category = 'market'
ORDER BY bal.created_at DESC
LIMIT 30;

