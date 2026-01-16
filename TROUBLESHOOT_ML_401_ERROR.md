# 🔧 Troubleshoot ML Auto-Retrain 401 Unauthorized Error

## Problem
Getting `HTTP 401 Unauthorized` when calling ml-auto-retrain function.

## Root Causes

1. **ML_AUTO_RETRAIN_SECRET not set in Supabase Edge Function**
2. **Secret mismatch** between Supabase and server `.env.cron`
3. **Edge Function not deployed** with updated code
4. **Wrong secret value** in either location

## Step-by-Step Fix

### Step 1: Verify Edge Function is Deployed

The Edge Function code must be deployed to use `ML_AUTO_RETRAIN_SECRET`. 

**Check if you need to deploy:**
1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain
2. Check the **Logs** tab
3. Look for recent logs showing the function is using `ML_AUTO_RETRAIN_SECRET`

If you see errors about `CRON_SECRET` but not `ML_AUTO_RETRAIN_SECRET`, the function needs to be deployed.

**Deploy the function:**
```bash
# If you have Supabase CLI
supabase functions deploy ml-auto-retrain

# Or use the Supabase Dashboard to deploy
```

### Step 2: Set ML_AUTO_RETRAIN_SECRET in Supabase

1. Go to: **https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain**
2. Click **Settings** tab
3. Scroll to **Environment Variables**
4. Check if `ML_AUTO_RETRAIN_SECRET` exists:
   - If it exists: Click **Edit** → Verify the value
   - If it doesn't exist: Click **Add new variable**:
     - **Name**: `ML_AUTO_RETRAIN_SECRET`
     - **Value**: (see Step 3)
     - Click **Save**

### Step 3: Generate/Get the Secret Value

On your server, generate a new secret:

```bash
openssl rand -hex 32
```

**Copy this value** - you'll need it in BOTH places:
1. Supabase Edge Function (Step 2)
2. Server `.env.cron` file (Step 4)

### Step 4: Update Server .env.cron

On your server:

```bash
nano /root/.env.cron
```

Make sure you have this line (use the SAME value from Step 3):

```bash
ML_AUTO_RETRAIN_SECRET=your_generated_secret_here
```

**Important**: 
- No quotes around the value
- No extra spaces
- Must match EXACTLY what's in Supabase

### Step 5: Verify Both Values Match

**Check Supabase:**
1. Go to Edge Functions → `ml-auto-retrain` → Settings
2. Look at `ML_AUTO_RETRAIN_SECRET` value (it will be hidden, but you can verify it's set)

**Check Server:**
```bash
# View the secret (be careful - this shows it in plain text)
grep ML_AUTO_RETRAIN_SECRET /root/.env.cron
```

### Step 6: Test Again

```bash
# Test the script
/root/scripts/call-ml-auto-retrain.sh

# Check logs
tail -20 /var/log/bot-scheduler/ml-auto-retrain.log
```

### Step 7: Check Edge Function Logs

If still getting 401, check the Edge Function logs:

1. Go to: **https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain**
2. Click **Logs** tab
3. Look for recent logs - you should see:
   ```
   🔐 Checking ML auto-retrain secret:
   hasSecret: true
   hasExpectedSecret: true
   matches: true/false
   ```

If `matches: false`, the secrets don't match!

## Common Issues

### Issue 1: Secret Has Extra Spaces

**Problem**: Secret has leading/trailing spaces

**Fix**: 
```bash
# Check for spaces
grep ML_AUTO_RETRAIN_SECRET /root/.env.cron | cat -A

# Should see: ML_AUTO_RETRAIN_SECRET=value$ (no spaces)
# If you see spaces, remove them
```

### Issue 2: Using CRON_SECRET Instead

**Problem**: Still using `CRON_SECRET` in `.env.cron` instead of `ML_AUTO_RETRAIN_SECRET`

**Fix**: Make sure your `.env.cron` has:
```bash
ML_AUTO_RETRAIN_SECRET=value_here
```

NOT:
```bash
CRON_SECRET=value_here  # This won't work for ml-auto-retrain
```

### Issue 3: Edge Function Not Updated

**Problem**: Edge Function still looking for `CRON_SECRET` instead of `ML_AUTO_RETRAIN_SECRET`

**Fix**: Deploy the updated Edge Function code

### Issue 4: Secret Not Set in Supabase

**Problem**: `ML_AUTO_RETRAIN_SECRET` environment variable not set in Supabase

**Fix**: Add it in Edge Function Settings → Environment Variables

## Debug Commands

### Check What Secret the Script is Using

```bash
# Source the .env.cron and check
source /root/.env.cron
echo "ML_AUTO_RETRAIN_SECRET length: ${#ML_AUTO_RETRAIN_SECRET}"
echo "ML_AUTO_RETRAIN_SECRET first 10 chars: ${ML_AUTO_RETRAIN_SECRET:0:10}"
```

### Test the Secret Manually

```bash
# Get your secret from .env.cron
SECRET=$(grep ML_AUTO_RETRAIN_SECRET /root/.env.cron | cut -d= -f2)

# Test with curl
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Quick Checklist

- [ ] Edge Function code deployed (uses `ML_AUTO_RETRAIN_SECRET`)
- [ ] `ML_AUTO_RETRAIN_SECRET` set in Supabase Edge Function Settings
- [ ] `ML_AUTO_RETRAIN_SECRET` set in `/root/.env.cron`
- [ ] Both secrets match exactly (no spaces, same value)
- [ ] Script updated to use `ML_AUTO_RETRAIN_SECRET`
- [ ] Tested script and checked logs
- [ ] Checked Edge Function logs for secret mismatch

## Expected Success Log

When working correctly, you should see:

**Server logs:**
```
✅ ML Auto-Retrain completed successfully (HTTP 200, X.XXs)
   Checked: X bots, Retrained: Y
```

**Edge Function logs:**
```
🔐 Checking ML auto-retrain secret:
   hasSecret: true
   hasExpectedSecret: true
   matches: true ✅
🔄 Starting ML auto-retrain check...
✅ ML auto-retrain check complete: X bots checked, Y need retraining
```
