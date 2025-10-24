-- Fix OKX API configuration issues
-- This will help identify and resolve OKX API problems

-- Check current OKX API key status
SELECT 
    'OKX API STATUS' as info_type,
    exchange,
    api_key,
    CASE 
        WHEN api_key IS NULL OR api_key = '' THEN 'MISSING API KEY'
        WHEN LENGTH(api_key) < 20 THEN 'INVALID API KEY LENGTH'
        ELSE 'API KEY PRESENT'
    END as api_key_status,
    is_testnet,
    is_active,
    created_at,
    updated_at
FROM api_keys 
WHERE exchange = 'okx'
ORDER BY updated_at DESC;

-- Check OKX bots and their status
SELECT 
    'OKX BOTS STATUS' as info_type,
    id,
    name,
    symbol,
    exchange,
    status,
    trade_amount,
    leverage,
    created_at
FROM trading_bots 
WHERE exchange = 'okx'
ORDER BY created_at DESC;

-- Show recent OKX trade errors
SELECT 
    'RECENT OKX ERRORS' as info_type,
    symbol,
    exchange,
    status,
    error_message,
    executed_at
FROM trades 
WHERE exchange = 'okx' 
AND status = 'failed'
AND executed_at >= NOW() - INTERVAL '24 hours'
ORDER BY executed_at DESC;

-- Recommendations for OKX API setup
SELECT 
    'OKX API SETUP RECOMMENDATIONS' as info_type,
    '1. Get API keys from OKX exchange' as step_1,
    '2. Enable futures trading permissions' as step_2,
    '3. Set IP whitelist (optional but recommended)' as step_3,
    '4. Use testnet first to verify setup' as step_4,
    '5. Update API keys in Settings page' as step_5;

-- Disable OKX bots temporarily if API issues persist
UPDATE trading_bots 
SET 
    status = 'paused',
    updated_at = NOW()
WHERE exchange = 'okx' 
AND status = 'active';

-- Verify OKX bots are paused
SELECT 
    'OKX BOTS PAUSED' as info_type,
    COUNT(*) as paused_okx_bots,
    'All OKX bots have been paused due to API issues' as status
FROM trading_bots 
WHERE exchange = 'okx' 
AND status = 'paused';
