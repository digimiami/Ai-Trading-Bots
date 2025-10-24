-- ============================================
-- SET DIGIMIAMI@GMAIL.COM AS ADMIN
-- Ensure digimiami@gmail.com has admin role
-- ============================================

-- Check if digimiami@gmail.com exists in auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'digimiami@gmail.com';

-- Check if digimiami@gmail.com exists in users table
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

-- Update digimiami@gmail.com to admin role
UPDATE users 
SET role = 'admin'
WHERE email = 'digimiami@gmail.com';

-- Remove admin role from alex.johnson@email.com (set to user)
UPDATE users 
SET role = 'user'
WHERE email = 'alex.johnson@email.com';

-- Verify the admin role is set correctly
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

-- Show all users for reference
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY role DESC, created_at DESC;

