# Fix Domain Authentication Issue - pablobots.net

## Problem
Buttons (start, stop, edit, etc.) don't work when accessing from `https://pablobots.net` but work fine from `http://168.231.114.76:4173`.

## Root Cause
This is likely a **Supabase authentication/redirect URL configuration issue**. When using a custom domain, Supabase needs to know about it in the allowed redirect URLs.

## Solution

### Step 1: Configure Supabase Redirect URLs

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: `dkawxgwdqiirgmmjbvhc`
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Site URL** field, add:
   ```
   https://pablobots.net
   ```
5. In the **Redirect URLs** section, add:
   ```
   https://pablobots.net/**
   https://pablobots.net/auth/callback
   http://168.231.114.76:4173/**
   http://168.231.114.76:4173/auth/callback
   ```
6. Click **Save**

### Step 2: Verify Environment Variables

Make sure your production build has the correct environment variables:

```env
VITE_PUBLIC_SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 3: Clear Browser Data

After updating Supabase settings:

1. Clear browser cache and localStorage for `https://pablobots.net`
2. Log out and log back in
3. Test the buttons again

### Step 4: Check Console for Errors

Open browser DevTools (F12) and check the Console tab for:
- Session errors
- CORS errors
- Network errors

Common errors:
- `No active session` → Supabase redirect URLs not configured
- `CORS error` → Domain not in allowed origins
- `Network error` → Connection issue

## Code Changes Made

The following improvements have been made to handle domain authentication better:

1. **Enhanced Session Handling** (`src/hooks/useBots.ts`):
   - Added automatic session refresh when session expires
   - Better error handling for network/CORS errors
   - More descriptive error messages

2. **Improved Error Messages** (`src/pages/bots/page.tsx`):
   - User-friendly alerts for authentication errors
   - Clear guidance when domain configuration is needed

## Testing

1. Access `https://pablobots.net/bots`
2. Try clicking Start, Stop, Pause buttons
3. Check browser console for any errors
4. If buttons still don't work, check:
   - Supabase redirect URLs are configured
   - Browser localStorage has valid session
   - Network tab shows successful API calls

## Additional Notes

- The IP address (`168.231.114.76:4173`) works because it might be in the default Supabase allowed URLs
- Custom domains need explicit configuration in Supabase
- Session tokens are stored in localStorage and are domain-specific
- After changing Supabase settings, users may need to log out and back in

