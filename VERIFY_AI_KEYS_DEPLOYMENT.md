# ✅ Verify AI Keys Deployment

## 🎯 Quick Test Steps

### 1. Test the Edge Function Directly
1. Go to Supabase Dashboard → Edge Functions → Functions → `check-ai-keys`
2. Click **"Invoke"** or **"Test"**
3. Expected response:
   ```json
   {
     "openai": { "available": true, "configured": true },
     "deepseek": { "available": true, "configured": true }
   }
   ```

### 2. Test in Your App

#### Settings Page:
1. Go to: **Settings** → **AI Recommendations** section
2. You should see:
   - ✅ Status indicator showing "Both Configured" or "DeepSeek Only"
   - ✅ DeepSeek API showing "Configured • [masked key]"
   - ✅ OpenAI API showing status

#### Create Bot Page:
1. Go to: **Create Bot** page
2. Scroll to **AI Recommendations** section
3. You should see:
   - ✅ Dropdown showing "DeepSeek" (not "(Not configured)")
   - ✅ "Get AI Recommendations" button enabled
   - ✅ No warning messages about missing keys

### 3. Check Browser Console

Open browser console (F12) and look for:

**✅ Success messages:**
```
✅ AI keys status from Edge Function: {openai: true, deepseek: true}
✅ DeepSeek API key loaded from storage
🔄 AI API keys refreshed: {openai: true, deepseek: true}
```

**❌ If you see errors:**
```
⚠️ Failed to check AI keys from Edge Function: 401
❌ Error checking AI keys from Edge Function: ...
```

## 🔧 Troubleshooting

### Issue: Still showing "Not configured"

1. **Check Edge Function logs:**
   - Dashboard → Edge Functions → `check-ai-keys` → Logs
   - Look for errors or warnings

2. **Verify secrets are in Edge Functions:**
   - Dashboard → Edge Functions → Secrets
   - Ensure `DEEPSEEK_API_KEY` exists (you already have this ✅)
   - Ensure `OPENAI_API_KEY` exists (you already have this ✅)

3. **Clear cache and refresh:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache

4. **Check authentication:**
   - Make sure you're logged in
   - The function requires authentication

### Issue: Function returns 401 Unauthorized

- Make sure you're logged into the app
- Check that your session token is valid
- The function requires user authentication

### Issue: Function returns 500 Error

- Check Edge Function logs in dashboard
- Verify secrets are properly set
- Check function code is correct

## ✅ Expected Behavior After Deployment

1. **On page load:**
   - Client calls `/functions/v1/check-ai-keys`
   - Function checks `Deno.env.get('DEEPSEEK_API_KEY')` and `Deno.env.get('OPENAI_API_KEY')`
   - Returns availability status
   - Client caches the status

2. **In UI:**
   - Settings page shows correct status
   - Pair Recommendations shows DeepSeek as available
   - Dropdowns show providers correctly

3. **In console:**
   - Success logs showing keys detected
   - No error messages

## 🎉 Success Indicators

- ✅ DeepSeek dropdown shows as enabled (not disabled)
- ✅ Status shows "Both Configured" or "DeepSeek Only"
- ✅ Console shows: `✅ AI keys status from Edge Function: {openai: true, deepseek: true}`
- ✅ No "(Not configured)" text next to DeepSeek
- ✅ "Get AI Recommendations" button is enabled

If all these are true, **deployment is successful!** 🚀

