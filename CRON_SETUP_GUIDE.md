# 🤖 Bot Scheduler Cron Setup Guide

This guide explains how to set up the automated bot scheduler that runs 24/7 on your server.

## 📋 Overview

The bot scheduler calls your Supabase Edge Function `bot-scheduler` every 5 minutes to execute all running trading bots. This ensures your bots trade continuously even when your browser is closed.

## 🚀 Quick Setup

### Step 1: Configure Environment Variables

1. Copy the example config file:
   ```bash
   cp scripts/env.cron.example .env.cron
   ```

2. Edit `.env.cron` and update:
   - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://dkawxgwdqiirgmmjbvhc.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your Supabase anon/public key (get from Dashboard → Settings → API)
   - `CRON_SECRET`: Your CRON_SECRET value (same as in Supabase Secrets)

### Step 2: Deploy to Server

If your server auto-deploys from git:

1. **Add deployment script to your git hook** (e.g., `post-receive` hook or CI/CD):
   ```bash
   # In your deployment script, add:
   bash scripts/deploy-cron.sh
   ```

2. **Or manually run on server**:
   ```bash
   cd /path/to/project
   bash scripts/deploy-cron.sh
   ```

### Step 3: Verify Setup

1. **Test the script manually**:
   ```bash
   bash scripts/call-bot-scheduler.sh
   ```

2. **Check logs**:
   ```bash
   tail -f /var/log/bot-scheduler/bot-scheduler.log
   ```

3. **Verify cron job is installed**:
   ```bash
   crontab -l
   ```
   You should see: `*/5 * * * * /path/to/scripts/call-bot-scheduler.sh`

## 📁 Files Created

- `scripts/call-bot-scheduler.sh` - Main script that calls the bot-scheduler endpoint
- `scripts/setup-cron.sh` - Script to install/update the cron job
- `scripts/deploy-cron.sh` - Auto-deployment script (run after git pull)
- `scripts/env.cron.example` - Example configuration file
- `.env.cron` - Your actual config (gitignored, create from example)

## 🔧 Manual Setup (If Not Using Auto-Deploy)

If you prefer to set up manually:

1. **Create config file**:
   ```bash
   cp scripts/env.cron.example .env.cron
   nano .env.cron  # Edit with your values
   ```

2. **Make scripts executable**:
   ```bash
   chmod +x scripts/call-bot-scheduler.sh
   chmod +x scripts/setup-cron.sh
   ```

3. **Install cron job**:
   ```bash
   bash scripts/setup-cron.sh
   ```

## 📊 Monitoring

### View Logs

- **Main log**: `tail -f /var/log/bot-scheduler/bot-scheduler.log`
- **Response log**: `tail -f /var/log/bot-scheduler/response.log`

### Log Format

```
[2025-10-30 12:00:00] ✅ Bot scheduler called successfully (HTTP 200, 2.45s)
"botsExecuted":3
```

### Check Cron Execution

View system cron logs:
```bash
# Ubuntu/Debian
grep CRON /var/log/syslog

# CentOS/RHEL
tail -f /var/log/cron
```

## 🔄 Update Schedule

To change how often the cron runs:

1. Edit `scripts/setup-cron.sh`
2. Change `CRON_SCHEDULE="*/5 * * * *"` to your desired schedule
3. Run `bash scripts/setup-cron.sh` again

Common schedules:
- `*/5 * * * *` - Every 5 minutes
- `*/1 * * * *` - Every 1 minute
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours

## 🛠️ Troubleshooting

### Script Not Running

1. **Check script permissions**:
   ```bash
   ls -l scripts/call-bot-scheduler.sh
   # Should show: -rwxr-xr-x
   ```

2. **Check cron is running**:
   ```bash
   systemctl status cron    # Ubuntu/Debian
   service crond status     # CentOS/RHEL
   ```

3. **Check cron job exists**:
   ```bash
   crontab -l
   ```

### Getting 401 Unauthorized

- Verify `.env.cron` has correct `CRON_SECRET`
- Ensure `CRON_SECRET` in `.env.cron` matches Supabase Secrets
- Check Supabase Edge Function logs for details

### Script Path Issues

If cron can't find the script, use absolute paths in `setup-cron.sh`:
```bash
# Instead of relative path, use:
FULL_PATH="/full/path/to/project/scripts/call-bot-scheduler.sh"
```

## 🔒 Security Notes

1. **Never commit `.env.cron`** - It's in `.gitignore`
2. **Protect `.env.cron` file**:
   ```bash
   chmod 600 .env.cron
   ```
3. **Use strong CRON_SECRET** - Generate a new one if compromised

## ✅ Verification Checklist

- [ ] `.env.cron` created with correct values
- [ ] Scripts are executable
- [ ] Cron job installed (`crontab -l` shows the entry)
- [ ] Manual test works (`bash scripts/call-bot-scheduler.sh`)
- [ ] Logs directory exists and is writable
- [ ] First automated run appears in logs
- [ ] Supabase Edge Function logs show successful executions

## 🎯 Next Steps

Once setup is complete:
1. Disable browser-based auto-execution in `src/hooks/useBotExecutor.ts` (optional, prevents double execution)
2. Monitor logs for the first few runs
3. Check Supabase Edge Function logs to verify bots are executing
4. Verify trades are being placed in your database

---

**Your bots will now trade 24/7! 🚀**

