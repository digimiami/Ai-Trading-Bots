# 🔧 Fix: bot-executor Returns "401 Invalid JWT" Error

## Problem Identified

From the logs:
- ✅ bot-scheduler successfully authenticates
- ✅ bot-scheduler calls bot-executor with `x-cron-secret` header
- ✅ bot-scheduler sends `Authorization: Bearer SERVICE_ROLE_KEY`
- ❌ bot-executor returns `401 Unauthorized: Invalid JWT`

## Root Cause

**bot-executor is NOT recognizing the request as a cron job**, so it's trying to validate the `SERVICE_ROLE_KEY` as a user JWT token, which fails.

The bot-executor code checks:
```typescript
const isCron = !!cronSecretHeader && cronSecretHeader === (Deno.env.get('CRON_SECRET') ?? '')
```

This means:
- `x-cron-secret` header must match `CRON_SECRET` environment variable in **bot-executor**
- If they don't match (or CRON_SECRET is missing), `isCron = false`
- When `isCron = false`, it tries to validate the Authorization header as a user JWT
- SERVICE_ROLE_KEY is not a user JWT, so it fails with "Invalid JWT"

## Solution

**bot-executor needs `CRON_SECRET` environment variable set!**

### Step 1: Set CRON_SECRET in bot-executor

1. Go to **Supabase Dashboard** → **Edge Functions** → **`bot-executor`**
2. Click **Settings** tab
3. Scroll to **Environment Variables** section
4. Click **Add new variable**:
   - **Name**: `CRON_SECRET`
   - **Value**: (same value as in bot-scheduler)
5. Click **Save**

**Important**: The `CRON_SECRET` value in bot-executor **MUST MATCH** the value in bot-scheduler!

### Step 2: Verify CRON_SECRET in Both Functions

**bot-scheduler environment variables:**
- `CRON_SECRET` = `[your-secret-value]`
- `SUPABASE_URL` = `https://dkawxgwdqiirgmmjbvhc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `[your-service-key]`

**bot-executor environment variables:**
- `CRON_SECRET` = `[SAME VALUE as bot-scheduler]` ⚠️ **MUST MATCH**
- `SUPABASE_URL` = `https://dkawxgwdqiirgmmjbvhc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `[your-service-key]`
- `SUPABASE_ANON_KEY` = `[your-anon-key]`

### Step 3: Verify bot-executor Has SERVICE_ROLE_KEY

The bot-executor also needs `SUPABASE_SERVICE_ROLE_KEY` to be set (for when `isCron = true`).

## Expected Behavior After Fix

Once `CRON_SECRET` is set in bot-executor:

1. bot-scheduler calls bot-executor with `x-cron-secret` header
2. bot-executor checks: `x-cron-secret === CRON_SECRET` → `true`
3. `isCron = true`
4. bot-executor uses `SERVICE_ROLE_KEY` instead of validating user JWT
5. Request succeeds ✅
6. Bots execute ✅

## Verification

After setting `CRON_SECRET` in bot-executor, check the logs:

**bot-executor logs should show:**
```
🔍 [bot-executor] Cron detection:
   x-cron-secret header present: true (length: 65)
   CRON_SECRET env present: true (length: 65)
   Secrets match: true
   Detected as cron: true  ✅
🚀 === BOT EXECUTION STARTED ===
🔐 Auth mode: CRON (service role) ✅
```

Instead of:
```
🔍 [bot-executor] Cron detection:
   x-cron-secret header present: true
   CRON_SECRET env present: false  ❌ (or length: 0)
   Secrets match: false
   Detected as cron: false  ❌
```

## Quick Test

After setting the environment variable, wait for the next cron run, or manually trigger bot-scheduler and check bot-executor logs.

The enhanced logging we added will now show exactly what's happening with cron detection!

