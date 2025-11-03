# 🔍 Debug: DeepSeek Still Showing "Not Configured"

## Step-by-Step Debugging Guide

### 1. ✅ Verify Edge Function is Deployed with Latest Code

1. Go to Supabase Dashboard → Edge Functions → Functions → `check-ai-keys`
2. **VERIFY** the code includes the debug logging (lines 34-46)
3. If not, **REDEPLOY** with latest code from `supabase/functions/check-ai-keys/index.ts`

### 2. 🔍 Check Edge Function Logs

1. Dashboard → Edge Functions → `check-ai-keys` → **Logs**
2. Invoke the function (click "Invoke" or "Test")
3. Look for these logs:
   ```
   🔍 [check-ai-keys] Checking secrets:
      OPENAI_API_KEY present: true/false
      DEEPSEEK_API_KEY present: true/false
      All AI-related env keys: DEEPSEEK_API_KEY, OPENAI_API_KEY, ...
   ```
4. **What to look for:**
   - If `DEEPSEEK_API_KEY present: false` → Secret name might be wrong
   - Check `All AI-related env keys` list - see what keys actually exist

### 3. 🔑 Verify Secret Names

In Supabase Dashboard → Edge Functions → Secrets, check:
- Secret name must be **exactly**: `DEEPSEEK_API_KEY` (case-sensitive)
- NOT `deepseek_api_key`, NOT `DEEPSEEK-API-KEY`, etc.

**Common mistakes:**
- ❌ `deepseek_api_key` (lowercase)
- ❌ `DEEPSEEK-API-KEY` (hyphens)
- ❌ `VITE_DEEPSEEK_API_KEY` (should be without VITE_)
- ✅ `DEEPSEEK_API_KEY` (correct)

### 4. 🌐 Check Browser Console

Open your app → F12 → Console tab:

**Expected logs:**
```
🔍 [PairRecommendations] Checking AI keys from Edge Function...
✅ [PairRecommendations] Keys status: {openai: true, deepseek: true}
🔍 [PairRecommendations] Provider availability - OpenAI: true, DeepSeek: true
✅ AI keys status from Edge Function: {openai: true, deepseek: true}
🔍 Debug info from Edge Function: {
  deepseekKeyPresent: true,
  deepseekKeyLength: 51
}
```

**If you see errors:**
- `401 Unauthorized` → Not logged in
- `404 Not Found` → Function not deployed
- `500 Internal Server Error` → Check Edge Function logs

### 5. 🔄 Force Refresh

After deploying updated function:
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check console again

### 6. 📋 Quick Test in Dashboard

1. Dashboard → Functions → `check-ai-keys` → **Invoke**
2. Expected response:
   ```json
   {
     "openai": { "available": true, "configured": true },
     "deepseek": { "available": true, "configured": true },
     "debug": {
       "deepseekKeyPresent": true,
       "deepseekKeyLength": 51
     }
   }
   ```

### 7. 🐛 If Still Not Working

**Check Secret Names:**
- The secret might be named differently in your dashboard
- Look at the list of secrets and find the exact name
- Update the Edge Function code to check for that exact name

**Example:** If your secret is named `DEEP_SEEK_API_KEY`, update:
```typescript
const deepSeekKey = Deno.env.get('DEEP_SEEK_API_KEY') || Deno.env.get('DEEPSEEK_API_KEY') || '';
```

## Common Issues & Fixes

| Issue | Solution |
|------|----------|
| Secret name mismatch | Check exact name in dashboard, update code |
| Function not deployed | Redeploy in dashboard |
| 401 Unauthorized | Make sure you're logged into the app |
| Cached status | Hard refresh browser, clear cache |
| Function returns false | Check Edge Function logs to see why |

## Need Help?

Share:
1. Edge Function logs output
2. Browser console logs
3. Secret names from dashboard
4. Function test response

This will help identify the exact issue! 🔍

