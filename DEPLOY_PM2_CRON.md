# 🚀 Deploy PM2 Cron Job - Quick Start

## ✅ Files Created

1. ✅ `ecosystem.config.js` - PM2 configuration
2. ✅ `scripts/bot-scheduler-cron.cjs` - Node.js cron job script
3. ✅ `scripts/setup-pm2-cron.sh` - Setup script

## 🔧 Quick Setup (On Your Server)

```bash
# Navigate to project
cd /var/www/Ai-Trading-Bots

# Pull latest changes
git pull

# Make setup script executable
chmod +x scripts/setup-pm2-cron.sh

# Run setup
bash scripts/setup-pm2-cron.sh
```

## 📋 What the Setup Does

1. ✅ Removes old system cron job (`crontab`)
2. ✅ Starts PM2 cron job from `ecosystem.config.js`
3. ✅ Configures PM2 to manage the cron job
4. ✅ Saves PM2 configuration for persistence

## 🎯 Result

The bot scheduler will now:
- ✅ Run **automatically every 5 minutes**
- ✅ Be **managed by PM2** (better monitoring)
- ✅ **Auto-restart** if PM2 is configured for startup
- ✅ Have **better logs** via PM2

## 📊 Monitor It

```bash
# Check status
pm2 status

# View logs
pm2 logs bot-scheduler-cron

# View last 50 lines
pm2 logs bot-scheduler-cron --lines 50
```

## 🛠️ Manual Commands

```bash
# Restart
pm2 restart bot-scheduler-cron

# Stop
pm2 stop bot-scheduler-cron

# Start
pm2 start bot-scheduler-cron

# Delete (to remove)
pm2 delete bot-scheduler-cron
```

## ⚡ Optional: Install node-cron (Recommended)

For better cron support, install `node-cron`:

```bash
npm install node-cron
```

The script will automatically use it if available, otherwise falls back to `setInterval`.

---

**🎯 After running `setup-pm2-cron.sh`, your bot scheduler will run automatically every 5 minutes via PM2!**

