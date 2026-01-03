# 🚨 URGENT: Fix 404 Errors for Assets

## Problem
Getting 404 errors for JavaScript and CSS files:
- `GET https://pablobots.com/assets/index-dcd2eadc.js net::ERR_ABORTED 404 (Not Found)`
- `GET https://pablobots.com/assets/index-5ae71c4f.css net::ERR_ABORTED 404 (Not Found)`

## Quick Fix (Run on VPS Server)

### Step 1: SSH into your VPS
```bash
ssh your-user@your-vps-ip
```

### Step 2: Navigate to project directory
```bash
cd /var/www/Ai-Trading-Bots
# OR wherever your project is located
```

### Step 3: Pull latest changes
```bash
git pull origin master
```

### Step 4: Install dependencies (if needed)
```bash
npm install
```

### Step 5: Build the application
```bash
npm run build
```

This creates the `dist` folder with all assets.

### Step 6: Verify build output
```bash
ls -la dist/
ls -la dist/assets/
```

You should see:
- `index.html`
- `assets/index-[hash].js`
- `assets/index-[hash].css`

### Step 7: Restart PM2
```bash
pm2 restart pablobots
# OR
pm2 restart ecosystem.config.cjs
```

### Step 8: Check PM2 status
```bash
pm2 status
pm2 logs pablobots --lines 50
```

## Alternative: One-Line Fix

If you're already in the project directory:
```bash
git pull && npm install && npm run build && pm2 restart pablobots
```

## Verify Fix

1. Open browser DevTools (F12)
2. Go to Network tab
3. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
4. Check that:
   - `index-[hash].js` returns **200** (not 404)
   - `index-[hash].css` returns **200** with MIME type `text/css`

## If Issues Persist

### Check file permissions:
```bash
chmod -R 755 dist/
chown -R www-data:www-data dist/  # Adjust user/group as needed
```

### Check if dist folder exists:
```bash
ls -la dist/
```

### Check PM2 is serving from correct directory:
```bash
pm2 show pablobots
# Check the "script" path - should point to dist folder or vite preview
```

### Check nginx configuration (if using nginx):
```bash
sudo nginx -t
sudo systemctl reload nginx
```

The nginx config should have:
```nginx
location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location / {
    try_files $uri $uri/ /index.html;
}
```

## Root Cause

The 404 errors happen when:
1. ✅ Build hasn't been run after code changes
2. ✅ Assets are in wrong location
3. ✅ Server isn't configured to serve static assets
4. ✅ PM2 process is serving from wrong directory

## Prevention

After every code change:
1. Run `npm run build`
2. Restart PM2: `pm2 restart pablobots`

Or set up automatic deployment via GitHub Actions or CI/CD.

