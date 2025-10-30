# How to Set OpenAI API Key in Supabase Edge Function Secrets

## 📍 Where to Set the Secret

The `auto-optimize` function reads the OpenAI API key from **Supabase Edge Function Secrets**.

## 🎯 Step-by-Step Instructions

### Method 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open Project Settings**
   - Click the **gear icon** (⚙️) in the left sidebar
   - Click **"Project Settings"**

3. **Go to Edge Functions**
   - In the settings menu, click **"Edge Functions"**
   - Scroll down to the **"Secrets"** section

4. **Add New Secret**
   - Click **"+ Add secret"** or **"Add new secret"** button
   - Fill in the form:
     - **Name**: `OPENAI_API_KEY` (must be exactly this, case-sensitive)
     - **Value**: `sk-your-actual-openai-api-key-here` (paste your OpenAI key)
   - Click **"Save"** or **"Add secret"**

5. **Verify**
   - You should see `OPENAI_API_KEY` in the secrets list
   - Status should show as active/enabled

### Method 2: Via Supabase CLI

```bash
# Set the secret via CLI
supabase secrets set OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Verify it's set
supabase secrets list
```

### Method 3: Via Supabase API

```bash
curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/secrets' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "OPENAI_API_KEY",
    "value": "sk-your-actual-openai-api-key-here"
  }'
```

## 🔍 How the Function Accesses the Secret

The function code uses:

```typescript
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
```

**How it works:**
- Supabase automatically injects secrets as environment variables
- When you set a secret named `OPENAI_API_KEY`, it becomes available as `Deno.env.get('OPENAI_API_KEY')`
- No code changes needed - just set the secret and it works!

## ✅ Verification

### Test if Secret is Set Correctly

1. **Via Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Look for `OPENAI_API_KEY` in the list
   - Status should be "Active" or checkmark ✓

2. **Via Function Test:**
   - If secret is NOT set, calling the function will return:
   ```json
   {
     "error": "OpenAI API key not configured",
     "message": "Please set OPENAI_API_KEY in Supabase Edge Function Secrets",
     "instructions": [...]
   }
   ```
   - If secret IS set correctly, the function will work and call OpenAI API

3. **Via CLI:**
   ```bash
   supabase secrets list
   # Should show OPENAI_API_KEY in the output
   ```

## 🔒 Security Notes

- **Secrets are encrypted** and stored securely
- **Not exposed** to frontend code or API responses
- **Only accessible** by Edge Functions
- **Case-sensitive** - must be exactly `OPENAI_API_KEY`
- **No quotes needed** - just paste the key value directly

## 🚨 Troubleshooting

### Error: "OpenAI API key not configured"

**Possible causes:**
1. Secret name is wrong (must be exactly `OPENAI_API_KEY`)
2. Secret not saved properly
3. Secret was deleted

**Fix:**
1. Go to Project Settings → Edge Functions → Secrets
2. Check if `OPENAI_API_KEY` exists
3. If not, add it again
4. Verify the value is correct (starts with `sk-`)
5. Save and test again

### Secret Not Working After Setting

**Try:**
1. Wait 30 seconds for propagation
2. Test the function again
3. Check secret name spelling (case-sensitive)
4. Verify secret value doesn't have extra spaces or quotes

### How to Update Secret

**To change the OpenAI key:**
1. Go to Project Settings → Edge Functions → Secrets
2. Find `OPENAI_API_KEY`
3. Click edit (pencil icon) or remove and re-add
4. Update the value with new key
5. Save

## 📝 Quick Reference

**Secret Name:** `OPENAI_API_KEY`  
**Where to Get Value:** https://platform.openai.com/api-keys  
**Where to Set:** Supabase Dashboard → Project Settings → Edge Functions → Secrets  
**How Code Uses It:** `Deno.env.get('OPENAI_API_KEY')`

## ✅ Checklist

- [ ] Got OpenAI API key from https://platform.openai.com/api-keys
- [ ] Went to Supabase Dashboard → Project Settings → Edge Functions → Secrets
- [ ] Added secret with name: `OPENAI_API_KEY`
- [ ] Added secret with value: `sk-your-actual-key`
- [ ] Clicked Save
- [ ] Verified secret appears in secrets list
- [ ] Tested function and it works

## 🎉 Done!

Once the secret is set, your `auto-optimize` function will automatically use it - no code changes needed!

