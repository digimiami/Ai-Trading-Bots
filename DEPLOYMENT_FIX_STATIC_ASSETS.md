# Fix for 404 Errors on Static Assets (CSS/JS)

## Problem
The server is returning 404 errors for JavaScript and CSS files:
- `index-9e5bd6df.js:1 Failed to load resource: the server responded with a status of 404 ()`
- CSS files are being served as HTML (MIME type issue)

## Root Cause
The server is returning HTML (404 page) instead of the actual CSS/JS files. This happens when:
1. Build files aren't in the correct location
2. Server isn't configured to serve static assets correctly
3. Build wasn't run after code changes

## Solution

### Step 1: Rebuild the Application

On the VPS server, run:

```bash
cd /var/www/Ai-Trading-Bots
npm run build
```

This will create/update the `dist` folder with all assets.

### Step 2: Verify Build Output

Check that the `dist` folder exists and contains assets:

```bash
ls -la dist/
ls -la dist/assets/
```

You should see files like:
- `index.html`
- `assets/index-[hash].js`
- `assets/index-[hash].css`

### Step 3: Restart PM2 Process

```bash
pm2 restart pablobots
```

Or if using the ecosystem config:

```bash
pm2 restart ecosystem.config.cjs
```

### Step 4: Verify Nginx Configuration

The nginx config has been updated to properly serve static assets. If you're using nginx, ensure it's configured correctly:

```nginx
# Serve static assets directly
location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# SPA routing - must come after static assets
location / {
    try_files $uri $uri/ /index.html;
}
```

### Step 5: Clear Browser Cache

After the fix:
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Or clear browser cache completely

## Quick Fix Script

Run this on the VPS:

```bash
cd /var/www/Ai-Trading-Bots
git pull origin master
npm install
npm run build
pm2 restart pablobots
```

## Verification

After applying the fix:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Check that:
   - `index-[hash].js` returns 200 (not 404)
   - `index-[hash].css` returns 200 with MIME type `text/css` (not `text/html`)

## If Issues Persist

1. **Check PM2 logs:**
   ```bash
   pm2 logs pablobots
   ```

2. **Check if dist folder exists:**
   ```bash
   ls -la /var/www/Ai-Trading-Bots/dist/
   ```

3. **Check file permissions:**
   ```bash
   chmod -R 755 /var/www/Ai-Trading-Bots/dist/
   ```

4. **Verify vite preview is serving from correct directory:**
   The `vite.config.ts` has been updated to ensure proper build output structure.

