-- ============================================
-- DELETE USER: alex.johnson@email.com
-- Find user ID and prepare for deletion
-- ============================================

-- Step 1: Find the user ID for alex.johnson@email.com
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    au.id as auth_user_id,
    au.email as auth_email
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'alex.johnson@email.com'
   OR au.email = 'alex.johnson@email.com';

-- Step 2: Check related data that will be affected
-- (This helps understand what will be deleted via cascade)
SELECT 
    'trading_bots' as table_name,
    COUNT(*) as count
FROM public.trading_bots
WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'alex.johnson@email.com'
    UNION
    SELECT id FROM auth.users WHERE email = 'alex.johnson@email.com'
)
UNION ALL
SELECT 
    'trades' as table_name,
    COUNT(*) as count
FROM public.trades
WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'alex.johnson@email.com'
    UNION
    SELECT id FROM auth.users WHERE email = 'alex.johnson@email.com'
)
UNION ALL
SELECT 
    'paper_positions' as table_name,
    COUNT(*) as count
FROM public.paper_positions
WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'alex.johnson@email.com'
    UNION
    SELECT id FROM auth.users WHERE email = 'alex.johnson@email.com'
);

-- Step 3: Show user's bots before deletion
SELECT 
    id,
    name,
    symbol,
    status,
    created_at
FROM public.trading_bots
WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'alex.johnson@email.com'
    UNION
    SELECT id FROM auth.users WHERE email = 'alex.johnson@email.com'
)
ORDER BY created_at DESC;
