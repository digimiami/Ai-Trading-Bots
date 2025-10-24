-- ============================================
-- CHECK ADMIN USER STATUS
-- Verify digimiami@gmail.com admin access
-- ============================================

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

-- Check all users with admin role
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Check all users in the system
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;

-- Check if user exists in auth.users but not in users table
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    u.role,
    u.created_at as user_created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = 'digimiami@gmail.com';

