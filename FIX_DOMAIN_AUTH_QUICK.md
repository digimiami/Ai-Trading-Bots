# Quick Fix: Domain Authentication Issue

## Problem
✅ Works on IP address (`185.186.25.102`)
❌ Session timeout on domain (`pablobots.net`)

## Solution (2 Steps)

### Step 1: Configure Supabase (REQUIRED)

1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/auth/url-configuration

2. **Add to Site URL:**
   ```
   https://pablobots.net
   ```

3. **Add to Redirect URLs (comma-separated):**
   ```
   https://pablobots.net/**
   https://www.pablobots.net/**
   http://pablobots.net/**
   ```

4. Click **Save**

### Step 2: Clear Browser Data

1. Open browser DevTools (F12)
2. Go to **Application** tab → **Storage** → **Clear site data**
3. Close and reopen browser
4. Visit https://pablobots.net
5. Login again

## Why This Happens

Supabase requires your domain to be in the allowed redirect URL list for security. Without it, sessions may not persist properly.

## Code Changes Made

✅ Increased session timeout to 10 seconds
✅ Added retry logic for session retrieval
✅ Enhanced error logging with helpful messages
✅ Configured PKCE flow for better domain compatibility

## Test

After configuring Supabase:
1. Visit https://pablobots.net
2. Login
3. Refresh page (F5)
4. Should stay logged in ✅

If still not working, check browser console for specific errors.

