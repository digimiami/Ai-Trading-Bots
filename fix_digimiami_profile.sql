-- Fix profile data for digimiami@gmail.com
-- This will ensure the database has the correct information

-- First, check what's currently in the database
SELECT 
    id,
    email,
    name,
    bio,
    location,
    website,
    profile_picture_url,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Update the user record with correct information
UPDATE users 
SET 
    name = 'digimiami',
    email = 'digimiami@gmail.com',
    role = 'admin',
    updated_at = NOW()
WHERE email = 'digimiami@gmail.com';

-- If no record exists, create one
INSERT INTO users (id, email, name, role, created_at, updated_at)
SELECT 
    auth.users.id,
    'digimiami@gmail.com',
    'digimiami',
    'admin',
    NOW(),
    NOW()
FROM auth.users 
WHERE auth.users.email = 'digimiami@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'digimiami@gmail.com'
);

-- Verify the update worked
SELECT 
    id,
    email,
    name,
    bio,
    location,
    website,
    profile_picture_url,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

