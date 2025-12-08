# 🚨 URGENT: Deploy subscription-renewal Function

## ⚠️ Problem
The function is running but using OLD CODE. The logs show no debug messages, which means the updated function with debug logging hasn't been deployed.

## ✅ Solution: Deploy Function NOW

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions
2. Or: **Supabase Dashboard** → **Edge Functions**

### Step 2: Check if Function Exists

Look for `subscription-renewal` in the functions list.

**If it EXISTS:**
1. Click on `subscription-renewal`
2. Click **"Deploy"** or **"Redeploy"** button
3. Wait for deployment (30-60 seconds)

**If it DOESN'T EXIST:**
1. Click **"Create a new function"**
2. Name: `subscription-renewal`
3. Copy ALL code from: `supabase/functions/subscription-renewal/index.ts`
4. Paste into the editor
5. Click **"Deploy"**

### Step 3: Verify Deployment

After deployment, you should see:
- ✅ "Deployment successful" message
- ✅ Function status: "Active" or "Deployed"

### Step 4: Wait 2 Minutes

Secrets and code need time to propagate.

### Step 5: Test Again

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 6: Check Logs for Debug Info

After testing, check logs again. You should NOW see:

```
[DEBUG] Expected secret length: 64, Received length: 64
[DEBUG] Secret match: true/false
```

If there's a mismatch:
```
[AUTH] Secret mismatch. Expected: 22ad6fb9...958385fc, Got: ...
```

## 🔍 Why This Is Happening

The logs you showed only have:
- `booted (time: 31ms)`
- `Listening on http://localhost:9999/`
- `shutdown`

But NO debug logs like:
- `[DEBUG] Expected secret length: ...`
- `[DEBUG] Secret match: ...`

This means the function is running OLD CODE that doesn't have the debug logging we added.

## ✅ After Deployment

Once you deploy the updated function:
1. The debug logs will appear
2. You'll see exactly what's wrong with the secret
3. The logs will tell you if:
   - Secret is missing
   - Secret length doesn't match
   - Secret value doesn't match

## 📋 Quick Checklist

- [ ] Go to Supabase Dashboard → Edge Functions
- [ ] Find or create `subscription-renewal` function
- [ ] Deploy/Redeploy the function
- [ ] Wait 2 minutes
- [ ] Test endpoint
- [ ] Check logs for debug info

## 🆘 If Function Doesn't Exist

If you don't see `subscription-renewal` in the functions list:

1. Click **"Create a new function"**
2. Name: `subscription-renewal`
3. Copy the entire file: `supabase/functions/subscription-renewal/index.ts`
4. Paste into the editor
5. Click **"Deploy"**

The function code is already in your repository, you just need to deploy it!

