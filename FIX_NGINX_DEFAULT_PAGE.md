# Fix Nginx Default Page Issue

## Problem
You're seeing the default nginx welcome page on all 3 new domains instead of your application.

## Quick Fix (Run on VPS)

SSH into your VPS and run:

```bash
# Navigate to project directory
cd /var/www/Ai-Trading-Bots

# Pull latest changes (includes nginx setup script)
git pull origin master

# Run nginx setup script
sudo bash scripts/setup-nginx.sh
```

This will:
1. ✅ Create proper nginx site configuration
2. ✅ Remove default nginx site
3. ✅ Point nginx to your built `dist` folder
4. ✅ Configure all 4 domains (pablobots.com, .live, .online, .net)
5. ✅ Test and reload nginx

## Manual Fix (If Script Doesn't Work)

### Step 1: Create Nginx Site Configuration

```bash
sudo nano /etc/nginx/sites-available/pablobots
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name pablobots.com www.pablobots.com 
                 pablobots.live www.pablobots.live 
                 pablobots.online www.pablobots.online
                 pablobots.net www.pablobots.net
                 localhost;

    root /var/www/Ai-Trading-Bots/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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

    # API proxy to Supabase Edge Functions
    location /api/ {
        proxy_pass https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Save and exit (Ctrl+X, then Y, then Enter).

### Step 2: Remove Default Nginx Site

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Step 3: Enable Your Site

```bash
sudo ln -s /etc/nginx/sites-available/pablobots /etc/nginx/sites-enabled/pablobots
```

### Step 4: Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

### Step 5: Verify

Visit your domains:
- http://pablobots.com
- http://pablobots.live
- http://pablobots.online
- http://pablobots.net

You should now see your application instead of the default nginx page!

## Troubleshooting

### If you still see default page:

1. **Check which site is active:**
   ```bash
   sudo nginx -T | grep server_name
   ```

2. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Verify dist folder exists:**
   ```bash
   ls -la /var/www/Ai-Trading-Bots/dist/
   ```

4. **Check nginx is using correct config:**
   ```bash
   sudo nginx -T | grep -A 5 "server_name"
   ```

5. **Restart nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

### If dist folder is missing:

```bash
cd /var/www/Ai-Trading-Bots
npm run build
```

### If permissions are wrong:

```bash
sudo chown -R www-data:www-data /var/www/Ai-Trading-Bots/dist
sudo chmod -R 755 /var/www/Ai-Trading-Bots/dist
```

## Next Steps

After fixing nginx:

1. ✅ **Add domains to Supabase** (see `ADD_MULTIPLE_DOMAINS.md`)
2. ✅ **Set up SSL certificates** (Let's Encrypt recommended)
3. ✅ **Test authentication** on all domains

## Quick Commands Reference

```bash
# Check nginx status
sudo systemctl status nginx

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# List enabled sites
ls -la /etc/nginx/sites-enabled/
```

