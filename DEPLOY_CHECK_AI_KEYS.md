# Deploy check-ai-keys Edge Function

## Option 1: Deploy via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard
   - Select your project: "Ai Trading Bots (via Readdy)"
   - Go to: **Edge Functions** → **Functions**

2. **Create New Function:**
   - Click **"Create a new function"** or **"New Function"**
   - Name: `check-ai-keys`
   - Click **"Create function"**

3. **Copy Function Code:**
   - Open the file: `supabase/functions/check-ai-keys/index.ts`
   - Copy ALL the code from that file
   - Paste it into the Supabase Dashboard code editor

4. **Deploy:**
   - Click **"Deploy"** button in the dashboard
   - Wait for deployment to complete

## Option 2: Deploy via Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy check-ai-keys
```

## Verify Deployment

1. **Test the Function:**
   - Go to: Edge Functions → Functions → check-ai-keys
   - Click **"Invoke"** or **"Test"**
   - You should see a response like:
     ```json
     {
       "openai": { "available": true, "configured": true },
       "deepseek": { "available": true, "configured": true }
     }
     ```

2. **Verify Secrets are Set:**
   - From the image, I can see you already have:
     - ✅ `DEEPSEEK_API_KEY` (updated: 02 Nov 2025)
     - ✅ `OPENAI_API_KEY` (updated: 30 Oct 2025)
   
   The function will check these secrets automatically!

## Expected Behavior After Deployment

- ✅ Settings page will show "DeepSeek Only" or "Both Configured" status
- ✅ Pair Recommendations component will detect DeepSeek as available
- ✅ Browser console will show: `✅ AI keys status from Edge Function: {openai: true, deepseek: true}`

## Troubleshooting

If DeepSeek still shows "Not configured":
1. Check browser console for errors
2. Verify the Edge Function deployed successfully
3. Ensure `DEEPSEEK_API_KEY` secret is set in Edge Functions secrets (not project secrets)
4. Test the function manually in the dashboard

