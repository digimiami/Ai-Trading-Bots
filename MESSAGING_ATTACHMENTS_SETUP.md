# Messaging Attachments Setup

## Quick Setup (Recommended)

**Just run the SQL script** - it will create everything automatically:

1. Go to **Supabase Dashboard → SQL Editor**
2. Copy and paste the entire contents of `add_attachments_to_messages.sql`
3. Click **Run**

This single script will:
- ✅ Add `attachments` JSONB column to `messages` table
- ✅ Add RLS policies for deleting messages
- ✅ Create index for attachments
- ✅ **Create the `message-attachments` storage bucket**
- ✅ **Set up all storage RLS policies**

## Manual Setup (Alternative)

If you prefer to set up manually:

### Database Migration

Run the SQL script to add attachments support:

```sql
-- Run this in Supabase SQL Editor
-- File: add_attachments_to_messages.sql
```

### Supabase Storage Setup

1. Go to Supabase Dashboard → Storage
2. Click **"New bucket"**
3. Name: `message-attachments`
4. Set to **Public**
5. Click **Create**

The SQL script will automatically create the RLS policies, but if you need to create them manually:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read files (public)
CREATE POLICY "Users can read message attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Features Added

1. **Delete Messages**: Users can delete messages they sent or received. Admins can delete any message.
2. **File Attachments**: Users can attach files when composing messages. Files are uploaded to Supabase Storage and linked in the message.

## Usage

- **Delete Message**: Click the delete icon (trash) next to a message in the list or in the message view
- **Attach Files**: When composing a message, use the file input to select one or more files. Files will be uploaded automatically when sending.

