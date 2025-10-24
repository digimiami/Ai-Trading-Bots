-- ============================================
-- SET ADMIN ROLE FOR DIGIMIAMI@GMAIL.COM
-- Ensure admin access is properly configured
-- ============================================

-- First, check if the user exists in auth.users
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email = 'digimiami@gmail.com';

-- Check if user exists in users table
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- If user exists in auth.users but not in users table, create the record
INSERT INTO users (id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.email),
    'admin'
FROM auth.users au
WHERE au.email = 'digimiami@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
);

-- Update existing user to admin role if they exist
UPDATE users 
SET role = 'admin'
WHERE email = 'digimiami@gmail.com';

-- Verify the admin role is set
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    au.created_at as auth_created_at
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'digimiami@gmail.com';

-- Show all admin users
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

