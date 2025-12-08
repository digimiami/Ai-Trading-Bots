# 🚀 Deploy and Debug Subscription Renewal Function

## Step 1: Deploy Updated Function

The function has been updated with better error logging. Deploy it:

### Option A: Via Supabase Dashboard (Recommended)

1. Go to: **Supabase Dashboard** → **Edge Functions**
2. Find: `subscription-renewal`
3. Click: **"Deploy"** or **"Redeploy"** button
4. Wait for deployment to complete (usually 30-60 seconds)

### Option B: Via Supabase CLI

```bash
supabase functions deploy subscription-renewal
```

## Step 2: Verify Secret in Supabase

1. Go to: **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Find: `SUBSCRIPTION_RENEWAL_SECRET`
3. Click to view/edit
4. **Verify the value is exactly**:
   ```
   22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc
   ```
   - Should be exactly 64 characters
   - No spaces before or after
   - No line breaks

## Step 3: Test with Debug Logging

After deploying, test again:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Step 4: Check Edge Function Logs

The updated function now logs debug information. Check the logs:

1. Go to: **Supabase Dashboard** → **Edge Functions** → `subscription-renewal`
2. Click: **"Logs"** tab
3. Look for your recent request
4. You should see logs like:
   ```
   [DEBUG] Expected secret length: 64, Received length: 64
   [DEBUG] Secret match: true/false
   ```

If there's a mismatch, you'll see:
```
[AUTH] Secret mismatch. Expected: 22ad6fb9...958385fc, Got: 22ad6fb9...958385fc
```

This will help identify if:
- The secret is truncated
- There are extra spaces
- The values don't match

## Step 5: Fix Based on Logs

### If Secret Length Doesn't Match

- **Expected length: 64, Received: 62** → Secret in Supabase is truncated
- **Solution**: Delete and recreate the secret with the full 64-character value

### If Secret Match is False

- The values don't match character-by-character
- **Solution**: Copy the exact value from the logs and update Supabase

### If Expected Secret is Empty

- `SUBSCRIPTION_RENEWAL_SECRET` is not set in Supabase
- **Solution**: Add the secret to Supabase Edge Function Secrets

## Alternative: Temporarily Disable Secret Check

If you need to test the function without the secret check (NOT recommended for production):

1. Edit `supabase/functions/subscription-renewal/index.ts`
2. Comment out lines 33-47 (the secret check)
3. Deploy the function
4. Test - if it works, the issue is definitely the secret
5. Uncomment the check and fix the secret

## Quick Checklist

- [ ] Function redeployed (via Dashboard or CLI)
- [ ] Secret verified in Supabase (exactly 64 characters)
- [ ] Tested endpoint
- [ ] Checked Edge Function logs for debug info
- [ ] Fixed any issues found in logs

## Expected Success Response

Once working:

```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

