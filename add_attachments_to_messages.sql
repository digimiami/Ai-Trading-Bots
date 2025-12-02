-- =====================================================
-- ADD ATTACHMENTS SUPPORT TO MESSAGES
-- =====================================================
-- Run this in your Supabase SQL Editor

-- Add attachments column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add index for attachments
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages USING GIN (attachments);

-- Add RLS policy for deleting messages
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages they received" ON messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON messages;

-- Users can delete messages they sent
CREATE POLICY "Users can delete their own sent messages" ON messages
    FOR DELETE USING (auth.uid() = sender_id);

-- Users can delete messages they received
CREATE POLICY "Users can delete messages they received" ON messages
    FOR DELETE USING (auth.uid() = recipient_id);

-- Admins can delete any message
CREATE POLICY "Admins can delete any message" ON messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- CREATE STORAGE BUCKET FOR MESSAGE ATTACHMENTS
-- =====================================================

-- Create message-attachments storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Message attachments are publicly viewable" ON storage.objects;

-- Create storage policy for message attachments upload
-- File path structure: messages/{user_id}/{filename}
-- So we check the second folder (index 2) for the user ID
CREATE POLICY "Users can upload message attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'message-attachments' 
  AND (storage.foldername(name))[1] = 'messages'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Create storage policy for message attachments read
CREATE POLICY "Users can read message attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'message-attachments');

-- Create storage policy for message attachments delete
-- File path structure: messages/{user_id}/{filename}
CREATE POLICY "Users can delete their own attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'message-attachments' 
  AND (storage.foldername(name))[1] = 'messages'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Make attachments publicly viewable (since messages can be shared)
CREATE POLICY "Message attachments are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'message-attachments');

