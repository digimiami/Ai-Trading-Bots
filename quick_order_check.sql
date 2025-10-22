-- ============================================
-- QUICK ORDER CHECK - Simple & Fast
-- Run this for instant order status
-- ============================================

-- QUICK SUMMARY
SELECT 
    'ORDERS TODAY' as metric,
    COUNT(*) as count
FROM orders
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'FILLED TODAY',
    COUNT(*)
FROM orders
WHERE created_at >= CURRENT_DATE AND status = 'filled'
UNION ALL
SELECT 
    'FAILED TODAY',
    COUNT(*)
FROM orders
WHERE created_at >= CURRENT_DATE AND status = 'failed'
UNION ALL
SELECT 
    'LAST HOUR',
    COUNT(*)
FROM orders
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- ============================================
-- LAST 10 ORDERS
SELECT 
    id,
    created_at,
    exchange,
    symbol,
    side,
    quantity,
    status,
    CASE 
        WHEN error_message IS NOT NULL THEN LEFT(error_message, 50)
        ELSE 'Success'
    END as result
FROM orders
ORDER BY created_at DESC
LIMIT 10;

