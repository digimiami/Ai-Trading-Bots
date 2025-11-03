# 🔧 Fix: Bots Not Executing Trades

## Problems Identified

1. ✅ **SQL Query Fixed**: Changed `strategyConfig` → `strategy_config`
2. ❌ **Bot-Scheduler Not Logging**: Function boots but no execution logs appear
3. ❌ **Bot-Executor Not Receiving Calls**: Only time sync logs, no `🚀 === BOT EXECUTION STARTED ===`

## Root Cause

The `bot-scheduler` function (ID: `eae20051-b7b3-45fa-8b4c-ba35ed341d1c`) is running every ~10 minutes but:
- ✅ Function boots (we see `booted` logs)
- ❌ **No execution logs** (`📅 Bot Scheduler called at:`, `🚀 Calling bot-executor`)
- ❌ Function likely failing at **CRON_SECRET check** (line 31-34)

This means:
- The scheduled trigger IS calling bot-scheduler
- But the function returns early due to missing/incorrect `x-cron-secret` header

## Solutions

### Solution 1: Check Cron Secret Configuration

1. **Go to Supabase Dashboard** → Edge Functions → `bot-scheduler`
2. **Check Environment Variables**:
   - `CRON_SECRET` should be set
   - Note the value (e.g., `my-secret-key-123`)

3. **Check Schedule Configuration**:
   - Go to "Schedule" tab
   - Check if schedule exists
   - **Critical**: Verify the header `x-cron-secret` matches the `CRON_SECRET` env var

### Solution 2: Check bot-scheduler Logs for Errors

1. Go to **Edge Functions** → `bot-scheduler` → **Logs**
2. Filter by **Level: error** or search for `❌`
3. Look for:
   - `❌ Unauthorized: CRON_SECRET mismatch or missing`
   - `❌ SUPABASE_URL is not set`

If you see these errors, that's the problem!

### Solution 3: Manually Test bot-scheduler

Test if bot-scheduler works when called directly:

**Option A: Via Supabase Dashboard**
1. Edge Functions → `bot-scheduler` → "Invoke Function"
2. Headers:
   ```
   x-cron-secret: YOUR_CRON_SECRET_VALUE
   ```
3. Click "Invoke"
4. Check logs - should see:
   - `📅 Bot Scheduler called at:`
   - `🚀 Calling bot-executor at:`

**Option B: Via curl**
```bash
curl -X POST \
  'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler' \
  -H 'x-cron-secret: YOUR_CRON_SECRET_VALUE'
```

### Solution 4: Update bot-scheduler to Log More

The function might be failing silently. Add more logging (we can update the function if needed).

## Immediate Action Items

### Step 1: Check Your Bot Status
Run the fixed SQL query (`check-bots-status.sql`) to see:
- How many bots you have
- Which ones are `running`
- Recent trade activity

### Step 2: Check bot-scheduler Configuration

**Verify Environment Variables:**
```sql
-- Check if function has secrets set (this won't show values, but confirms they exist)
-- Run in Supabase SQL Editor or check Dashboard
```

In Supabase Dashboard:
1. Edge Functions → `bot-scheduler` → Settings
2. Check "Environment Variables"
3. Should have:
   - `CRON_SECRET` (some value)
   - `SUPABASE_URL` (`https://dkawxgwdqiirgmmjbvhc.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` (if needed)

### Step 3: Verify Schedule Has Correct Header

1. Edge Functions → `bot-scheduler` → Schedule tab
2. Click on the schedule
3. Check "Headers" section
4. Should have:
   ```
   x-cron-secret: [same value as CRON_SECRET env var]
   ```

**Common Issue**: Header value doesn't match env var, or header is missing entirely.

### Step 4: Manually Trigger Execution (Workaround)

Until cron is fixed, manually trigger bot execution:

```javascript
// Run in browser console (while logged in)
const response = await fetch(
  'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await supabase.auth.getSession().then(r => r.data.session?.access_token)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'execute_all_bots'
    })
  }
);
const result = await response.json();
console.log('Execution result:', result);
```

Or use the test script: `test-trade-notification.js`

## Expected Log Flow (When Working)

**bot-scheduler logs:**
```
📅 Bot Scheduler called at: [timestamp]
🔍 Request method: POST
🔍 Request headers: {...}
🔐 CRON_SECRET present: true
🔐 Header secret present: true
🔐 Secrets match: true
🌐 SUPABASE_URL: https://...
🚀 Calling bot-executor at: https://...
✅ Bot-executor response: {status: 200, ...}
```

**bot-executor logs:**
```
🚀 === BOT EXECUTION STARTED ===
📅 Timestamp: [timestamp]
🔐 Auth mode: CRON (service role)
🔍 Cron: Looking for all running bots...
📊 Querying database for running bots...
📊 Database query result: Found X running bots
```

## Quick Fix Checklist

- [ ] Run `check-bots-status.sql` to verify bots exist
 [ ] Check bot-scheduler environment variables
- [ ] Verify schedule has `x-cron-secret` header matching `CRON_SECRET`
- [ ] Manually test bot-scheduler invocation
- [ ] Check bot-scheduler error logs
- [ ] Manually trigger bot execution as workaround

## Next Steps After Fix

Once cron is working:
1. Monitor bot-executor logs for execution
2. Verify trades are being placed
3. Check Telegram notifications are sent
4. Monitor bot performance

