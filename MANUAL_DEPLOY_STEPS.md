# Manual Deploy Steps - Auto-Optimize Function

## 📋 Step-by-Step Guide

### Step 1: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Save it somewhere safe** - you'll need it in Step 3

---

### Step 2: Create the Function in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Edge Functions**
   - Click "Edge Functions" in the left sidebar
   - Click "Create a new function"

3. **Set Function Name**
   - Function name: `auto-optimize`
   - Click "Create function"

4. **Paste the Code**
   - Open the file: `AUTO_OPTIMIZE_FULL_CODE.ts`
   - **Copy ALL the code** (Ctrl+A, Ctrl+C)
   - Paste it into the Supabase editor
   - **DO NOT copy the comments at the top** - only copy from `import { serve }...` onwards

5. **Deploy**
   - Click "Deploy" button
   - Wait for deployment to complete (should show ✅)

---

### Step 3: Set OpenAI API Key Secret

1. **Go to Project Settings**
   - Click "Project Settings" (gear icon) in the left sidebar
   - Click "Edge Functions" in the settings menu

2. **Add Secret**
   - Scroll down to "Secrets" section
   - Click "Add new secret"
   - Name: `OPENAI_API_KEY`
   - Value: `sk-your-actual-api-key-here` (paste your OpenAI key from Step 1)
   - Click "Save"

3. **Verify**
   - You should see `OPENAI_API_KEY` in the secrets list

---

### Step 4: Test the Function

#### Option A: Test via Supabase Dashboard

1. Go to Edge Functions → `auto-optimize`
2. Click "Invoke" tab
3. Set Request Body:
   ```json
   {
     "minConfidence": 0.7
   }
   ```
4. Click "Invoke"
5. Check the response

#### Option B: Test via cURL

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'
```

**Replace `YOUR_ANON_KEY` with your actual Supabase Anon Key** (found in Project Settings → API)

---

### Step 5: Enable AI/ML for Your Bots

Run this SQL in Supabase SQL Editor:

```sql
-- Enable AI/ML for a specific bot
UPDATE trading_bots 
SET ai_ml_enabled = true 
WHERE id = 'your-bot-id-here';

-- Or enable for all running bots
UPDATE trading_bots 
SET ai_ml_enabled = true 
WHERE status = 'running';
```

---

## ✅ Success Response

If everything works, you should see:

```json
{
  "message": "Optimization complete for 2 bots",
  "optimized": 1,
  "results": [
    {
      "botId": "...",
      "botName": "My Bot",
      "status": "optimized",
      "confidence": 0.85,
      "changes": 3
    }
  ]
}
```

---

## 🔍 Troubleshooting

### Error: "OpenAI API key not configured"
- **Fix**: Go to Project Settings → Edge Functions → Secrets
- Make sure `OPENAI_API_KEY` is set with your actual OpenAI key

### Error: "No active bots with AI/ML enabled"
- **Fix**: Run the SQL from Step 5 to enable AI/ML for your bots
- Make sure bots have `status = 'running'`

### Error: "Insufficient trades"
- **Fix**: Bots need at least 10 trades in the last 30 days
- Wait for more trades or lower the requirement in code (line 106)

### Error: "Function not found" or 404
- **Fix**: Make sure function name is exactly `auto-optimize` (lowercase, no spaces)
- Redeploy the function

### Error: "OpenAI API error: 401"
- **Fix**: Your OpenAI API key is invalid or expired
- Generate a new key from https://platform.openai.com/api-keys

---

## 🎉 Done!

Your AI Auto-Optimization function is now deployed and ready to use!

**Next Steps:**
- Schedule it to run daily/weekly (see `scripts/call-auto-optimize.sh`)
- Monitor optimization results in `strategy_optimizations` table
- Check bot activity logs for optimization history

