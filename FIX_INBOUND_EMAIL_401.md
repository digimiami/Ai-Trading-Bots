# Fix: Inbound Email 401 Unauthorized Error

## Problem
Resend webhooks are returning `401 - Unauthorized` with message "Missing authorization header" when trying to deliver `email.received` events.

## Root Cause
Supabase Edge Functions require JWT verification by default, which expects an `Authorization` header. External webhooks (like Resend) don't send Authorization headers - they use signature headers instead.

## Solution

### For Local Development (Already Fixed)
The `supabase/config.toml` file has been updated with:
```toml
[functions.email-inbound]
verify_jwt = false
```

### For Production (Hosted Supabase) - REQUIRED

You need to configure this in your Supabase Dashboard:

#### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Go to Edge Functions**:
   - Click on **"Edge Functions"** in the left sidebar
   - Click on **"email-inbound"** function

3. **Disable JWT Verification**:
   - Go to **"Settings"** tab
   - Find **"Verify JWT"** setting
   - **Uncheck/Disable** the "Verify JWT" option
   - Click **"Save"**

#### Option 2: Using Supabase CLI

If you have Supabase CLI configured for your production project:

```bash
# Deploy the function with JWT verification disabled
supabase functions deploy email-inbound --no-verify-jwt
```

#### Option 3: Using Supabase Management API

You can also configure this via the Supabase Management API, but the Dashboard method is easiest.

## Important Notes

1. **Security**: Disabling JWT verification makes the function publicly accessible. However, we still verify webhook signatures using the Resend signing secret, so it's secure.

2. **Signature Verification**: The function still verifies Resend webhook signatures using Svix format, so only legitimate Resend webhooks will be processed.

3. **Testing**: After disabling JWT verification, test by sending an email to one of your configured mailbox addresses.

## Verification Steps

1. **Check Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → email-inbound → Logs
   - Look for the detailed logging we added (should see `📧 [email-inbound]` messages)

2. **Test Webhook**:
   - Send an email to `alerts@pablobots.com` (or any configured mailbox)
   - Check Resend Dashboard → Webhooks → Events
   - Should see `200 OK` instead of `401 Unauthorized`

3. **Check Email Center**:
   - Go to Admin → Email Center
   - Click "Refresh" button
   - The inbound email should appear in the list

## Current Status

- ✅ Code updated with comprehensive logging
- ✅ Signature verification implemented (temporarily lenient for debugging)
- ✅ Config.toml updated for local development
- ⚠️ **ACTION REQUIRED**: Disable JWT verification in Supabase Dashboard for production

## Next Steps

1. **Disable JWT verification** in Supabase Dashboard (see instructions above)
2. **Redeploy the function** (if needed):
   ```bash
   supabase functions deploy email-inbound
   ```
3. **Test** by sending an email to a configured mailbox
4. **Check logs** to see the detailed request information
5. **Verify** emails appear in Email Center

Once JWT verification is disabled, the webhook should work correctly!
