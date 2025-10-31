# Fix CORS Errors with Supabase

## Problem
You're seeing CORS errors when trying to connect to Supabase from `http://localhost:3000`:
```
Access to fetch at 'https://dkawxgwdqiirgmmjbvhc.supabase.co/auth/v1/token...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Solutions

### Solution 1: Configure Supabase to Allow localhost:3000 (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `dkawxgwdqiirgmmjbvhc`
3. Go to **Settings** → **API**
4. Under **Allowed Origins**, add:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
5. Click **Save**

### Solution 2: Use Default Vite Port (5173)

Change your Vite server to use port 5173 (default), which Supabase usually allows:

1. Edit `vite.config.ts`
2. Change `port: 3000` to `port: 5173`
3. Restart dev server: `npm run dev`
4. Access: `http://localhost:5173`

### Solution 3: Clear Expired Session and Sign In Fresh

The expired session (1446 minutes ago) is causing refresh attempts that fail:

1. Open browser console (F12)
2. Run: `localStorage.clear()`
3. Refresh the page
4. Sign in again with your credentials

### Solution 4: Check Network/Firewall

The 522 errors suggest network connectivity issues:

1. Check if you have a firewall blocking requests
2. Try a different network (mobile hotspot)
3. Check if your ISP or VPN is blocking Supabase
4. Verify Supabase status: https://status.supabase.com

## Quick Fix (Try This First)

1. **Clear expired session:**
   ```javascript
   // In browser console (F12)
   localStorage.clear()
   ```

2. **Refresh the page** and try to sign in again

3. If still having issues, use **Solution 1** to configure Supabase

## Why This Happens

- Supabase has CORS protection that blocks requests from unauthorized origins
- `localhost:3000` might not be in the allowed list
- Expired sessions trigger refresh attempts that fail with CORS errors
- Network/proxy issues can cause 522 errors

## After Fixing

Once CORS is configured, you should:
1. Clear localStorage: `localStorage.clear()`
2. Refresh the page
3. Sign in fresh
4. The app should load normally

