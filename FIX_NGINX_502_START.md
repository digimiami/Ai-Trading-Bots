# Fix Nginx 502 / "nginx.service is not active"

## Problem
- `nginx.service is not active, cannot reload`
- Or: `conflicting server name "pablobots.net" on 0.0.0.0:80, ignored`

## Fix (run on VPS as root)

### 1. Start Nginx
```bash
sudo systemctl start nginx
```

### 2. (Optional) Fix duplicate server_name warning
If you saw "conflicting server name pablobots.net", another config is also defining the same domains. Remove the duplicate:

```bash
# List enabled site configs
ls -la /etc/nginx/sites-enabled/

# You should see only one pablobots config. If you see two files (e.g. pablobots and default, or two pablobots), remove the one that is NOT the symlink to sites-available/pablobots:
# sudo rm /etc/nginx/sites-enabled/default   # if default still exists
# Or remove whichever extra file lists pablobots.net

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### 3. Enable Nginx on boot (so it starts after reboot)
```bash
sudo systemctl enable nginx
```

### 4. Verify
```bash
sudo systemctl status nginx
curl -I http://localhost/
```
Then open https://pablobots.com in a browser — it should load without 502.
