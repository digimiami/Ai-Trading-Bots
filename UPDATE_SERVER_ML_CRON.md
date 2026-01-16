# 🔄 Update Server for ML_AUTO_RETRAIN_SECRET

## What Changed

We changed from `CRON_SECRET` to `ML_AUTO_RETRAIN_SECRET` to avoid conflicts with bot-executor. You need to update your server configuration.

## Step-by-Step Server Update

### Step 1: Update the Script on Your Server

The script file `call-ml-auto-retrain.sh` has been updated. You need to update it on your server:

```bash
# On your server, edit the script
nano /root/scripts/call-ml-auto-retrain.sh
```

**OR** if you have the repo on your server, pull the latest changes:

```bash
cd /path/to/your/repo
git pull
```

The script now uses `ML_AUTO_RETRAIN_SECRET` instead of `CRON_SECRET`.

### Step 2: Update .env.cron File

Edit your `.env.cron` file:

```bash
# On your server
nano /root/.env.cron
```

**Remove or comment out the old line:**
```bash
# CRON_SECRET=old_value_here  # OLD - Don't use this for ML auto-retrain
```

**Add the new line:**
```bash
ML_AUTO_RETRAIN_SECRET=your_new_secret_here
```

**Your .env.cron should look like this:**
```bash
SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ML_AUTO_RETRAIN_SECRET=your_ml_auto_retrain_secret_here
LOG_DIR=/var/log/bot-scheduler

# Keep CRON_SECRET if you're using it for bot-executor
# CRON_SECRET=your_bot_executor_secret_here
```

**Important**: 
- `ML_AUTO_RETRAIN_SECRET` is for ML auto-retrain function
- `CRON_SECRET` is for bot-executor (keep it if you're using it)
- They can have DIFFERENT values (that's the point!)

### Step 3: Generate New ML_AUTO_RETRAIN_SECRET

If you don't have a value yet, generate one:

```bash
# Generate a secure random secret
openssl rand -hex 32
```

Copy this value - you'll need it in both places:
1. Supabase Edge Function (ml-auto-retrain → Settings → Environment Variables)
2. Your server's `/root/.env.cron` file

### Step 4: Set ML_AUTO_RETRAIN_SECRET in Supabase

1. Go to: **https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/ml-auto-retrain**
2. Click **Settings** tab
3. Scroll to **Environment Variables**
4. Add new variable:
   - **Name**: `ML_AUTO_RETRAIN_SECRET`
   - **Value**: (paste the secret you generated)
   - Click **Save**

### Step 5: Make Script Executable (if needed)

```bash
chmod +x /root/scripts/call-ml-auto-retrain.sh
```

### Step 6: Test the Script

```bash
# Test manually
/root/scripts/call-ml-auto-retrain.sh

# Check logs
tail -20 /var/log/bot-scheduler/ml-auto-retrain.log
```

You should see:
```
✅ ML Auto-Retrain completed successfully (HTTP 200, X.XXs)
```

### Step 7: Verify Crontab

Make sure your crontab is set up correctly:

```bash
# View crontab
crontab -l

# Should see something like:
# 0 2 * * * /root/scripts/call-ml-auto-retrain.sh
```

## Summary of Changes

| Old | New |
|-----|-----|
| `CRON_SECRET` (conflicted with bot-executor) | `ML_AUTO_RETRAIN_SECRET` (unique) |
| Same secret for both functions | Different secrets for each function |

## Troubleshooting

### Error: "ML_AUTO_RETRAIN_SECRET not set"
- Make sure `/root/.env.cron` has `ML_AUTO_RETRAIN_SECRET=` line
- No quotes around the value
- No extra spaces

### Error: "401 Unauthorized"
- The `ML_AUTO_RETRAIN_SECRET` in Supabase must match the one in `.env.cron`
- Check for typos
- Make sure both values are exactly the same

### Script still uses CRON_SECRET
- The script has backward compatibility - it checks `ML_AUTO_RETRAIN_SECRET` first, then falls back to `CRON_SECRET`
- But you should use `ML_AUTO_RETRAIN_SECRET` to avoid conflicts

## Quick Checklist

- [ ] Updated script on server (`/root/scripts/call-ml-auto-retrain.sh`)
- [ ] Updated `.env.cron` with `ML_AUTO_RETRAIN_SECRET`
- [ ] Generated new secret value
- [ ] Set `ML_AUTO_RETRAIN_SECRET` in Supabase Edge Function
- [ ] Tested script manually
- [ ] Verified crontab is set up
- [ ] Checked logs for success

## Example .env.cron File

```bash
# Supabase Configuration
SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ML Auto-Retrain Secret (for ml-auto-retrain function)
ML_AUTO_RETRAIN_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Bot Executor Secret (for bot-executor function - different value!)
CRON_SECRET=another_different_secret_value_here

# Logging
LOG_DIR=/var/log/bot-scheduler
```

**Note**: `ML_AUTO_RETRAIN_SECRET` and `CRON_SECRET` can (and should) have different values!
