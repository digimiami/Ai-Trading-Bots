-- Check profile data for digimiami@gmail.com
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

-- Also check if there are multiple entries
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email = 'digimiami@gmail.com' THEN 1 END) as digimiami_users
FROM users;

-- Check all users to see if there's confusion
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;

