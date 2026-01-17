# Verify ML Monitoring Logs Are Appearing

## Current Status
The `ml-monitoring` function is now being called from the AI/ML Activity Modal. Here's how to verify it's working:

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for:
   - `ML Monitoring data:` - This confirms the function was called and returned data
   - Any errors related to `ml-monitoring`

## Step 2: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **ml-monitoring** → **Logs**
2. You should now see logs like:
   ```
   📥 ML Monitoring function called: { method: "GET", url: "...", timestamp: "..." }
   🔐 Checking user authentication...
   ✅ User authenticated: <user-id>
   🎯 Action: dashboard
   ```

## Step 3: Verify the View Exists

The function queries `ml_performance_summary` view. Check if it exists:

```sql
-- Run this in Supabase SQL Editor
SELECT * FROM ml_performance_summary LIMIT 5;
```

If you get an error that the view doesn't exist, run:
```sql
-- Run the migration
-- File: supabase/migrations/20250126_enhance_ml_performance_tracking.sql
```

## Step 4: Check for Errors

If logs aren't appearing, check:

### Error 1: View doesn't exist
**Solution:** Run the migration `20250126_enhance_ml_performance_tracking.sql`

### Error 2: Authentication failed
**Solution:** Make sure you're logged in when opening the modal

### Error 3: CORS error
**Solution:** The function should handle CORS, but check browser console for CORS errors

### Error 4: No data returned
**Solution:** This is normal if you don't have ML predictions with outcomes yet. The function will still log.

## Expected Behavior

Even if there's no data, you should see logs:
- ✅ Function called
- ✅ User authenticated  
- ✅ Action processed
- ⚠️ Empty results (if no ML performance data exists yet)

## Debug Steps

1. **Open the modal** (you already did this)
2. **Check browser console** for `ML Monitoring data:` log
3. **Check Supabase logs** immediately after opening the modal
4. **Refresh the logs page** if needed (logs might take a few seconds to appear)

## If Logs Still Don't Appear

1. Check browser network tab:
   - Open DevTools → Network tab
   - Filter by "ml-monitoring"
   - Open the modal again
   - Check if the request appears
   - Check the response status (should be 200)

2. Check for JavaScript errors:
   - Look in browser console for any red errors
   - These might prevent the fetch from executing

3. Verify environment variable:
   - Check that `VITE_PUBLIC_SUPABASE_URL` is set correctly
   - It should be: `https://dkawxgwdqiirgmmjbvhc.supabase.co`

## Quick Test

Run this in browser console while the modal is open:

```javascript
const token = JSON.parse(localStorage.getItem('supabase.auth.token')).currentSession.access_token;
fetch('https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-monitoring?action=dashboard', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log('Direct test:', d))
.catch(e => console.error('Error:', e));
```

This will show if the function works when called directly.
