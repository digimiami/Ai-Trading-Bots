# Fix 404 / Blank Page on Futures, Create Bot, etc.

## Problem
- Going to **Futures** or **Create Bot** (or other app routes) shows a blank page
- Browser shows: `(index):1 Failed to load resource: the server responded with a status of 404 ()`

## Cause
The server returns 404 for routes like `/create-bot` and `/futures-pairs-finder` instead of serving `index.html` (SPA fallback). The app needs the same HTML for all routes so the client router can load.

## Fix (VPS with Nginx)

### 1. Pull latest code and re-run nginx setup
On the VPS:

```bash
cd /var/www/Ai-Trading-Bots
git pull origin master
sudo bash scripts/setup-nginx.sh
```

This updates the nginx config to use the **@spa** fallback so any non-file path serves `index.html`.

### 2. If nginx wasn’t running
```bash
sudo systemctl start nginx
sudo systemctl reload nginx
```

### 3. Verify
```bash
# Should return 200 and HTML (not 404)
curl -I http://localhost/create-bot
curl -I http://localhost/futures-pairs-finder
```

Then in the browser: open https://pablobots.com/create-bot and https://pablobots.com/futures-pairs-finder — they should load, not 404 or blank.

### 4. If it still 404s
- Confirm root and files:
  ```bash
  ls -la /var/www/Ai-Trading-Bots/dist/
  ls -la /var/www/Ai-Trading-Bots/dist/index.html
  ```
- Confirm nginx is using the right site:
  ```bash
  sudo nginx -T | grep -A2 "root "
  ```
  You should see `root /var/www/Ai-Trading-Bots/dist;`
- Check for another server block catching the request:
  ```bash
  ls -la /etc/nginx/sites-enabled/
  ```
  Remove any extra default or duplicate site so only the pablobots config is enabled.

## If you use Vercel
The repo’s `vercel.json` already rewrites `/` and non-asset paths to `/index.html`. If you still see 404 on Vercel for `/create-bot` or `/futures-pairs-finder`, check:
- Project **Build & Output**: Output directory = `dist`
- Latest deployment succeeded and uses the current `vercel.json`
