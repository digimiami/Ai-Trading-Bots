# Domain Authentication Fix - Complete

## Problem Identified
- ✅ Login works on IP address
- ✅ Login works on domain (pablobots.net)
- ✅ Session stored in localStorage successfully
- ❌ After page refresh on domain, `getSession()` times out
- ❌ Session exists in localStorage but not restored

## Root Cause
The `supabase.auth.getSession()` call was timing out (likely due to network/CORS issues with the domain), even though the session was successfully stored in localStorage.

## Solution Implemented

### 1. **localStorage Session Fallback**
   - Added `restoreSessionFromStorage()` function
   - Automatically detects session in localStorage when `getSession()` times out
   - Checks all keys starting with `sb-` (Supabase storage format)
   - Validates token expiration before restoring
   - Uses `setSession()` to properly restore session to Supabase client

### 2. **Improved Timeout Handling**
   - Added `Promise.race()` with 5-second timeout for `getSession()`
   - If timeout occurs, automatically tries localStorage fallback
   - Increased overall timeout to 8 seconds (from 5)
   - Added retry logic with localStorage check

### 3. **Fixed Storage Key Detection**
   - Correctly extracts project ref from Supabase URL
   - Uses proper storage key format: `sb-{project-ref}-auth-token`
   - Checks multiple possible storage keys as fallback

### 4. **Enhanced Logging**
   - Added detailed console logs for debugging
   - Shows which localStorage keys are checked
   - Logs session validation and restoration

## Code Changes

### `src/hooks/useAuth.ts`
- Added `restoreSessionFromStorage()` function
- Updated session loading to use Promise.race with timeout
- Added automatic localStorage fallback on timeout
- Enhanced error handling with retry logic

### `src/lib/supabase.ts`
- Fixed storage key to use project ref format
- Added proper storage key detection: `sb-{project-ref}-auth-token`

## How It Works Now

1. **Initial Load:**
   - Tries `getSession()` with 5-second timeout
   - If timeout → checks localStorage
   - If session found in localStorage → restores it
   - Sets session in Supabase client using `setSession()`

2. **On Timeout:**
   - Automatically checks localStorage
   - Validates token expiration
   - Restores session if valid
   - Updates user state with role

3. **Session Validation:**
   - Checks `expires_at` timestamp
   - Only restores if token not expired
   - Handles both Unix timestamp formats

## Testing

After deploying this fix:

1. **Clear browser cache/cookies** (optional)
2. Visit https://pablobots.net
3. Login with credentials
4. **Refresh page (F5)**
5. Should see in console:
   - `🔍 Checking localStorage keys: ...`
   - `✅ Session restored from localStorage`
   - `✅ User loaded from storage`

6. Should stay logged in ✅

## Expected Console Output

On successful restore:
```
🔍 Checking localStorage keys: ['sb-dkawxgwdqiirgmmjbvhc-auth-token'] Expected: sb-dkawxgwdqiirgmmjbvhc-auth-token
🔍 Found session in localStorage: sb-dkawxgwdqiirgmmjbvhc-auth-token
✅ Session valid, expires in 3599 seconds
✅ Session restored to Supabase client
✅ Restored session from localStorage: digimiami@gmail.com
✅ User loaded from storage: { email: 'digimiami@gmail.com', role: 'admin' }
```

## If Still Not Working

1. **Check Browser Console:**
   - Look for `🔍 Checking localStorage keys` message
   - Verify which keys are found
   - Check for any errors in session restoration

2. **Verify localStorage:**
   ```javascript
   // In browser console
   Object.keys(localStorage).filter(k => k.startsWith('sb-'))
   // Should show: ['sb-dkawxgwdqiirgmmjbvhc-auth-token']
   ```

3. **Check Token Expiration:**
   ```javascript
   // In browser console
   const session = JSON.parse(localStorage.getItem('sb-dkawxgwdqiirgmmjbvhc-auth-token'))
   console.log('Expires at:', new Date(session.expires_at * 1000))
   console.log('Current time:', new Date())
   console.log('Is expired:', session.expires_at * 1000 < Date.now())
   ```

The authentication should now work reliably on your domain! 🎉

