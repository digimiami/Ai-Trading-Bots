# 🔐 Setup ML_AUTO_RETRAIN_SECRET for ML Auto-Retrain

## Problem
Supabase hides secret values after saving them for security. Also, `CRON_SECRET` is already used by bot-executor, so we use `ML_AUTO_RETRAIN_SECRET` to avoid conflicts.

## Solution: Generate and Set New ML_AUTO_RETRAIN_SECRET

### Step 1: Generate a Secure Secret

On your server, run this command to generate a secure random secret:

```bash
# Generate a secure 64-character random secret
openssl rand -hex 32
```

**Example output:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Copy this value** - you'll need it in both places!

### Step 2: Set ML_AUTO_RETRAIN_SECRET in Supabase Edge Function

1. Go to: **https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain**
2. Click **Settings** tab (gear icon)
3. Scroll to **Environment Variables** section
4. Look for `ML_AUTO_RETRAIN_SECRET`:
   - If it exists: Click **Edit** → Paste your new secret → **Save**
   - If it doesn't exist: Click **Add new variable**:
     - **Name**: `ML_AUTO_RETRAIN_SECRET`
     - **Value**: Paste the secret you generated
     - Click **Save**

**Note**: The function also accepts `CRON_SECRET` as a fallback for backward compatibility, but `ML_AUTO_RETRAIN_SECRET` is preferred to avoid conflicts.

### Step 3: Set ML_AUTO_RETRAIN_SECRET in Your Server's .env.cron

On your server:

```bash
# Edit .env.cron file
nano /root/.env.cron
```

Add or update this line (use the SAME value from Step 1):

```bash
ML_AUTO_RETRAIN_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Note**: The script also checks `CRON_SECRET` as a fallback, but `ML_AUTO_RETRAIN_SECRET` is preferred.

Save and exit (Ctrl+X, Y, Enter)

### Step 4: Test the Setup

Test that everything works:

```bash
# Test the script manually
/root/scripts/call-ml-auto-retrain.sh

# Check the logs
tail -20 /var/log/bot-scheduler/ml-auto-retrain.log
```

You should see:
```
✅ ML Auto-Retrain completed successfully (HTTP 200, X.XXs)
```

If you see `❌ ERROR: ML_AUTO_RETRAIN_SECRET not set` or `401 Unauthorized`, double-check:
- The value in Supabase matches the value in `/root/.env.cron`
- There are no extra spaces or quotes
- The script has execute permissions: `chmod +x /root/scripts/call-ml-auto-retrain.sh`
- You're using `ML_AUTO_RETRAIN_SECRET` (not `CRON_SECRET`) to avoid conflicts

## Alternative: Use a Simple Secret (Less Secure)

If you don't have `openssl`, you can use a simple secret:

```bash
# Generate a simple secret (less secure but works)
echo "ml-retrain-$(date +%s | sha256sum | base64 | head -c 32)"
```

Or just make up a long random string:
```
ml-auto-retrain-secret-2026-abc123xyz789
```

**Important**: Use the SAME value in both Supabase and your `.env.cron` file!

## Verify CRON_SECRET is Set Correctly

### Check Supabase:
1. Go to Edge Functions → `ml-auto-retrain` → Settings
2. Look for `CRON_SECRET` in Environment Variables
3. You should see it listed (value will be hidden with dots)

### Check Server:
```bash
# Check if CRON_SECRET is in .env.cron
grep CRON_SECRET /root/.env.cron

# Should output:
# CRON_SECRET=your-secret-value-here
```

## Troubleshooting

### Error: "ML_AUTO_RETRAIN_SECRET not set"
- Make sure `/root/.env.cron` has the `ML_AUTO_RETRAIN_SECRET=` line
- Make sure there are no quotes around the value
- Make sure there are no extra spaces
- The script also checks `CRON_SECRET` as fallback, but `ML_AUTO_RETRAIN_SECRET` is preferred

### Error: "401 Unauthorized"
- The ML_AUTO_RETRAIN_SECRET in Supabase doesn't match the one in `.env.cron`
- Check for typos or extra spaces
- Make sure both values are exactly the same
- Make sure you're using `ML_AUTO_RETRAIN_SECRET` (not `CRON_SECRET`) to avoid conflicts with bot-executor

### Error: "Function not found" or "404"
- Make sure the Edge Function `ml-auto-retrain` is deployed
- Check the Supabase URL is correct in your script

## Quick Reference

**Where to set ML_AUTO_RETRAIN_SECRET:**
1. ✅ Supabase Dashboard → Edge Functions → `ml-auto-retrain` → Settings → Environment Variables
2. ✅ Server file: `/root/.env.cron`

**Both must have the EXACT SAME value!**

**Why ML_AUTO_RETRAIN_SECRET instead of CRON_SECRET?**
- `CRON_SECRET` is already used by `bot-executor` and other functions
- Using `ML_AUTO_RETRAIN_SECRET` avoids conflicts
- The function accepts both (with `ML_AUTO_RETRAIN_SECRET` taking priority) for backward compatibility
