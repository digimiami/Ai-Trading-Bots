# 🚀 Quick Deploy Instructions for check-ai-keys

## ✅ Your Secrets are Already Set!

I can see from your dashboard that you already have:
- ✅ `DEEPSEEK_API_KEY` (set on 02 Nov 2025)
- ✅ `OPENAI_API_KEY` (set on 30 Oct 2025)

## 🎯 Deployment Options:

### Option 1: Deploy via Supabase Dashboard (FASTEST - 2 minutes)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions

2. **Create New Function:**
   - Click **"Create a new function"**
   - Function name: `check-ai-keys`
   - Click **"Create function"**

3. **Paste the Code:**
   - Open file: `supabase/functions/check-ai-keys/index.ts`
   - Copy ALL code
   - Paste into dashboard editor
   - Click **"Deploy"**

### Option 2: Wait for GitHub Actions (AUTOMATIC)

The function will auto-deploy when you push to master branch.
I've already updated `.github/workflows/deploy.yml` to include it.

### Option 3: Manual CLI Deploy (if you have Supabase CLI)

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy check-ai-keys
```

## ✅ After Deployment:

1. Refresh your app
2. Open browser console (F12)
3. Look for: `✅ AI keys status from Edge Function: {openai: true, deepseek: true}`
4. DeepSeek should now show as **"Configured"** ✅

## 🔍 Test the Function:

1. Go to: Edge Functions → Functions → check-ai-keys
2. Click **"Invoke"** or **"Test"**
3. Should return:
   ```json
   {
     "openai": { "available": true, "configured": true },
     "deepseek": { "available": true, "configured": true }
   }
   ```

