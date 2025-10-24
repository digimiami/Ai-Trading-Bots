-- ============================================
-- CHECK DIGIMIAMI@GMAIL.COM STATUS
-- Verify if the account exists and is properly set up
-- ============================================

-- Check if digimiami@gmail.com exists in auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'digimiami@gmail.com';

-- Check if digimiami@gmail.com exists in users table
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Check if user exists in auth.users but not in users table
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.created_at as auth_created_at,
    u.id as user_id,
    u.role as user_role,
    u.created_at as user_created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = 'digimiami@gmail.com';

-- Show all users in auth.users
SELECT 
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- Show all users in users table
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;

