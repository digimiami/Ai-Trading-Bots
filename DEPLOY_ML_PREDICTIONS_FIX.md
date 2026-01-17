# Deploy ML Predictions Fix

## Issue
The `ml-predictions` Edge Function is throwing "Cannot read properties of null (reading 'id')" errors when called by `ml-auto-retrain` because it tries to use `user.id` for internal calls where `user` is null.

## Fix Applied
The `check_retrain` action in `ml-predictions/index.ts` has been updated to:
- Detect internal calls (from `ml-auto-retrain`)
- Retrieve `user_id` from `bot_id` for internal calls
- Use the retrieved `user_id` instead of `user.id`

## Deployment Steps

### Option 1: Deploy via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **ml-predictions**
3. Click **Deploy** or **Redeploy**
4. The function will be updated with the fix

### Option 2: Deploy via Supabase CLI
```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Deploy the function
npx supabase functions deploy ml-predictions --project-ref YOUR_PROJECT_REF
```

### Option 3: Deploy via Git Push (if using Supabase Git integration)
If your project is connected to Git, simply push the changes:
```bash
git add supabase/functions/ml-predictions/index.ts
git commit -m "Fix: Handle null user in check_retrain for internal calls"
git push
```

## Verification
After deployment, check the `ml-auto-retrain` logs. You should see:
- ✅ Successful `check_retrain` calls without "Cannot read properties of null" errors
- ✅ Log messages like: "✅ Internal call: Retrieved user_id {userId} from bot_id {botId}"

## Additional Issue: 401 Unauthorized Errors

The logs also show `401 Unauthorized` errors with `hasSecret: false`. These are from a Supabase Scheduled Trigger that's not sending the `x-cron-secret` header.

### Solution Options:

**Option A: Disable Supabase Cron Job (Recommended)**
Since you're using an external cron script (`/root/scripts/call-ml-auto-retrain.sh`) that correctly sends the header, you can disable the Supabase Scheduled Trigger:

1. Go to **Database** → **Cron Jobs** in Supabase Dashboard
2. Find the `ml-auto-retrain` cron job
3. Delete or disable it

**Option B: Fix Supabase Cron Job**
If you want to keep the Supabase cron job, you need to configure it to send the `x-cron-secret` header. However, Supabase Scheduled Triggers (pg_cron) don't support custom headers directly. You would need to:
1. Create an intermediate Edge Function that adds the header
2. Have the cron job call that intermediate function
3. Have that function call `ml-auto-retrain` with the header

This is more complex, so Option A is recommended.

## Summary
1. ✅ Fix is ready in code
2. ⏳ **Action Required:** Deploy `ml-predictions` function
3. ⏳ **Action Required:** Disable or fix the Supabase cron job causing 401 errors
