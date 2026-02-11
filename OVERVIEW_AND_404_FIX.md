# Project Overview & Fixing 404 Errors

## Project Overview

**Pablo AI Trading** is a crypto trading platform with:

- **Frontend**: React (Vite), React Router, Supabase client. Single-page app (SPA) with many client-side routes.
- **Backend**: Supabase (Postgres, Auth, Edge Functions). Trading logic runs in Edge Functions (e.g. `bot-executor`, `bot-scheduler`, `admin-email`, `email-inbound`).
- **Hosting**: Static build (`npm run build` → `dist/`) served by **Nginx** (VPS) or **Vercel**.

### Main areas

| Area | Description |
|------|-------------|
| **Trading bots** | Create/edit bots, connect exchanges (Bybit, OKX, Bitunix, BTCC), run strategy (RSI/ADX, ATR-based SL/TP), paper and live trading. |
| **Futures pair finder** | Scoring and filters for futures pairs; “Winners” and backtest flows. |
| **Positions & trades** | Positions, transaction log, performance, manual trading (admin). |
| **Pablo Ready** | Pre-configured bots users can clone. |
| **Admin** | Users, mailboxes, Email Center, subscriptions, notifications. |
| **Academy, market, news** | Content and market dashboard. |

### Important routes (all SPA – one `index.html`)

- `/`, `/dashboard`, `/bots`, `/create-bot`, `/edit-bot/:id`, `/futures-pairs-finder`, `/positions`, `/trades`, `/performance`, `/settings`, `/pablo-ready`, `/admin`, `/auth`, `/contact`, `/messages`, `/backtest`, `/winners`, `/paper-trading`, `/bot-activity`, `/transaction-log`, and others.

If the server doesn’t serve `index.html` for these paths, you get **404** (or a blank page).

---

## Why You Get 404

The app is an **SPA**: there is a single entry file (`index.html`) and React Router handles URLs in the browser. The server must:

- Serve real files when they exist (e.g. `/assets/…`, `/favicon.svg`, `index.html` for `/`).
- For **any other path** (e.g. `/create-bot`, `/futures-pairs-finder`, `/dashboard`), serve **the same** `index.html` so the JS bundle loads and the router can show the right page.

If the server is not configured to do that, it looks for a file at `/create-bot` (or similar), doesn’t find it, and returns **404**.

---

## Fix 404 by Host

### A) Vercel

1. **Build & output**
   - Project → Settings → Build & Output:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

2. **SPA rewrites** (in `vercel.json`; already in repo)
   - Root: `"/"` → `"/index.html"`
   - All other non-asset paths: `"/(.*)"` → `"/index.html"` (or the existing regex that excludes `assets/`, `favicon`, etc.).

3. **Redeploy**
   - Push and let Vercel redeploy, or trigger a redeploy from the dashboard.

4. **Check**
   - Open `https://your-app.vercel.app/create-bot` and `https://your-app.vercel.app/futures-pairs-finder` – both should load the app, not 404.

### B) Nginx (VPS, e.g. pablobots.com)

1. **Use the SPA config from the repo**
   - The repo’s nginx config uses a **location @spa** that serves `index.html` for any path that isn’t a real file:
   ```nginx
   location / {
     try_files $uri $uri/ @spa;
   }
   location @spa {
     rewrite ^ /index.html last;
   }
   ```

2. **Apply it on the server**
   ```bash
   cd /var/www/Ai-Trading-Bots
   git pull origin master
   sudo bash scripts/setup-nginx.sh
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Ensure the build exists**
   ```bash
   ls -la /var/www/Ai-Trading-Bots/dist/index.html
   ```
   If missing: `npm ci && npm run build`.

4. **Only one site for this app**
   ```bash
  ls -la /etc/nginx/sites-enabled/
   ```
   Remove any duplicate or default site that might catch requests before your SPA config (e.g. another `server` with the same `server_name`).

5. **Check**
   ```bash
   curl -I http://127.0.0.1/create-bot
   curl -I http://127.0.0.1/futures-pairs-finder
   ```
   Both should return **200** and HTML (same as `/`).

### C) Other hosts (Netlify, Cloudflare Pages, etc.)

- **Build**: `npm run build`, output directory `dist`.
- **Redirects/rewrites**: Add a rule so that **all routes** (or all except `/assets/*` and static files) rewrite to **`/index.html`** (SPA fallback). No special handling per route name is needed.

---

## Quick checklist

- [ ] Build runs: `npm run build` and `dist/index.html` (and `dist/assets/`) exist.
- [ ] **Vercel**: Output directory = `dist`, `vercel.json` has SPA rewrites, latest deploy succeeded.
- [ ] **Nginx**: `scripts/setup-nginx.sh` has been run, `root` points to `.../dist`, only one relevant site enabled, `nginx -t` and reload done.
- [ ] Direct URL test: open `https://your-domain.com/create-bot` (or `/futures-pairs-finder`) – page loads, no 404.

---

## More detail in repo

- **Nginx 404/blank**: [FIX_SPA_404_BLANK_PAGE.md](./FIX_SPA_404_BLANK_PAGE.md)
- **502 Bad Gateway**: [FIX_502_BAD_GATEWAY.md](./FIX_502_BAD_GATEWAY.md)
