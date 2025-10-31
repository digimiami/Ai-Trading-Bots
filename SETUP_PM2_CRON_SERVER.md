# 🚀 Setup PM2 Cron Job on Server

## ✅ Files Pushed to Git

The PM2 cron job setup files have been committed and pushed. Now you need to pull them on your server and run the setup.

## 📋 Steps to Run on Server

### 1. Pull Latest Changes

```bash
cd /var/www/Ai-Trading-Bots
git pull
```

### 2. Run Setup Script

```bash
# Make sure script is executable
chmod +x scripts/setup-pm2-cron.sh

# Run setup
bash scripts/setup-pm2-cron.sh
```

This will automatically:
- ✅ Remove old system cron job (`crontab`)
- ✅ Start PM2 cron job from `ecosystem.config.js`
- ✅ Save PM2 configuration

### 3. Verify It's Working

```bash
# Check PM2 status
pm2 status

# Should show "bot-scheduler-cron" in the list
```

### 4. Monitor Logs

```bash
# View logs in real-time
pm2 logs bot-scheduler-cron

# View last 50 lines
pm2 logs bot-scheduler-cron --lines 50
```

## 📊 Expected Output

After running `pm2 status`, you should see:

```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ pablobots          │ fork     │ XX   │ online    │ X%       │ XX.Xmb   │
│ 1  │ bot-scheduler-cron │ fork     │ 0    │ online    │ 0%       │ XX.Xmb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

## 🎯 Result

The bot scheduler will now:
- ✅ Run **automatically every 5 minutes** via PM2
- ✅ Be **monitored by PM2** (better visibility)
- ✅ **Auto-restart** if PM2 is configured for startup
- ✅ Have **centralized logs** in PM2

## 🔍 Verify System Cron is Removed

```bash
# Check system cron (should NOT show call-bot-scheduler.sh)
crontab -l

# Should be empty or not contain bot-scheduler
```

## ⚙️ Optional: Configure PM2 Startup

If you want PM2 to auto-start on system reboot:

```bash
# Generate startup script
pm2 startup

# Follow the instructions it gives you

# Save current PM2 processes
pm2 save
```

## 🛠️ Troubleshooting

### If setup script fails:

1. **Check file permissions:**
   ```bash
   ls -la scripts/setup-pm2-cron.sh
   ls -la scripts/bot-scheduler-cron.cjs
   ```

2. **Make files executable:**
   ```bash
   chmod +x scripts/setup-pm2-cron.sh
   chmod +x scripts/bot-scheduler-cron.cjs
   ```

3. **Check ecosystem.config.js exists:**
   ```bash
   ls -la ecosystem.config.js
   ```

### If PM2 cron job doesn't start:

1. **Check PM2 logs:**
   ```bash
   pm2 logs bot-scheduler-cron --err
   ```

2. **Manually start:**
   ```bash
   pm2 start ecosystem.config.js --only bot-scheduler-cron
   pm2 save
   ```

3. **Test the script directly:**
   ```bash
   node scripts/bot-scheduler-cron.cjs
   ```
   (Press Ctrl+C to stop)

---

**🎯 After completing these steps, your bot scheduler will run automatically every 5 minutes via PM2!**

