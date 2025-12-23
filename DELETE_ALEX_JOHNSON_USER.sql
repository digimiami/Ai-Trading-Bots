-- ============================================
-- DELETE USER: alex.johnson@email.com
-- ============================================
-- 
-- IMPORTANT: This script requires admin privileges.
-- For proper audit logging, use the admin interface instead.
-- 
-- This script will:
-- 1. Find the user ID for alex.johnson@email.com
-- 2. Show related data counts
-- 3. Delete the user (auth.users deletion requires Admin API)
-- ============================================

-- Step 1: Find and display user information
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    (SELECT COUNT(*) FROM public.trading_bots WHERE user_id = u.id) as bot_count,
    (SELECT COUNT(*) FROM public.trades WHERE user_id = u.id) as trade_count,
    (SELECT COUNT(*) FROM public.paper_positions WHERE user_id = u.id) as paper_position_count
FROM public.users u
WHERE u.email = 'alex.johnson@email.com';

-- Step 2: Get the user ID (save this for the deletion)
-- Copy the user_id from the query above

-- Step 3: Delete from users table (cascade will handle related data)
-- Replace 'USER_ID_HERE' with the actual user ID from Step 1
DELETE FROM public.users WHERE email = 'alex.johnson@email.com';

-- Step 4: Delete from auth.users using Admin API
-- NOTE: Direct SQL deletion from auth.users may not work due to RLS.
-- You need to use the Supabase Admin API or the admin Edge Function.
-- 
-- To delete from auth.users, use one of these methods:
-- 
-- Method A: Use the admin Edge Function (recommended)
-- Call: POST /functions/v1/admin-management-enhanced
-- Body: { "action": "deleteUser", "userId": "USER_ID_HERE" }
--
-- Method B: Use Supabase Admin API directly
-- DELETE https://your-project.supabase.co/auth/v1/admin/users/USER_ID_HERE
-- Headers: Authorization: Bearer SERVICE_ROLE_KEY

-- Verification: Check if user still exists
SELECT 
    'users table' as source,
    id,
    email
FROM public.users
WHERE email = 'alex.johnson@email.com'
UNION ALL
SELECT 
    'auth.users' as source,
    id::text,
    email
FROM auth.users
WHERE email = 'alex.johnson@email.com';








