# Supabase Domain Configuration Guide

## Problem
When accessing the site via domain name (pablobots.net) instead of IP address, authentication sessions time out after page refresh.

## Root Cause
Supabase needs your domain added to the allowed redirect URLs in the Supabase Dashboard. Without this, authentication sessions may not work properly when using a custom domain.

## Solution

### Step 1: Add Domain to Supabase Redirect URLs

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project: `Ai Trading Bots` (dkawxgwdqiirgmmjbvhc)

2. **Navigate to Authentication Settings:**
   - Click **Authentication** in the left sidebar
   - Click **URL Configuration** (or find "Redirect URLs" section)

3. **Add Your Domain:**
   Add the following URLs to **Site URL** and **Redirect URLs**:
   
   **Site URL:**
   ```
   https://pablobots.net
   ```
   
   **Redirect URLs (add all):**
   ```
   https://pablobots.net/**
   https://pablobots.net/auth
   https://www.pablobots.net/**
   http://pablobots.net/**
   ```
   
   Also keep your existing URLs (IP address, localhost, etc.):
   ```
   http://185.186.25.102:3000
   http://localhost:3000
   http://localhost:3001
   ```

4. **Save Changes:**
   - Click **Save** or **Update**

### Step 2: Verify Configuration

After adding the domain, test:
1. Clear browser cache and cookies for pablobots.net
2. Visit https://pablobots.net
3. Login with credentials
4. Refresh the page - should stay logged in

### Step 3: Nginx Configuration (if needed)

If you're using Nginx, ensure it's properly configured to pass through authentication cookies:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name pablobots.net www.pablobots.net;

    # SSL configuration (if using HTTPS)
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;  # or your Vite port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: Pass through cookies for authentication
        proxy_cookie_path / /;
        proxy_set_header Cookie $http_cookie;
        
        # Increase timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Step 4: Cookie/Session Settings

If issues persist, check:

1. **Browser Console:**
   - Open DevTools (F12)
   - Check Console for errors
   - Check Application/Storage tab for cookies
   - Look for `sb-*` cookies (Supabase session cookies)

2. **Verify Cookies:**
   - Cookies should have domain set to `pablobots.net` (or no domain restriction)
   - Cookies should be `SameSite=Lax` or `SameSite=None; Secure`

3. **Clear and Test:**
   - Clear all cookies for pablobots.net
   - Try login again
   - Check if cookies are created properly

## Additional Troubleshooting

### If Sessions Still Timeout:

1. **Check Supabase Project Status:**
   - Ensure project is not paused
   - Check project settings in dashboard

2. **Verify Environment Variables:**
   Ensure your `.env` file has correct values:
   ```env
   VITE_PUBLIC_SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
   VITE_PUBLIC_SUPABASE_ANON_KEY=your_actual_key
   ```

3. **Test Direct Supabase Connection:**
   In browser console on pablobots.net:
   ```javascript
   // Check if Supabase is reachable
   fetch('https://dkawxgwdqiirgmmjbvhc.supabase.co/auth/v1/health')
     .then(r => r.json())
     .then(console.log)
   ```

4. **Check Network Tab:**
   - Open DevTools → Network tab
   - Try to login
   - Look for requests to `*.supabase.co`
   - Check if they're being blocked or timing out

## Quick Fix Checklist

✅ Domain added to Supabase redirect URLs
✅ Nginx configured to pass cookies
✅ HTTPS enabled (recommended for production)
✅ Environment variables correct
✅ Browser cache/cookies cleared
✅ Tested on domain (not just IP)

## Need Help?

If issues persist:
1. Check Supabase Dashboard → Logs for authentication errors
2. Check browser console for CORS or network errors
3. Verify Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
4. Test Supabase connectivity from server: `curl https://dkawxgwdqiirgmmjbvhc.supabase.co/auth/v1/health`

