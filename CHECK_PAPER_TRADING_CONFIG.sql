-- Check Paper Trading Configuration for All Bots
-- This will help identify which bots are configured incorrectly

SELECT 
    tb.id as bot_id,
    tb.name as bot_name,
    tb.status,
    tb.paper_trading,
    tb.trading_type as market_type,
    tb.exchange,
    tb.user_id,
    ak.exchange as api_key_exchange,
    ak.is_testnet as api_key_is_testnet,
    ak.is_active as api_key_is_active,
    CASE 
        WHEN tb.paper_trading = true AND (ak.is_testnet IS NULL OR ak.is_testnet = false) 
            THEN '❌ MISMATCH: Paper bot using mainnet API key'
        WHEN (tb.paper_trading IS NULL OR tb.paper_trading = false) AND ak.is_testnet = true 
            THEN '❌ MISMATCH: Real bot using testnet API key'
        WHEN tb.paper_trading = true AND ak.is_testnet = true 
            THEN '✅ Correct: Paper bot with testnet key'
        WHEN (tb.paper_trading IS NULL OR tb.paper_trading = false) AND (ak.is_testnet IS NULL OR ak.is_testnet = false) 
            THEN '✅ Correct: Real bot with mainnet key'
        WHEN ak.id IS NULL 
            THEN '⚠️ No API key found'
        ELSE '⚠️ Unknown configuration'
    END as config_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON ak.user_id = tb.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.status = 'running'
ORDER BY 
    CASE 
        WHEN tb.paper_trading = true AND (ak.is_testnet IS NULL OR ak.is_testnet = false) THEN 1
        WHEN (tb.paper_trading IS NULL OR tb.paper_trading = false) AND ak.is_testnet = true THEN 2
        ELSE 3
    END,
    tb.name;

