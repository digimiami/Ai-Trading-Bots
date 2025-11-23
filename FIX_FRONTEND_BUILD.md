# 🔧 Fix Frontend Build Issue

## Problem
- `404 (Not Found)` for JS/CSS files
- CSS served as `text/html` instead of CSS
- Build files missing or outdated

## Solution: Rebuild and Deploy

**Run these commands on your server:**

```bash
# 1. Navigate to project directory
cd /var/www/Ai-Trading-Bots

# 2. Pull latest code (if needed)
git pull

# 3. Make sure .env file exists with correct keys
cat .env

# 4. Rebuild the frontend
npm run build

# 5. Remove old build directory
rm -rf out

# 6. Copy new build to out directory (vite preview serves from 'out')
cp -r dist out

# 7. Restart PM2 to serve new build
pm2 restart pablobots --update-env

# 8. Check PM2 status
pm2 status

# 9. Check logs for errors
pm2 logs pablobots --lines 20
```

## Alternative: Configure Vite Preview to Use `dist`

If you want to avoid copying files, update `vite.config.ts`:

```typescript
preview: {
  host: true,
  port: 4173,
  outDir: 'dist',  // Serve directly from dist
  // ... rest of config
}
```

Then restart PM2.

## Quick One-Liner (if on server)

```bash
cd /var/www/Ai-Trading-Bots && git pull && npm run build && rm -rf out && cp -r dist out && pm2 restart pablobots --update-env
```

