# 🔍 Troubleshoot "Unauthorized" After Secret Update

## Current Status
- ✅ Cron job fixed (single entry, no duplicates)
- ✅ Supabase secret updated to: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
- ❌ Still getting "Unauthorized" error

## Possible Causes & Solutions

### 1. Secret Not Fully Saved (Most Likely)

The secret value in Supabase might be truncated. Verify it's complete:

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Find `SUBSCRIPTION_RENEWAL_SECRET`
3. Click to view/edit
4. **Verify the FULL value is**: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
   - Should be exactly 64 characters
   - No extra spaces before/after
   - No line breaks

If it's truncated, delete and recreate:
1. Delete the existing `SUBSCRIPTION_RENEWAL_SECRET`
2. Click "Add new secret"
3. Name: `SUBSCRIPTION_RENEWAL_SECRET`
4. Value: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
5. Save

### 2. Edge Function Needs Redeployment

Edge Functions may need to be redeployed to pick up new secrets:

```bash
# From your local machine (where you have supabase CLI)
supabase functions deploy subscription-renewal
```

### 3. Secret Propagation Delay

Secrets can take 1-5 minutes to propagate. Try:
1. Wait 2-3 more minutes
2. Test again

### 4. Check Edge Function Logs

Check the Edge Function logs for more details:

1. Go to Supabase Dashboard → Edge Functions → subscription-renewal
2. Click "Logs" tab
3. Look for recent requests and error messages
4. Check if it shows the secret comparison failing

### 5. Verify Secret Format

Make sure there are no hidden characters:

```bash
# On your VPS, verify the secret in cron job
crontab -l | grep subscription-renewal | grep -o 'x-cron-secret: [^"]*'
```

Should output: `x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`

### 6. Test with Different Secret Value

If still not working, try generating a new secret and updating both:

```bash
# Generate new secret
openssl rand -hex 32
```

Then:
1. Update Supabase secret with new value
2. Update cron job with new value
3. Wait 2-3 minutes
4. Test again

## Step-by-Step Debugging

### Step 1: Verify Secret in Supabase

1. Go to: Supabase Dashboard → Edge Functions → Secrets
2. Find `SUBSCRIPTION_RENEWAL_SECRET`
3. Click "Show" or "Edit" to see full value
4. Copy the entire value
5. Compare with cron job value character-by-character

### Step 2: Check Edge Function Code

The function checks:
```typescript
const cronSecret = req.headers.get('x-cron-secret')
const expectedSecret = Deno.env.get('SUBSCRIPTION_RENEWAL_SECRET')

if (expectedSecret && cronSecret !== expectedSecret) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}
```

This means:
- If `SUBSCRIPTION_RENEWAL_SECRET` is not set → No check (should work)
- If `SUBSCRIPTION_RENEWAL_SECRET` is set → Must match exactly

### Step 3: Temporarily Remove Secret Check

If you want to test without the secret check, you can temporarily modify the function, but this is NOT recommended for production.

### Step 4: Redeploy Function

```bash
# Make sure you're in the project directory
cd "C:\Users\digimiami\Documents\PABLOBOTS FINAL\Pablo AI Trading\Pablo AI Trading"

# Deploy the function
supabase functions deploy subscription-renewal
```

### Step 5: Test Again

After redeploying, wait 1-2 minutes, then test:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Quick Fix: Delete and Recreate Secret

If nothing else works:

1. **Delete** `SUBSCRIPTION_RENEWAL_SECRET` from Supabase
2. **Wait 1 minute**
3. **Add new secret**:
   - Name: `SUBSCRIPTION_RENEWAL_SECRET`
   - Value: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
4. **Save**
5. **Wait 2-3 minutes**
6. **Redeploy function**: `supabase functions deploy subscription-renewal`
7. **Wait 1 minute**
8. **Test again**

## Expected Success Response

Once working, you should see:

```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

Or if there are subscriptions to check:

```json
{
  "message": "Subscription renewal check complete",
  "checked": 2,
  "renewed": 1,
  "errors": []
}
```

