# 🚀 Server Deployment Fix Guide

## ❌ Problem

You're getting `Permission denied` errors when trying to run `vite`:
```
sh: 1: vite: Permission denied
```

This usually means:
- `node_modules` is missing or corrupted
- Vite binary doesn't have execute permissions
- Dependencies aren't installed correctly

---

## ✅ Solution: Run These Commands on Your Server

### Option 1: Quick Fix (Recommended First)

```bash
# Navigate to project directory
cd /var/www/Ai-Trading-Bots

# Pull latest changes (includes the fix scripts)
git pull

# Make the quick fix script executable
chmod +x scripts/quick-fix-permissions.sh

# Run the quick fix
bash scripts/quick-fix-permissions.sh

# Restart PM2
pm2 restart all --update-env

# Check status
pm2 status
pm2 logs pablobots --lines 20
```

### Option 2: Full Deployment (If Quick Fix Doesn't Work)

```bash
# Navigate to project directory
cd /var/www/Ai-Trading-Bots

# Pull latest changes
git pull

# Make the deployment script executable
chmod +x scripts/deploy-server.sh

# Run full deployment (installs, builds, restarts)
bash scripts/deploy-server.sh
```

### Option 3: Manual Fix (Step by Step)

```bash
# 1. Navigate to project directory
cd /var/www/Ai-Trading-Bots

# 2. Stop PM2 apps
pm2 stop all

# 3. Install/Reinstall dependencies
npm install

# 4. Fix permissions for all binaries
chmod +x node_modules/.bin/*

# 5. Verify vite works
./node_modules/.bin/vite --version

# 6. Build the project
npm run build

# 7. Verify build files exist
ls -la dist/index.html
ls -la dist/assets/

# 8. Restart PM2 apps
pm2 restart all --update-env

# 9. Save PM2 configuration
pm2 save

# 10. Check status
pm2 status
pm2 logs pablobots --lines 20
```

---

## 🔍 Troubleshooting

### Check PM2 Logs

```bash
# View pablobots logs
pm2 logs pablobots --lines 50

# View only errors
pm2 logs pablobots --err

# View in real-time
pm2 logs pablobots
```

### Check if vite is installed

```bash
cd /var/www/Ai-Trading-Bots
ls -la node_modules/.bin/vite
```

Should show:
```
-rwxr-xr-x ... vite
```

If it shows `-rw-r--r--` (no execute permission), run:
```bash
chmod +x node_modules/.bin/vite
```

### Check if dist folder exists

```bash
cd /var/www/Ai-Trading-Bots
ls -la dist/
ls -la dist/assets/
```

Should show `index.html` and various asset files.

### Verify Node.js and npm

```bash
node --version
npm --version
```

Should show versions like `v18.x.x` and `9.x.x` or similar.

---

## 📋 Expected Output

After running the fix, you should see:

1. **PM2 Status:**
   ```
   ┌────┬───────────────────────┬─────────┬─────────┬──────────┬────────┐
   │ id │ name                  │ status  │ cpu     │ mem      │ uptime │
   ├────┼───────────────────────┼─────────┼─────────┼──────────┼────────┤
   │ 1  │ bot-scheduler-cron    │ online  │ 0%      │ 60.8mb   │ 1m     │
   │ 2  │ pablobots             │ online  │ 0%      │ 22.1mb   │ 1m     │
   └────┴───────────────────────┴─────────┴─────────┴──────────┴────────┘
   ```

2. **PM2 Logs for pablobots:**
   ```
   pablobots | > react@0.0.0 preview
   pablobots | > vite preview
   pablobots | 
   pablobots |   ➜  Local:   http://localhost:4173/
   pablobots |   ➜  Network: use --host to expose
   ```

3. **Website should be accessible at:**
   ```
   http://168.231.114.76:4173/
   ```

---

## 🚨 If Still Not Working

### 1. Check file ownership
```bash
cd /var/www/Ai-Trading-Bots
ls -la
```

If files are owned by a different user, fix ownership:
```bash
chown -R root:root /var/www/Ai-Trading-Bots
```

### 2. Check node_modules integrity
```bash
cd /var/www/Ai-Trading-Bots
rm -rf node_modules package-lock.json
npm install
```

### 3. Check PM2 environment
```bash
pm2 env 2
```

Should show environment variables correctly.

### 4. Check if port 4173 is in use
```bash
netstat -tulpn | grep 4173
# or
lsof -i :4173
```

If another process is using the port, either stop it or change the port in `ecosystem.config.cjs`.

---

## 📝 Notes

- The `pablobots` PM2 app runs `npm run preview` which serves the built files from `dist/`
- Make sure `dist/` folder exists and has all the build files
- The preview server runs on port 4173 (configured in ecosystem.config.cjs)
- After any changes, always run `pm2 restart all --update-env` to apply changes

---

## ✅ Success Checklist

- [ ] Dependencies installed (`npm install` succeeded)
- [ ] Build completed (`npm run build` succeeded)
- [ ] `dist/` folder exists with files
- [ ] Vite binary has execute permissions
- [ ] PM2 apps are running (`pm2 status` shows `online`)
- [ ] Website is accessible at `http://168.231.114.76:4173/`
- [ ] No 404 errors in browser console
- [ ] Technical Analysis gauges are visible on `/market-dashboard`

---

## 🆘 Still Need Help?

If you're still experiencing issues, check:
1. PM2 logs: `pm2 logs pablobots --lines 100`
2. System logs: `journalctl -u pm2-*` (if using systemd)
3. Server resources: `free -h` and `df -h`
4. Node.js version compatibility with your project

