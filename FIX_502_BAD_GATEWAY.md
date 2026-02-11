# Fix 502 Bad Gateway

## What you're seeing
- Browser: `Failed to load resource: the server responded with a status of 502 ()` for the main page and/or `favicon.ico`.
- 502 = **Bad Gateway**: the server (or proxy) couldn't get a valid response from the app/upstream.

## Where are you running the app?

### A) **Vercel**
1. **Redeploy**
   - Dashboard → Your project → Deployments → … on latest → Redeploy.
2. **Build**
   - Deployments → latest deployment → Build logs. If the build fails, fix the errors (often TypeScript or missing env).
3. **Env**
   - Settings → Environment Variables. Ensure any required vars (e.g. `VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY`) are set for the environment you're using (Production/Preview).
4. **Local check**
   - Run `npm run build` locally. If it fails, fix that first, then push and redeploy.

### B) **Your own VPS (Nginx) – 502 on main page or favicon**

Run these **on the server** (SSH in):

**1. See what nginx returns**
```bash
curl -I http://127.0.0.1/health
curl -I http://127.0.0.1/
```
- If **/health** is **200** but **/** is **502**: something is proxying `/` to an app that's down. Use the static-only config (step 4).
- If both 502 or connection refused: nginx may be down (step 2).

**2. Start nginx**
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```
Then: `curl -I http://127.0.0.1/health` (expect 200).

**3. Ensure build exists**
```bash
cd /var/www/Ai-Trading-Bots
ls -la dist/
```
You must see `index.html`, `favicon.svg`, `assets/`. If not: `git pull && npm ci && npm run build`.

**4. Apply static-only config**
If your nginx has `proxy_pass` for `location /`, that upstream can cause 502. Use this repo's config:
```bash
cd /var/www/Ai-Trading-Bots
git pull
sudo bash scripts/setup-nginx.sh
sudo nginx -t
sudo systemctl reload nginx
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/health
```
Both should be 200.

**5. Cloudflare or other proxy**
502 can come from the proxy when the origin is down. Fix nginx first, then check the proxy dashboard.

### C) **Local dev (`npm run dev`)**
- 502 is unusual for the Vite dev server. If you see it:
  1. Restart: stop the dev server (Ctrl+C), run `npm run dev` again.
  2. Try another port: in `vite.config.ts` set `server: { port: 5174 }` (or another free port) and open `http://localhost:5174`.
  3. If you use a local proxy (e.g. nginx, Caddy) in front of the dev server, check that it points to the correct port (e.g. 5173) and that the dev server is running.

## Favicon 502
- Favicon often fails with the same status as the main page (same host/server). Fix the main 502 (above); then favicon usually works.
- If only favicon is 502: ensure `public/favicon.svg` exists and that your host serves it (Vercel redirects `/favicon.ico` → `/favicon.svg`; nginx is configured to serve it).

## Quick local build check
```bash
npm run build
npx vite preview
```
Open the URL shown (e.g. http://localhost:4173). If that works, the app and build are fine; the 502 is from deployment or server config.
