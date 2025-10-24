-- ============================================
-- PROFILE MANAGEMENT SCHEMA UPDATE
-- Add profile fields to users table
-- ============================================

-- Add new profile columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create profile-images storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for profile images
CREATE POLICY IF NOT EXISTS "Users can upload their own profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Profile images are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-images');

-- Update existing users with default values if needed
UPDATE users 
SET 
  bio = COALESCE(bio, ''),
  location = COALESCE(location, ''),
  website = COALESCE(website, ''),
  profile_picture_url = COALESCE(profile_picture_url, '')
WHERE bio IS NULL OR location IS NULL OR website IS NULL OR profile_picture_url IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if columns were added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('bio', 'location', 'website', 'profile_picture_url')
ORDER BY column_name;

-- Check storage bucket exists
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'profile-images';

-- Check storage policies exist
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%profile%';

