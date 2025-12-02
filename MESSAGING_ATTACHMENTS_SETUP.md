# Messaging Attachments Setup

## Database Migration

Run the SQL script to add attachments support:

```sql
-- Run this in Supabase SQL Editor
-- File: add_attachments_to_messages.sql
```

This will:
- Add `attachments` JSONB column to `messages` table
- Add RLS policies for deleting messages
- Create index for attachments

## Supabase Storage Setup

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `message-attachments`
3. Set bucket to **Public** (or configure RLS policies if you want private)
4. Configure RLS policies for the bucket:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Allow authenticated users to read files
CREATE POLICY "Users can read message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## Features Added

1. **Delete Messages**: Users can delete messages they sent or received. Admins can delete any message.
2. **File Attachments**: Users can attach files when composing messages. Files are uploaded to Supabase Storage and linked in the message.

## Usage

- **Delete Message**: Click the delete icon (trash) next to a message in the list or in the message view
- **Attach Files**: When composing a message, use the file input to select one or more files. Files will be uploaded automatically when sending.

