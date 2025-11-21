# How to Add SERVICE_ROLE_KEY for Bot Cron Jobs

## Problem
The bot scheduler cron job is failing with "Invalid JWT" because the ANON_KEY cannot be used for `Authorization: Bearer` in service-to-service calls.

## Solution
Add your Supabase SERVICE_ROLE_KEY to the `.env.cron` file on your server.

## Steps

### 1. Get your SERVICE_ROLE_KEY from Supabase

Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/settings/api

Look for the **service_role** key (⚠️ IMPORTANT: This is secret! Never commit it to git!)

### 2. Add it to `.env.cron` on your server

On your server, run:

```bash
cd /var/www/Ai-Trading-Bots
nano .env.cron
```

Add this line (replace `your_service_role_key_here` with the actual key from step 1):

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Your `.env.cron` should now look like this:

```bash
# Supabase Configuration
SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMTA1NzAsImV4cCI6MjA0NTY4NjU3MH0.gHVXZN5nF3lPLhXDG0mPLg88TI2hZBfXPvb_pFaFXiY
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cron Secret (for internal authentication)
CRON_SECRET=c3f0b1a2d4e59687a9b0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f78a

# Logging
LOG_DIR=/var/log/bot-scheduler
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

### 3. Pull the latest code and test

```bash
cd /var/www/Ai-Trading-Bots
git pull
bash /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
```

You should see:
```
Using SERVICE_ROLE_KEY for Authorization
✅ Bot scheduler called successfully
```

### 4. Verify PM2 cron is working

```bash
pm2 logs bot-scheduler-cron --lines 20
```

You should see successful executions with no more "Invalid JWT" errors!

## Why This Fixes the Issue

- **ANON_KEY**: For client-side access, limited permissions
- **SERVICE_ROLE_KEY**: For server-side/service calls, full permissions, bypasses RLS

The cron job is a server-side service call, so it needs the SERVICE_ROLE_KEY for proper authentication with Supabase Edge Functions.

## Security Note

⚠️ **NEVER** commit the SERVICE_ROLE_KEY to git!
⚠️ The `.env.cron` file should ONLY exist on your server, not in your git repository.

The `.gitignore` already includes `.env.cron` to prevent accidental commits.

