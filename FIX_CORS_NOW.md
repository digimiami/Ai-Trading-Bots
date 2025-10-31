# Quick Fix for CORS Errors

## Immediate Steps

### Step 1: Clear Expired Session (Do This First)

1. Open browser console (Press `F12`)
2. Go to **Console** tab
3. Type this and press Enter:
   ```javascript
   localStorage.clear()
   ```
4. Refresh the page (Press `F5` or `Ctrl+R`)

### Step 2: Configure Supabase to Allow localhost:3000

1. Go to: https://supabase.com/dashboard
2. Select your project: **dkawxgwdqiirgmmjbvhc**
3. Go to **Settings** (gear icon) → **API**
4. Scroll down to **"Allowed Origins"** or **"CORS Origins"**
5. Add these origins:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
6. Click **Save**

### Step 3: Restart Dev Server

1. In your terminal, press `Ctrl+C` to stop the dev server
2. Run: `npm run dev`
3. Open: `http://localhost:3000`
4. Try signing in again

## Alternative: Use Default Vite Port (5173)

If you can't configure Supabase:

1. Edit `vite.config.ts`
2. Change line 88: `port: 3000` → `port: 5173`
3. Save and restart: `npm run dev`
4. Access: `http://localhost:5173`

(Many Supabase projects allow `localhost:5173` by default)

