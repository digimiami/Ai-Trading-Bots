# Email System Setup Guide

This guide explains how to set up the Email Center feature in Pablo Bots Admin, which supports both **outbound** (Level 1) and **inbound** (Level 2) email management.

## Overview

The Email Center allows admins to:
- **Send emails** from custom domains (e.g., `no-reply@pablobots.com`, `support@pablobots.com`)
- **Receive and reply** to emails sent to these addresses
- **View email history** (both sent and received)
- **Manage mailboxes** from the admin dashboard

## Prerequisites

1. **Resend Account** (or Mailgun/Postmark/SendGrid)
   - Sign up at [resend.com](https://resend.com)
   - Verify your domain (e.g., `pablobots.com`)
   - Get your API key

2. **Supabase Project**
   - Database tables already created (via migration)
   - Edge Functions deployed

## Step 1: Configure Resend API Key

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add the following secret:
   ```
   RESEND_API_KEY=re_your_api_key_here
   ```

## Step 2: Set Up Default Mailboxes

The migration already creates default mailboxes:
- `no-reply@pablobots.com` - For automated notifications
- `support@pablobots.com` - For customer support
- `alerts@pablobots.com` - For bot alerts

**Important:** Make sure these email addresses are verified in Resend:
1. Go to Resend Dashboard → **Domains**
2. Add and verify `pablobots.com` (or your domain)
3. Configure DNS records as instructed by Resend

## Step 3: Deploy Edge Functions

Deploy the following Edge Functions to Supabase:

### 3.1 Deploy `admin-email` Function

This function handles:
- Sending emails (outbound)
- Fetching mailboxes
- Fetching email history

```bash
supabase functions deploy admin-email
```

Or via Supabase Dashboard:
1. Go to **Edge Functions**
2. Create new function: `admin-email`
3. Copy contents from `supabase/functions/admin-email/index.ts`

### 3.2 Deploy `email-inbound` Function

This function handles:
- Receiving inbound emails via webhook
- Storing emails in database

```bash
supabase functions deploy email-inbound
```

Or via Supabase Dashboard:
1. Go to **Edge Functions**
2. Create new function: `email-inbound`
3. Copy contents from `supabase/functions/email-inbound/index.ts`

### 3.3 Set Webhook Secret (Optional but Recommended)

Add a secret for webhook authentication:

```bash
EMAIL_WEBHOOK_SECRET=your-random-secret-here
```

## Step 4: Configure Inbound Email Webhook (Level 2)

To enable **inbound email** (receiving emails), configure your email provider:

### Option A: Resend (Recommended)

1. Go to Resend Dashboard → **Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/email-inbound`
   - **Events**: Select `email.received`
   - **Secret**: (Optional) Use the `EMAIL_WEBHOOK_SECRET` you set in Supabase
4. Save the webhook

### Option B: Mailgun

1. Go to Mailgun Dashboard → **Receiving** → **Routes**
2. Create a new route:
   - **Expression**: `match_recipient("support@pablobots.com")`
   - **Action**: `forward("https://your-project.supabase.co/functions/v1/email-inbound")`
3. Save the route

### Option C: Postmark

1. Go to Postmark Dashboard → **Servers** → **Inbound**
2. Configure inbound webhook:
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/email-inbound`
   - **HTTP Auth**: (Optional) Use `EMAIL_WEBHOOK_SECRET`

## Step 5: Test the Setup

### Test Outbound Email (Level 1)

1. Log in to Pablo Bots Admin
2. Navigate to **Email Center** tab
3. Click **Compose Email**
4. Fill in:
   - **From**: Select a mailbox (e.g., `support@pablobots.com`)
   - **To**: Your test email address
   - **Subject**: Test Email
   - **Body**: Test message
5. Click **Send Email**
6. Check your inbox for the email

### Test Inbound Email (Level 2)

1. Send an email to `support@pablobots.com` from an external email address
2. Wait a few seconds for the webhook to process
3. In Admin → **Email Center**, filter by **Inbound**
4. You should see the received email
5. Click on it to view details
6. Click **Reply** to respond

## Usage Guide

### Sending Emails

1. **Compose Email**:
   - Select **From** address (must be a verified mailbox)
   - Enter **To** (comma-separated for multiple recipients)
   - Add **CC/BCC** if needed
   - Write **Subject** and **Body** (HTML or plain text)

2. **Email History**:
   - View all sent emails in the **Outbound** filter
   - Filter by mailbox or date range
   - Click on any email to view details

### Receiving Emails

1. **Inbox View**:
   - Filter by **Inbound** to see received emails
   - Filter by mailbox to see emails for specific addresses
   - Click on an email to view full content

2. **Replying**:
   - Click **Reply** on any inbound email
   - The compose form will auto-fill:
     - **To**: Original sender
     - **Subject**: "Re: [original subject]"
     - **Reply-To**: Original sender's address

### Managing Mailboxes

Default mailboxes are created automatically. To add more:

1. Go to Supabase Dashboard → **Table Editor** → `mailboxes`
2. Insert a new row:
   ```sql
   INSERT INTO mailboxes (email_address, display_name, is_active)
   VALUES ('sales@pablobots.com', 'Pablo Bots - Sales', true);
   ```
3. Verify the email address in Resend
4. Refresh the Email Center to see the new mailbox

## Troubleshooting

### Emails Not Sending

1. **Check Resend API Key**:
   - Verify `RESEND_API_KEY` is set in Supabase secrets
   - Test the API key in Resend dashboard

2. **Check Domain Verification**:
   - Ensure domain is verified in Resend
   - Check DNS records are correct

3. **Check Edge Function Logs**:
   - Go to Supabase Dashboard → **Edge Functions** → **Logs**
   - Look for error messages

### Inbound Emails Not Appearing

1. **Check Webhook Configuration**:
   - Verify webhook URL is correct
   - Check webhook is active in Resend/Mailgun/Postmark

2. **Check Webhook Secret**:
   - If using a secret, ensure it matches in both places
   - Check Edge Function logs for authentication errors

3. **Test Webhook Manually**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/email-inbound \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: your-secret" \
     -d '{
       "type": "email.received",
       "data": {
         "from": "test@example.com",
         "to": "support@pablobots.com",
         "subject": "Test",
         "text": "Test message"
       }
     }'
   ```

### Email Not Found in Database

1. **Check RLS Policies**:
   - Ensure admin user has access
   - Check `mailboxes` and `emails` table policies

2. **Check Mailbox Status**:
   - Ensure mailbox `is_active = true`
   - Verify email address matches exactly

## Security Considerations

1. **Webhook Secret**: Always use a webhook secret for production
2. **RLS Policies**: Only admins can access emails
3. **API Keys**: Never commit API keys to git
4. **Domain Verification**: Only use verified domains

## Next Steps (Level 3 - Optional)

For advanced mailbox management (creating/deleting mailboxes programmatically), you would need:
- A mail server API (Mailcow, iRedMail, etc.)
- Additional Edge Functions to manage mailboxes
- Integration with your mail server's API

This is beyond the current implementation but can be added if needed.

## Support

For issues or questions:
1. Check Edge Function logs in Supabase
2. Review Resend/Mailgun/Postmark webhook logs
3. Check browser console for frontend errors
4. Verify database tables and RLS policies

---

**Note**: This implementation supports **Level 1 (Outbound)** and **Level 2 (Inbound)** email management. Level 3 (full mailbox management) requires additional infrastructure.


