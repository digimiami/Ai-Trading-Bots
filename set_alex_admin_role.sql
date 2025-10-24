-- ============================================
-- SET ADMIN ROLE FOR ALEX.JOHNSON@EMAIL.COM
-- Update admin role for the current logged-in user
-- ============================================

-- Check current user status
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'alex.johnson@email.com';

-- Update alex.johnson@email.com to admin role
UPDATE users 
SET role = 'admin'
WHERE email = 'alex.johnson@email.com';

-- Verify the admin role is set
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'alex.johnson@email.com';

-- Show all admin users
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

