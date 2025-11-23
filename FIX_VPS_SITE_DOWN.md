# 🚨 Fix VPS Site Down - Quick Guide

## Problem
Site at `168.231.114.76` is not loading - connection refused. This is because the VPS deployment failed and PM2 process may have stopped.

## Quick Fix (SSH into Server)

### Step 1: SSH into your VPS
```bash
ssh root@168.231.114.76
# Or use your SSH key if configured
```

### Step 2: Navigate to project directory
```bash
cd /var/www/Ai-Trading-Bots
```

### Step 3: Check PM2 status
```bash
pm2 list
```

**Expected:** You should see `pablobots` process. If it shows `stopped` or `errored`, continue to Step 4.

### Step 4: Restart PM2 process
```bash
# If process exists but is stopped
pm2 restart pablobots

# If process doesn't exist or restart fails
pm2 delete pablobots
pm2 start ecosystem.config.cjs --only pablobots
pm2 save
```

### Step 5: Check if it's running
```bash
pm2 list
pm2 logs pablobots --lines 20
```

**Expected output:**
- Process should show `online` status
- Logs should show: `➜  Local:   http://localhost:4173/`
- Logs should show: `➜  Network: http://168.231.114.76:4173/`

### Step 6: Check if port is listening
```bash
netstat -tlnp | grep 4173
# or
ss -tlnp | grep 4173
```

**Expected:** Should show port 4173 is listening

### Step 7: Check firewall (if still not accessible)
```bash
# Check firewall status
ufw status

# If port 4173 is not open, open it
ufw allow 4173/tcp
ufw reload
```

## Alternative: Full Redeploy

If the above doesn't work, do a full redeploy:

```bash
cd /var/www/Ai-Trading-Bots

# Pull latest code
git pull origin master

# Stop PM2
pm2 stop all

# Install dependencies (if needed)
npm install

# Build
npm run build

# Restart PM2
pm2 restart all
# or if that fails:
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save

# Check status
pm2 list
pm2 logs pablobots --lines 30
```

## Check Nginx (if using reverse proxy)

If you're using Nginx as a reverse proxy:

```bash
# Check Nginx status
systemctl status nginx

# Check Nginx config
nginx -t

# Restart Nginx if needed
systemctl restart nginx

# Check Nginx error logs
tail -f /var/log/nginx/error.log
```

## Verify Site is Up

After fixing, test:
1. **From server:** `curl http://localhost:4173`
2. **From browser:** `http://168.231.114.76:4173`

## Common Issues

### Issue 1: PM2 process crashed
**Solution:** Restart as shown in Step 4

### Issue 2: Port not listening
**Solution:** Check if vite preview is actually running. Check PM2 logs for errors.

### Issue 3: Permission denied for vite
**Solution:** 
```bash
chmod +x node_modules/.bin/vite
chmod +x node_modules/.bin/*
pm2 restart pablobots
```

### Issue 4: Build failed
**Solution:**
```bash
cd /var/www/Ai-Trading-Bots
rm -rf node_modules dist
npm install
npm run build
pm2 restart pablobots
```

## If Still Not Working

Check these:
1. **Server resources:** `htop` or `free -h` (check if out of memory)
2. **Disk space:** `df -h` (check if disk is full)
3. **PM2 logs:** `pm2 logs pablobots --err` (check for errors)
4. **System logs:** `journalctl -xe` (check system errors)

