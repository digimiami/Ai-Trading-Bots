# 🚀 Deploy ML Auto-Retrain Edge Function

## Problem
The Edge Function code has been updated to use `ML_AUTO_RETRAIN_SECRET`, but if it's not deployed, the function is still using the old code that might be looking for `CRON_SECRET` or not finding the secret at all.

## Solution: Deploy the Updated Function

### Option 1: Deploy via Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Deploy the ml-auto-retrain function
supabase functions deploy ml-auto-retrain

# Verify deployment
supabase functions list
```

### Option 2: Deploy via Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain

2. **Check Current Deployment**
   - Look at the **Logs** tab
   - If you see logs with `🔐 Checking ML auto-retrain secret:` and `usingMLSecret: true`, the function is deployed
   - If you don't see these logs, it needs deployment

3. **Deploy via Git Integration** (if set up)
   - Supabase can auto-deploy from your Git repository
   - Check if auto-deploy is enabled in Project Settings

4. **Manual Deployment** (if needed)
   - If you have the code locally, you can use Supabase CLI
   - Or push to your Git repo if auto-deploy is enabled

### Option 3: Verify Secret is Accessible

The secret should be accessible via `Deno.env.get('ML_AUTO_RETRAIN_SECRET')`. 

**Check if the function can see the secret:**

1. Go to Edge Functions → `ml-auto-retrain` → **Logs**
2. Look for logs that show:
   ```
   🔐 Checking ML auto-retrain secret: {
     hasSecret: true,
     hasExpectedSecret: true/false,  <-- This tells us if the secret is accessible
     matches: true/false,
     usingMLSecret: true/false  <-- This confirms ML_AUTO_RETRAIN_SECRET is set
   }
   ```

If `hasExpectedSecret: false` or `usingMLSecret: false`, the function can't see the secret.

## Verify Deployment

After deploying, test the function:

```bash
# On your server
/root/scripts/call-ml-auto-retrain.sh

# Check logs
tail -20 /var/log/bot-scheduler/ml-auto-retrain.log
```

Then immediately check Supabase logs - you should see:
- `📥 ML Auto-Retrain function called`
- `🔐 Checking ML auto-retrain secret:`
- `usingMLSecret: true` (if secret is accessible)

## Troubleshooting

### Issue: Function Still Returns 401

**Check 1: Is the function deployed?**
- Look for `🔐 Checking ML auto-retrain secret:` in logs
- If missing, function needs deployment

**Check 2: Can the function see the secret?**
- Look for `usingMLSecret: true` in logs
- If `false`, the secret might not be accessible

**Check 3: Do the secrets match?**
- Server `.env.cron`: `ML_AUTO_RETRAIN_SECRET=80b911c5...`
- Supabase Secret: Should match exactly
- Check for extra spaces or encoding issues

### Issue: Secret Not Accessible

If `usingMLSecret: false` in logs:

1. **Verify secret is in the right place:**
   - Should be in: **Edge Functions → Secrets** (global)
   - NOT in: Function-specific Environment Variables

2. **Check secret name:**
   - Must be exactly: `ML_AUTO_RETRAIN_SECRET`
   - Case-sensitive, no spaces

3. **Redeploy function:**
   - Sometimes secrets need a function restart to be accessible
   - Deploy the function again after setting the secret

## Quick Test

After deployment, check logs for this pattern:

```
📥 ML Auto-Retrain function called
🔐 Checking ML auto-retrain secret: {
  hasSecret: true,
  hasExpectedSecret: true,  ✅
  matches: true,  ✅
  usingMLSecret: true  ✅
}
🔄 Starting ML auto-retrain check...
```

If you see all ✅, it's working!
