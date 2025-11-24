# 🚨 Fix bot-executor BOOT_ERROR (503 Service Unavailable)

## Problem
The `bot-executor` Edge Function is returning:
```
503 Service Unavailable
{"code":"BOOT_ERROR","message":"Function failed to start (please check logs)"}
```

## Step 1: Check Supabase Edge Function Logs

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions

2. **Click on `bot-executor` function**

3. **Go to "Logs" tab**

4. **Filter by:**
   - Level: `error` or `fatal`
   - Time: Last 1 hour

5. **Look for errors like:**
   - Syntax errors
   - Import errors
   - Module not found
   - Runtime errors during initialization

## Step 2: Common Causes & Fixes

### Cause 1: Function Too Large
**Symptom:** Function file is > 1MB or takes too long to initialize

**Fix:** The function is 431KB which should be fine, but if logs show timeout, we may need to optimize.

### Cause 2: Syntax/Runtime Error
**Symptom:** Logs show specific error message

**Fix:** Fix the error shown in logs

### Cause 3: Import Error
**Symptom:** Logs show "Cannot find module" or import errors

**Fix:** Check imports at top of file

### Cause 4: Environment Variable Missing
**Symptom:** Function tries to access undefined env var during init

**Fix:** Check all required env vars are set

## Step 3: Quick Fix - Redeploy Function

If logs don't show clear errors, try redeploying:

### Option A: Via Supabase Dashboard
1. Go to Edge Functions → `bot-executor`
2. Click "Deploy" or "Redeploy"
3. Wait for deployment to complete
4. Check logs again

### Option B: Via CLI
```bash
npx supabase functions deploy bot-executor --project-ref dkawxgwdqiirgmmjbvhc
```

## Step 4: Verify Function is Working

After redeploy, test:
```bash
curl -X GET "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor?action=time" \
  -H "apikey: YOUR_ANON_KEY"
```

**Expected:** Should return time sync response, not 503 error

## Step 5: If Still Failing

If the function still fails to boot after redeploy:

1. **Check the exact error in Supabase logs**
2. **Share the error message** - it will tell us what's wrong
3. **Check if function file size is the issue** (should be < 1MB)

## Temporary Workaround

While fixing bot-executor:
- **Backtesting still works** (uses different endpoint)
- **Paper trading bots** will still execute via cron job (bot-scheduler calls bot-executor)
- **Frontend time sync** will fail (but this is non-critical)

The 503 error only affects:
- Frontend time synchronization
- Manual bot execution from frontend
- Some admin features

**Bot execution via cron job should still work** if bot-scheduler can call bot-executor.

