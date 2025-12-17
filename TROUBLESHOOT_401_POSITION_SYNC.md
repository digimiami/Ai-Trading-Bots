# Troubleshooting 401 Errors for position-sync Cron Job

## Current Issue
The `position-sync` Edge Function is returning `401 Unauthorized` errors when called by the cron job. This indicates an authentication failure.

## Root Cause
The `x-cron-secret` header value in the cron job schedule does NOT match the `POSITION_SYNC_SECRET` environment variable in the Edge Function settings.

## Step-by-Step Fix

### Step 1: Verify Edge Function Environment Variable

1. Go to **Supabase Dashboard** → **Edge Functions** → **position-sync**
2. Click on **Settings** tab (or **Details** → **Secrets**)
3. Look for `POSITION_SYNC_SECRET` in the environment variables
4. **Copy the exact value** (you'll need it for Step 2)

**If `POSITION_SYNC_SECRET` is missing:**
- Click **Add new secret**
- Name: `POSITION_SYNC_SECRET`
- Value: Generate a secure random string (e.g., use an online generator or run: `openssl rand -hex 32`)
- Click **Save**

### Step 2: Verify Cron Job Schedule Header

1. Go to **Supabase Dashboard** → **Database** → **Schedules** (or **Edge Functions** → **position-sync** → **Schedules**)
2. Find the schedule for `position-sync` (cron job 9)
3. Click **Edit** on the schedule
4. Check the **Headers** section
5. Verify:
   - **Header Key**: Must be exactly `x-cron-secret` (lowercase, with hyphen)
   - **Header Value**: Must match EXACTLY the `POSITION_SYNC_SECRET` value from Step 1
   - **⚠️ Common mistakes:**
     - Using `POSITION_SYNC_SECRET` as the header key (should be `x-cron-secret`)
     - Extra spaces before/after the value
     - Different casing
     - Missing characters

### Step 3: Redeploy the Edge Function

After making any changes to environment variables or the function code:

1. **Option A: Via Supabase CLI** (if you have it set up):
   ```bash
   supabase functions deploy position-sync
   ```

2. **Option B: Via Git** (if auto-deploy is enabled):
   ```bash
   git add supabase/functions/position-sync/index.ts
   git commit -m "Fix: Add detailed auth logging for position-sync"
   git push
   ```
   Wait for auto-deployment to complete (check deployment status in dashboard)

3. **Option C: Manual Deploy**:
   - Go to **Edge Functions** → **position-sync** → **Code**
   - Copy the updated code from `supabase/functions/position-sync/index.ts`
   - Paste it into the editor
   - Click **Deploy**

### Step 4: Verify the Fix

1. Wait for the next cron job execution (or trigger it manually if possible)
2. Go to **Edge Functions** → **position-sync** → **Logs**
3. You should now see detailed logs like:
   ```
   🔄 [abc12345] Position Sync Cron Job STARTED
   🔐 [abc12345] Authentication check:
      POSITION_SYNC_SECRET present: true (length: 64)
      Header secret present: true (length: 64)
      🔑 Secrets match: true
   ✅ [abc12345] Authentication successful
   ```

4. Check **Invocations** tab - should show `200` status instead of `401`

## Common Issues and Solutions

### Issue 1: Logs Still Not Showing
- **Cause**: Function might not be executing, or logs are delayed
- **Solution**: 
  - Wait 1-2 minutes for logs to appear
  - Check if cron job is actually running (Database → Logs → look for "cron job 9 starting")
  - Verify the cron schedule is active (not paused)

### Issue 2: Secret Still Not Matching
- **Cause**: Typo, extra spaces, or different values
- **Solution**:
  - Copy the secret value directly (don't type it)
  - Remove any trailing/leading spaces
  - Ensure both values are identical character-by-character
  - Use the debug logs to compare first 8 and last 8 characters

### Issue 3: Function Not Deployed
- **Cause**: Changes not deployed yet
- **Solution**:
  - Check deployment status in **Edge Functions** → **position-sync** → **Overview**
  - Look for the latest deployment version
  - Ensure you're looking at logs from the latest version

### Issue 4: Wrong Header Name
- **Cause**: Using `POSITION_SYNC_SECRET` instead of `x-cron-secret` as header key
- **Solution**: Change header key to exactly `x-cron-secret` (lowercase, hyphen)

## Verification Checklist

- [ ] `POSITION_SYNC_SECRET` exists in Edge Function environment variables
- [ ] Cron job schedule has header key `x-cron-secret` (exact match, lowercase)
- [ ] Cron job schedule header value matches `POSITION_SYNC_SECRET` exactly
- [ ] Edge Function has been redeployed after any changes
- [ ] Cron job schedule is active (not paused)
- [ ] Logs show authentication successful message
- [ ] Invocations show `200` status code

## Next Steps After Fix

Once authentication is working:
1. Monitor logs for any sync errors
2. Verify positions are being synced correctly
3. Check that positions are updating in the database
4. Ensure Telegram notifications are working for position closes

## Still Having Issues?

If you've completed all steps and still see 401 errors:

1. **Check the detailed logs** - The updated function now logs:
   - Whether secrets are present
   - Length of each secret
   - First 8 and last 8 characters (for comparison)
   - Whether they match

2. **Double-check the cron job configuration**:
   - Endpoint URL: `https://[your-project].supabase.co/functions/v1/position-sync`
   - Method: `POST`
   - Header Key: `x-cron-secret`
   - Header Value: (exact match with env var)

3. **Try regenerating the secret**:
   - Generate a new `POSITION_SYNC_SECRET`
   - Update both the Edge Function env var AND the cron job header
   - Redeploy
