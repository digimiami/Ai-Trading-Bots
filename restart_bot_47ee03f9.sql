-- =====================================================
-- RESTART BOT: 47ee03f9-302e-4b38-bdee-aa3371b598f0
-- =====================================================
-- This script restarts the bot if it was stopped
-- =====================================================

-- 1. Check current status
SELECT 
    id,
    name,
    status,
    updated_at,
    last_trade_at
FROM trading_bots
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 2. Restart bot (set status to 'running')
UPDATE trading_bots
SET 
    status = 'running',
    updated_at = NOW(),
    next_execution_at = NOW()  -- Execute immediately
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 3. Verify status changed
SELECT 
    id,
    name,
    status,
    updated_at,
    next_execution_at
FROM trading_bots
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- =====================================================
-- NOTE: If bot was stopped due to risk management limits,
-- you may need to reset those limits or wait for them
-- to reset (daily limits reset at midnight UTC)
-- =====================================================



