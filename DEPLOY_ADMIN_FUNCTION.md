# Deploy Admin Management Enhanced Function

## Problem
The `admin-management-enhanced` Supabase Edge Function is not deployed, causing CORS errors when trying to access admin features.

## Error Message
```
Access to fetch at 'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/admin-management-enhanced' 
from origin 'http://185.186.25.102:3000' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check
```

## Solution

### Option 1: Deploy via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard at https://supabase.com/dashboard
2. Select your project (dkawxgwdqiirgmmjbvhc)
3. Navigate to **Edge Functions** in the left sidebar
4. Click **"Create a new function"** or **"+ New Function"**
5. Enter the function name: `admin-management-enhanced`
6. Copy the contents of `supabase/functions/admin-management-enhanced/index.ts`
7. Paste it into the function editor
8. Click **"Deploy"** or **"Save"**

### Option 2: Deploy via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref dkawxgwdqiirgmmjbvhc

# Deploy the function
supabase functions deploy admin-management-enhanced
```

### Option 3: Install Supabase CLI First

If the CLI is not installed:

**Windows (PowerShell):**
```powershell
# Install Supabase CLI
scoop install supabase
# Or
choco install supabase

# Then deploy
supabase functions deploy admin-management-enhanced
```

**macOS/Linux:**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Then deploy
supabase functions deploy admin-management-enhanced
```

### Option 4: Deploy via Supabase Dashboard - Manual Upload

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click **"New Function"**
4. Name it: `admin-management-enhanced`
5. Select the **"Files"** tab
6. Click **"Upload files"**
7. Navigate to: `supabase/functions/admin-management-enhanced/`
8. Upload both files:
   - `index.ts`
   - `deno.json`
9. Click **"Deploy"**

## Verify Deployment

After deploying, verify the function is working:

1. In Supabase Dashboard, go to **Edge Functions**
2. Click on `admin-management-enhanced`
3. Click **"Test"** or use the logs tab
4. Try refreshing your admin page

## Test the Function

You can test the function by sending a request:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/admin-management-enhanced \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "getSystemStats"}'
```

## After Deployment

Once deployed, the admin panel should work without CORS errors. The function handles:
- User management (get, create, delete users)
- Invitation code management
- Trading bot management
- System statistics
- Trading analytics
- Financial overview
- User activity monitoring
- System logs
- Risk metrics
- Data export

## Troubleshooting

If you still see CORS errors after deployment:
1. Clear your browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check Supabase Edge Function logs
4. Verify the function is deployed and active in the dashboard
5. Check that CORS headers are properly set in the function code

