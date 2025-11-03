# 🚨 URGENT: Fix Bot Execution - "401 Invalid JWT" Error

## Problem Summary

From the logs:
- ✅ **bot-scheduler** is working correctly
- ✅ **bot-scheduler** sends `x-cron-secret` header
- ✅ **bot-scheduler** sends `Authorization: Bearer SERVICE_ROLE_KEY`
- ❌ **bot-executor** returns `401 Invalid JWT`

**Root Cause**: `bot-executor` does NOT have `CRON_SECRET` environment variable set, so it doesn't recognize cron requests and tries to validate SERVICE_ROLE_KEY as a user JWT (which fails).

## 🔧 Fix Steps

### Step 1: Go to Supabase Dashboard

1. Open: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions
2. Click on **`bot-executor`** function
3. Click the **Settings** tab (gear icon)
4. Scroll to **Environment Variables** section

### Step 2: Add CRON_SECRET

1. Click **Add new variable**
2. **Name**: `CRON_SECRET`
3. **Value**: Copy the **EXACT SAME VALUE** from `bot-scheduler`'s `CRON_SECRET`
   - Go to `bot-scheduler` function settings to get the value
   - Or check your `.env` file if you have one locally
4. Click **Save**

### Step 3: Verify Environment Variables in bot-executor

Make sure `bot-executor` has ALL these environment variables:

- ✅ `CRON_SECRET` = `[SAME VALUE AS bot-scheduler]` ⚠️ **CRITICAL - MUST MATCH**
- ✅ `SUPABASE_URL` = `https://dkawxgwdqiirgmmjbvhc.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = `[your-service-role-key]`
- ✅ `SUPABASE_ANON_KEY` = `[your-anon-key]`

### Step 4: Verify bot-scheduler Environment Variables

In `bot-scheduler` function settings, verify:

- ✅ `CRON_SECRET` = `[same value as bot-executor]`
- ✅ `SUPABASE_URL` = `https://dkawxgwdqiirgmmjbvhc.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = `[your-service-role-key]`

## ✅ How to Verify Fix

After setting `CRON_SECRET` in `bot-executor`:

1. Wait for the next cron execution (or manually trigger it)
2. Check **bot-executor** logs - you should see:
   ```
   🔍 [bot-executor] Cron detection:
      x-cron-secret header present: true (length: 65)
      CRON_SECRET env present: true (length: 65)
      Secrets match: true
      Detected as cron: true ✅
   ```

3. Check **bot-executor** logs - should see bot execution logs, NOT "Invalid JWT"

4. Check **bot-scheduler** logs - should show:
   ```
   ✅ [requestId] Bot-executor call completed successfully
   Status: 200 OK (instead of 401)
   ```

## 🔍 Current Log Evidence

From your logs:

**bot-scheduler** (✅ Working):
```
🔐 [88724abe] Environment check:
   CRON_SECRET present: true (length: 65)
   Header secret present: true (length: 65)
   🔑 Secrets match: true ✅
   Headers sent: x-cron-secret=c3f0...f78a, Authorization=Bearer ***
```

**bot-executor** (❌ Failing):
```
Response: {"code": 401, "message": "Invalid JWT"}
```

**Missing logs** from bot-executor:
- No `🔍 [bot-executor] Cron detection:` logs (which means either CRON_SECRET is missing, or the code isn't reached)

## 💡 Why This Happens

The bot-executor code checks:
```typescript
const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
const cronSecretEnv = Deno.env.get('CRON_SECRET') ?? ''
const isCron = !!cronSecretHeader && cronSecretHeader === cronSecretEnv
```

If `CRON_SECRET` env var is missing:
- `cronSecretEnv = ''` (empty string)
- `isCron = false` (because header doesn't match empty string)
- Then it tries to validate `Authorization: Bearer SERVICE_ROLE_KEY` as a user JWT
- SERVICE_ROLE_KEY is not a user JWT → `401 Invalid JWT`

## 📝 Quick Checklist

- [ ] Open Supabase Dashboard → Functions → bot-executor
- [ ] Go to Settings → Environment Variables
- [ ] Add `CRON_SECRET` with same value as bot-scheduler
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is also set
- [ ] Save changes
- [ ] Wait for next cron run or check logs
- [ ] Verify bot-executor logs show `Detected as cron: true`
- [ ] Verify bots start executing again

## 🆘 Still Not Working?

If bots still don't execute after adding `CRON_SECRET`:

1. **Check CRON_SECRET values match exactly** (copy-paste, no extra spaces)
2. **Check bot-executor logs** for the cron detection message
3. **Manually test** by calling bot-executor with `x-cron-secret` header
4. **Check Supabase function logs** for any other errors

---

**Priority**: 🔴 HIGH - Bots cannot execute without this fix!

