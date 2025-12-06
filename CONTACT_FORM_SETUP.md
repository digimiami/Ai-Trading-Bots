# Contact Form Setup Guide

## 📋 Overview

The contact form now stores all messages in the database. Messages are saved to the `contact_messages` table and can be viewed by admins.

## 🗄️ Database Setup

### Step 1: Create the Contact Messages Table

Run this SQL in Supabase SQL Editor:

```sql
-- File: create_contact_messages_table.sql
```

Or copy and paste the contents of `create_contact_messages_table.sql` into Supabase SQL Editor.

**What this creates:**
- `contact_messages` table with fields: id, user_id, name, email, subject, message, status, admin_notes, etc.
- Indexes for efficient queries
- RLS policies:
  - Users can view their own messages
  - Anyone can submit contact forms (anonymous allowed)
  - Only admins can view all messages and update status

## 🚀 Edge Function Setup

### Step 2: Deploy the Contact Form Edge Function

```bash
supabase functions deploy contact-form
```

**What this does:**
- Handles POST requests from the contact form
- Validates form data (name, email, subject, message)
- Stores messages in `contact_messages` table
- Links messages to user account if logged in (optional)
- Returns success/error responses

## ✅ Frontend

The frontend (`src/pages/contact/page.tsx`) has been updated to:
- Send form data to the edge function
- Include authentication token if user is logged in
- Handle success/error responses
- Show appropriate messages to users

## 📊 Viewing Contact Messages

### As Admin:

You can query contact messages in Supabase SQL Editor:

```sql
-- View all contact messages
SELECT 
  id,
  name,
  email,
  subject,
  message,
  status,
  user_id,
  created_at
FROM contact_messages
ORDER BY created_at DESC;

-- View unread messages
SELECT * FROM contact_messages
WHERE status = 'new'
ORDER BY created_at DESC;

-- Update message status
UPDATE contact_messages
SET status = 'read',
    updated_at = NOW()
WHERE id = 'message-id-here';

-- Add admin notes
UPDATE contact_messages
SET admin_notes = 'Replied via email on 2024-01-15',
    status = 'replied',
    replied_at = NOW()
WHERE id = 'message-id-here';
```

### Create Admin View (Optional):

You can create an admin page to view and manage contact messages. Here's a simple query to get started:

```sql
-- Get contact messages with user info (if available)
SELECT 
  cm.*,
  u.email as user_email,
  u.full_name as user_name
FROM contact_messages cm
LEFT JOIN users u ON u.id = cm.user_id
ORDER BY cm.created_at DESC;
```

## 🔒 Security

- **RLS Enabled**: Row Level Security ensures users can only see their own messages
- **Admin Access**: Only users with `role = 'admin'` can view all messages
- **Anonymous Submissions**: Contact form works for non-logged-in users
- **Email Validation**: Email format is validated before saving

## 📧 Email Notifications (Optional)

You can add email notifications to the edge function. In `supabase/functions/contact-form/index.ts`, add:

```typescript
// After saving the message, send email notification
if (data) {
  await sendEmailNotification({
    to: 'admin@yourdomain.com',
    subject: `New Contact Form: ${body.subject}`,
    body: `
      Name: ${body.name}
      Email: ${body.email}
      Subject: ${body.subject}
      Message: ${body.message}
    `
  });
}
```

## 🎯 Message Status Flow

1. **new** - Message just received (default)
2. **read** - Admin has read the message
3. **replied** - Admin has replied to the message
4. **archived** - Message is archived (no longer active)

## 📝 Summary

✅ **Database Table**: `contact_messages`  
✅ **Edge Function**: `contact-form`  
✅ **Frontend**: Updated to send to edge function  
✅ **Storage Location**: Supabase PostgreSQL database  
✅ **Access**: Admins can view all messages via SQL queries or admin panel  

**Messages are now stored in the database!** 🎉

