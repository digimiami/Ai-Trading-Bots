# Resend Webhook Setup for Inbound Emails

## Overview
This guide explains how to configure Resend webhooks to receive inbound emails in your Pablo AI Trading application.

## Important Configuration Notes

### 1. Webhook URL
Your Resend webhook URL should point to your Supabase Edge Function, NOT to `https://pablobots.com`.

**Correct URL format:**
```
https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/email-inbound
```

**Example:**
```
https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/email-inbound
```

### 2. Webhook Events
For **inbound emails**, you need to configure the `email.received` event, NOT `contact.created` or `contact.deleted`.

**Required Event:**
- ✅ `email.received` - This event fires when an email is received

**Optional Events (for tracking):**
- `email.sent` - When an email is sent
- `email.delivered` - When an email is delivered
- `email.bounced` - When an email bounces
- `email.complained` - When someone marks email as spam

### 3. Signing Secret Configuration

The signing secret you added to Edge Function Secrets should be named one of:
- `RESEND_WEBHOOK_SECRET` (preferred)
- `EMAIL_WEBHOOK_SECRET` (fallback)
- `Signing Secret` (fallback)

**Format:** The secret should be in the format `whsec_...` (as shown in Resend dashboard)

**Example:**
```
whsec_TNJdliWvqo5zojXJiesDylsgmBiSgFhg
```

## Setup Steps

### Step 1: Get Your Supabase Edge Function URL
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **email-inbound**
3. Copy the function URL (should look like: `https://<project>.supabase.co/functions/v1/email-inbound`)

### Step 2: Configure Resend Webhook
1. Go to [Resend Dashboard](https://resend.com/webhooks)
2. Click **"Create Webhook"** or edit your existing webhook
3. Set the **Webhook URL** to your Supabase Edge Function URL (from Step 1)
4. Select the **`email.received`** event (and any other events you want to track)
5. Copy the **Signing Secret** (starts with `whsec_`)

### Step 3: Add Signing Secret to Supabase
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **email-inbound** → **Settings** → **Secrets**
3. Add a new secret:
   - **Name:** `RESEND_WEBHOOK_SECRET`
   - **Value:** The signing secret from Resend (including `whsec_` prefix)
4. Click **Save**

### Step 4: Create Mailboxes in Your App
1. Go to **Admin** → **Email Center** in your application
2. Click **"Manage Mailboxes"**
3. Create a mailbox with the email address that will receive inbound emails
4. Make sure the mailbox is **Active**

### Step 5: Configure Domain in Resend
1. In Resend Dashboard, go to **Domains**
2. Add and verify your domain (e.g., `pablobots.com`)
3. Configure DNS records as instructed by Resend
4. Once verified, you can receive emails to addresses on that domain

## Testing

### Test Inbound Email Flow
1. Send an email to one of your configured mailbox addresses (e.g., `support@pablobots.com`)
2. Check the **Email Center** in your admin panel
3. The email should appear in the **Inbound Emails** list
4. Check Supabase Edge Function logs for any errors

### Check Webhook Delivery
1. In Resend Dashboard, go to your webhook settings
2. Check the **"Webhook Events"** section
3. You should see events being delivered when emails are received
4. If events show as failed, check the error message and Supabase logs

## Troubleshooting

### Issue: No inbound emails appearing
**Possible causes:**
- Webhook URL is incorrect (should be Supabase Edge Function URL, not `pablobots.com`)
- Wrong event type configured (should be `email.received`)
- Mailbox not created or not active in the app
- Domain not verified in Resend
- Signing secret mismatch

**Solutions:**
1. Verify webhook URL in Resend matches your Supabase Edge Function URL
2. Ensure `email.received` event is selected
3. Create and activate a mailbox in Email Center
4. Verify domain in Resend Dashboard
5. Check that signing secret in Supabase matches Resend

### Issue: Signature verification failing
**Possible causes:**
- Signing secret not added to Edge Function Secrets
- Secret name mismatch (should be `RESEND_WEBHOOK_SECRET`)
- Secret value incorrect (should include `whsec_` prefix)

**Solutions:**
1. Verify secret is added in Supabase Edge Function Secrets
2. Check secret name matches `RESEND_WEBHOOK_SECRET`
3. Ensure secret value includes the full `whsec_...` value from Resend

### Issue: Webhook events not showing in Resend
**Possible causes:**
- No emails being sent to configured addresses
- Domain not receiving emails
- Webhook URL returning errors

**Solutions:**
1. Send a test email to your mailbox address
2. Check Resend webhook logs for delivery status
3. Check Supabase Edge Function logs for errors
4. Verify webhook URL is accessible

## Current Configuration Status

Based on your screenshot:
- ✅ Signing Secret added to Edge Function Secrets
- ⚠️ Webhook URL needs to be updated to Supabase Edge Function URL
- ⚠️ Events need to include `email.received` (currently only has `contact.created`, `contact.deleted`)

## Next Steps

1. **Update Webhook URL** in Resend to point to your Supabase Edge Function
2. **Add `email.received` event** to your webhook configuration
3. **Create a mailbox** in Email Center with the email address you want to receive emails
4. **Test** by sending an email to that address
5. **Check** Email Center for inbound emails
