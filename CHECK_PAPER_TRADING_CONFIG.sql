-- Check Paper Trading Configuration for All Bots
-- IMPORTANT: Paper trading should use MAINNET API keys (is_testnet = false)
-- to get real market data, but trades are simulated (not placed on exchange)

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
        -- Paper trading should use mainnet keys for real market data
        WHEN tb.paper_trading = true AND (ak.is_testnet IS NULL OR ak.is_testnet = false) 
            THEN '✅ Correct: Paper bot using mainnet API key (real data, simulated trades)'
        -- Real trading should use mainnet keys
        WHEN (tb.paper_trading IS NULL OR tb.paper_trading = false) AND (ak.is_testnet IS NULL OR ak.is_testnet = false) 
            THEN '✅ Correct: Real bot using mainnet API key'
        -- These are misconfigurations (testnet keys should not be used)
        WHEN tb.paper_trading = true AND ak.is_testnet = true 
            THEN '⚠️ WARNING: Paper bot using testnet key (should use mainnet for real data)'
        WHEN (tb.paper_trading IS NULL OR tb.paper_trading = false) AND ak.is_testnet = true 
            THEN '❌ MISMATCH: Real bot using testnet API key (will fail)'
        WHEN ak.id IS NULL 
            THEN '❌ No API key found'
        ELSE '⚠️ Unknown configuration'
    END as config_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON ak.user_id = tb.user_id AND ak.exchange = tb.exchange AND ak.is_active = true AND ak.is_testnet = false
WHERE tb.status = 'running'
ORDER BY 
    CASE 
        WHEN ak.id IS NULL THEN 1  -- No keys first
        WHEN ak.is_testnet = true THEN 2  -- Testnet keys (wrong)
        ELSE 3  -- Correct mainnet keys
    END,
    tb.name;

