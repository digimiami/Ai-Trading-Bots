# 🚀 Deploy Bot Report Function

## Manual Deployment via Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Select your **Pablo AI Trading** project
3. Navigate to **Edge Functions** in the left sidebar

### Step 2: Create New Function

1. Click **"Create a new function"** or **"New Function"**
2. Function Name: `bot-report`
3. Click **"Create function"**

### Step 3: Copy and Paste Code

1. Open the file: `supabase/functions/bot-report/index.ts`
2. **Copy ALL the code** from the file
3. **Paste it** into the function editor in Supabase Dashboard
4. Click **"Deploy"** or **"Save"**

### Step 4: Verify Deployment

After deploying, test the function:

1. Go to your Bot Activity page in the app
2. Click **"Generate Report"** button
3. Check if the report loads successfully

## Alternative: Using Supabase CLI (if installed)

If you have Supabase CLI installed, you can deploy directly:

```bash
# Login to Supabase
supabase login

# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy the bot-report function
supabase functions deploy bot-report
```

## What This Function Does

- ✅ Generates comprehensive bot performance report
- ✅ Calculates Total P&L from actual trades data
- ✅ Calculates fees from volume (if not stored)
- ✅ Shows contract-level performance summary
- ✅ Includes both active and inactive bots
- ✅ Real-time data fetching

## Function Endpoint

After deployment, the function will be available at:
```
https://your-project.supabase.co/functions/v1/bot-report
```

## Troubleshooting

If the function doesn't work:

1. Check Supabase Edge Function logs for errors
2. Verify authentication is working
3. Ensure the function has proper CORS headers
4. Check that trades and bots tables are accessible

