# 🚀 Deploy Subscription Renewal Function - URGENT

## ⚠️ Current Issue
You're getting "Unauthorized" because the function hasn't been redeployed after updating the secret.

## ✅ Solution: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions
2. Or navigate: **Supabase Dashboard** → **Edge Functions**

### Step 2: Find subscription-renewal Function

1. Look for `subscription-renewal` in the functions list
2. Click on it to open the function editor

### Step 3: Deploy the Function

**Option A: If function exists**
1. Click **"Deploy"** or **"Redeploy"** button
2. Wait for deployment to complete (30-60 seconds)
3. You should see: ✅ "Deployment successful"

**Option B: If function doesn't exist**
1. Click **"Create a new function"**
2. Name: `subscription-renewal`
3. Copy the entire contents of `supabase/functions/subscription-renewal/index.ts`
4. Paste into the editor
5. Click **"Deploy"**

### Step 4: Verify Secret is Set

1. Go to: **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Verify `SUBSCRIPTION_RENEWAL_SECRET` exists
3. Value should be: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
4. If not, add it (see below)

### Step 5: Test After Deployment

Wait 1-2 minutes after deployment, then test:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 6: Check Logs for Debug Info

After testing, check the logs:

1. Go to: **Supabase Dashboard** → **Edge Functions** → `subscription-renewal`
2. Click **"Logs"** tab
3. Look for your recent request
4. You should see debug logs like:
   ```
   [DEBUG] Expected secret length: 64, Received length: 64
   [DEBUG] Secret match: true/false
   ```

## 🔍 If Still Getting "Unauthorized"

### Check 1: Secret Value
- Go to **Secrets** → `SUBSCRIPTION_RENEWAL_SECRET`
- Verify value is exactly: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
- Should be 64 characters, no spaces

### Check 2: Function Deployment
- Make sure function shows as **"Active"** or **"Deployed"**
- If it shows errors, check the deployment logs

### Check 3: Wait for Propagation
- Secrets can take 1-2 minutes to propagate
- Deployments can take 30-60 seconds
- Wait 2-3 minutes total before testing

### Check 4: View Debug Logs
- The updated function logs debug information
- Check logs to see exactly what's happening:
  - Secret length mismatch?
  - Secret value mismatch?
  - Secret not set?

## ✅ Expected Success Response

Once working:

```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

## 📋 Quick Checklist

- [ ] Function deployed via Supabase Dashboard
- [ ] Secret `SUBSCRIPTION_RENEWAL_SECRET` exists in Secrets
- [ ] Secret value is exactly 64 characters
- [ ] Waited 2-3 minutes after deployment
- [ ] Tested endpoint
- [ ] Checked logs for debug info

## 🆘 Still Not Working?

If you're still getting "Unauthorized" after:
1. ✅ Function is deployed
2. ✅ Secret is set correctly
3. ✅ Waited 2-3 minutes

Then check the Edge Function logs - the debug logging will show exactly what's wrong:
- Secret length mismatch
- Secret value mismatch  
- Secret not found

The logs will tell you exactly what to fix!

