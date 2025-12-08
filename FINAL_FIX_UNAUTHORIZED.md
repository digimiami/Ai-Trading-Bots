# ✅ Final Fix for "Unauthorized" Error

## Current Status
- ✅ Cron job: Fixed (single entry)
- ✅ Supabase secret: Updated
- ❌ Still getting "Unauthorized"

## Most Likely Issue: Secret Value Truncated

When you edited the secret in Supabase, the value might have been cut off. The full value should be:

```
22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc
```

**64 characters total** - verify it's complete in Supabase.

## Solution: Delete and Recreate Secret

### Step 1: Delete Existing Secret

1. Go to: **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Find: `SUBSCRIPTION_RENEWAL_SECRET`
3. Click: **Delete** (trash icon)
4. Confirm deletion

### Step 2: Wait 1 Minute

Let the deletion propagate.

### Step 3: Add New Secret (Complete Value)

1. Click: **"Add new secret"**
2. **Name**: `SUBSCRIPTION_RENEWAL_SECRET` (exact, case-sensitive)
3. **Value**: Copy and paste this EXACT value (all 64 characters):
   ```
   22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc
   ```
4. **Verify**: Count the characters - should be exactly 64
5. Click: **"Save"**

### Step 4: Redeploy Edge Function

You need to redeploy the function to pick up the new secret. Use one of these methods:

#### Option A: Via Supabase Dashboard (Easiest)

1. Go to: **Supabase Dashboard** → **Edge Functions**
2. Find: `subscription-renewal`
3. Click: **"Deploy"** or **"Redeploy"** button
4. Wait for deployment to complete

#### Option B: Via Supabase CLI (If Installed)

```bash
supabase functions deploy subscription-renewal
```

#### Option C: Manual Trigger (Forces Reload)

The function will reload on next request, but you can force it by making a request (even if it fails).

### Step 5: Wait 2-3 Minutes

Secrets and deployments need time to propagate.

### Step 6: Test Again

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Expected Success Response

```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

## Alternative: Check Edge Function Logs

If still not working, check the logs:

1. Go to: **Supabase Dashboard** → **Edge Functions** → `subscription-renewal`
2. Click: **"Logs"** tab
3. Look for your recent request
4. Check the error message - it might show what's wrong

## Quick Checklist

- [ ] Deleted old `SUBSCRIPTION_RENEWAL_SECRET` from Supabase
- [ ] Added new secret with FULL value: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc` (64 chars)
- [ ] Verified secret value has no extra spaces
- [ ] Redeployed Edge Function (via Dashboard or CLI)
- [ ] Waited 2-3 minutes for propagation
- [ ] Tested endpoint again

## If Still Not Working

Try temporarily removing the secret check to verify the function works:

1. Edit `supabase/functions/subscription-renewal/index.ts`
2. Comment out the secret check (lines 33-41)
3. Deploy the function
4. Test - if it works, the issue is definitely the secret value
5. Uncomment the check and fix the secret value

