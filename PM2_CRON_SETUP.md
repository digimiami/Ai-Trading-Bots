# PM2 Cron Job Setup for Bot Scheduler

## ✅ Status: Ready to Deploy

This setup replaces the system cron job with a **PM2-managed cron job** that:
- ✅ Runs automatically every 5 minutes
- ✅ Is managed by PM2 (better monitoring)
- ✅ Auto-restarts on system reboot (if PM2 startup is configured)
- ✅ Has better logging and error handling

## 🚀 Quick Setup

### On Your Server:

```bash
# Navigate to project directory
cd /var/www/Ai-Trading-Bots

# Pull latest changes
git pull

# Make setup script executable
chmod +x scripts/setup-pm2-cron.sh

# Run the setup script
bash scripts/setup-pm2-cron.sh
```

## 📋 What This Does

1. **Removes old system cron job** (`crontab`)
2. **Starts PM2 cron job** using `ecosystem.config.js`
3. **Configures PM2** to run the scheduler every 5 minutes
4. **Saves PM2 configuration** for persistence

## 📊 PM2 Commands

### View Status
```bash
pm2 status
pm2 list
```

### View Logs
```bash
# Real-time logs
pm2 logs bot-scheduler-cron

# Last 50 lines
pm2 logs bot-scheduler-cron --lines 50

# Only errors
pm2 logs bot-scheduler-cron --err
```

### Manage the Cron Job
```bash
# Restart
pm2 restart bot-scheduler-cron

# Stop
pm2 stop bot-scheduler-cron

# Start
pm2 start bot-scheduler-cron

# Delete (to stop permanently)
pm2 delete bot-scheduler-cron
```

### Manual Execution
```bash
# Run immediately (for testing)
pm2 start ecosystem.config.js --only bot-scheduler-cron --no-autorestart
```

## 🔍 Verify It's Working

### 1. Check PM2 Status
```bash
pm2 status
```
Should show `bot-scheduler-cron` with status `online`.

### 2. Check Logs
```bash
pm2 logs bot-scheduler-cron --lines 20
```
Should show recent scheduler execution logs.

### 3. Check System Cron (should be empty)
```bash
crontab -l
```
Should NOT show `call-bot-scheduler.sh` (PM2 handles it now).

### 4. Wait 5 Minutes
After 5 minutes, check logs again:
```bash
pm2 logs bot-scheduler-cron --lines 10
```
Should see new execution logs.

## 📁 Files Created

1. **`ecosystem.config.js`** - PM2 configuration for both web app and cron job
2. **`scripts/bot-scheduler-cron.js`** - Node.js wrapper for the bash script
3. **`scripts/setup-pm2-cron.sh`** - Setup script to install PM2 cron job

## 🔄 Migration from System Cron

The setup script automatically:
- ✅ Removes old `crontab` entry
- ✅ Starts PM2 cron job
- ✅ Saves PM2 configuration

No manual intervention needed!

## 🛠️ Troubleshooting

### PM2 Cron Not Running

1. **Check if PM2 is running:**
   ```bash
   pm2 status
   ```

2. **Check PM2 logs:**
   ```bash
   pm2 logs bot-scheduler-cron
   ```

3. **Restart the cron job:**
   ```bash
   pm2 restart bot-scheduler-cron
   ```

4. **Check ecosystem.config.js:**
   ```bash
   cat ecosystem.config.js | grep -A 10 "bot-scheduler-cron"
   ```

### Cron Job Not Executing

PM2's `cron_restart` requires PM2 to be running. Make sure:
- PM2 is installed: `npm install -g pm2`
- PM2 is running: `pm2 list`
- PM2 startup is configured (optional but recommended):
  ```bash
  pm2 startup
  pm2 save
  ```

### Manual Test

Test the script manually:
```bash
node /var/www/Ai-Trading-Bots/scripts/bot-scheduler-cron.js
```

This should execute the bot scheduler immediately.

## ⚡ Alternative: Use PM2-Cron Module

If `cron_restart` doesn't work, you can install `pm2-cron`:

```bash
npm install -g pm2-cron
pm2 install pm2-cron
```

Then the `cron` property in `ecosystem.config.js` will work.

## 📝 Notes

- The cron job runs **every 5 minutes** (`*/5 * * * *`)
- Logs are stored in: `/var/log/pm2/bot-scheduler-cron-*.log`
- The bash script (`call-bot-scheduler.sh`) is still used, just wrapped by Node.js
- PM2 manages the timing instead of system cron

---

**🎯 Result**: Bot scheduler runs automatically every 5 minutes via PM2, with better monitoring and management!

