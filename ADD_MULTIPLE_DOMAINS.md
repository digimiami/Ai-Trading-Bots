# Add Multiple Domains Guide

This guide shows how to add 3 new domains to your site:
- `pablobots.com`
- `pablobots.live`
- `pablobots.online`

## ✅ Code Changes (Already Applied)

The following files have been updated:
- ✅ `vite.config.ts` - Added new domains to `allowedHosts`
- ✅ `nginx.conf` - Added new domains to `server_name`

## Step 1: Configure Supabase Redirect URLs

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/auth/url-configuration

2. **Update Site URL:**
   - Set primary domain (or keep existing):
   ```
   https://pablobots.com
   ```

3. **Add All Domains to Redirect URLs:**
   Add these URLs (one per line or comma-separated):
   ```
   https://pablobots.com/**
   https://www.pablobots.com/**
   https://pablobots.live/**
   https://www.pablobots.live/**
   https://pablobots.online/**
   https://www.pablobots.online/**
   https://pablobots.net/**
   https://www.pablobots.net/**
   http://pablobots.com/**
   http://pablobots.live/**
   http://pablobots.online/**
   http://pablobots.net/**
   ```

   **Also keep existing URLs:**
   ```
   http://185.186.25.102:3000
   http://localhost:3000
   http://localhost:3001
   ```

4. **Save Changes**

## Step 2: DNS Configuration

Make sure all domains point to your server IP (`185.186.25.102`):

1. **For each domain** (pablobots.com, pablobots.live, pablobots.online):
   - Add A record: `@` → `185.186.25.102`
   - Add A record: `www` → `185.186.25.102`

2. **Wait for DNS propagation** (can take up to 48 hours, usually 1-2 hours)

3. **Verify DNS:**
   ```bash
   nslookup pablobots.com
   nslookup pablobots.live
   nslookup pablobots.online
   ```

## Step 3: SSL Certificates (Recommended)

For HTTPS, you'll need SSL certificates for each domain. Options:

### Option A: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificates for all domains
sudo certbot --nginx -d pablobots.com -d www.pablobots.com
sudo certbot --nginx -d pablobots.live -d www.pablobots.live
sudo certbot --nginx -d pablobots.online -d www.pablobots.online
```

### Option B: Cloudflare (Free SSL)
- Add all domains to Cloudflare
- Enable "Full" or "Full (strict)" SSL mode
- Cloudflare will provide free SSL certificates

## Step 4: Update Nginx on VPS (If Not Auto-Deployed)

If your VPS doesn't auto-deploy from GitHub, update Nginx manually:

1. **SSH into your VPS:**
   ```bash
   ssh user@185.186.25.102
   ```

2. **Update nginx.conf:**
   - Copy the updated `nginx.conf` from the repository
   - Or manually update the `server_name` line

3. **Test and reload Nginx:**
   ```bash
   sudo nginx -t  # Test configuration
   sudo systemctl reload nginx  # Reload if test passes
   ```

## Step 5: Rebuild and Deploy

After making changes:

```bash
# Rebuild frontend
npm run build

# Deploy (if using PM2 or similar)
pm2 restart all
```

**Note:** If you have auto-deployment from GitHub, the changes will be deployed automatically after you push.

## Step 6: Test Each Domain

Test each domain:
1. Visit `https://pablobots.com` (or http:// if SSL not set up)
2. Visit `https://pablobots.live`
3. Visit `https://pablobots.online`
4. Try logging in on each domain
5. Verify authentication works (session persists after refresh)

## Troubleshooting

### If authentication doesn't work:
- ✅ Verify domain is in Supabase redirect URLs
- ✅ Check browser console for errors
- ✅ Clear cookies and try again
- ✅ Verify DNS is pointing to correct IP

### If site doesn't load:
- ✅ Check Nginx is running: `sudo systemctl status nginx`
- ✅ Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- ✅ Verify DNS propagation: `nslookup your-domain.com`
- ✅ Check firewall allows ports 80 and 443

## Quick Checklist

- [x] Updated `vite.config.ts` with new domains
- [x] Updated `nginx.conf` with new domains
- [ ] Added all domains to Supabase redirect URLs
- [ ] Configured DNS A records
- [ ] Set up SSL certificates (optional but recommended)
- [ ] Rebuilt frontend (`npm run build`) - Auto if GitHub auto-deploys
- [ ] Tested each domain
- [ ] Verified authentication works on all domains

