# Manual Deploy Instructions for Auto-Optimize Function

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Deploy the Function

```bash
supabase functions deploy auto-optimize
```

### Step 2: Set OpenAI API Key Secret

```bash
supabase secrets set OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 3: Verify Deployment

```bash
# List all secrets to verify
supabase secrets list

# Test the function
curl -X POST https://your-project-id.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'
```

## Method 2: Using Supabase Dashboard

### Step 1: Create the Function

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it: `auto-optimize`
4. Copy the code from `supabase/functions/auto-optimize/index.ts` into the editor
5. Click "Deploy"

### Step 2: Set Environment Variables

1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-your-actual-api-key-here`
3. Click "Save"

## Method 3: Direct File Upload (Alternative)

If you have SSH access to your Supabase project:

```bash
# Navigate to your project
cd /path/to/your/supabase/project

# Copy the function file
cp supabase/functions/auto-optimize/index.ts supabase/functions/auto-optimize/index.ts

# Deploy
supabase functions deploy auto-optimize
```

## Testing After Deployment

### Test via cURL

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "minConfidence": 0.7
  }'
```

### Test via Supabase Dashboard

1. Go to Edge Functions → auto-optimize
2. Click "Invoke"
3. Set Body:
   ```json
   {
     "minConfidence": 0.7
   }
   ```
4. Click "Send"

## Expected Response

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

## Troubleshooting

### Error: "OpenAI API key not configured"
- Make sure you set the secret: `supabase secrets set OPENAI_API_KEY=your-key`
- Verify: `supabase secrets list`

### Error: "No active bots with AI/ML enabled"
- Check: `UPDATE trading_bots SET ai_ml_enabled = true WHERE id = 'your-bot-id'`
- Verify bot status is `'running'`

### Error: "Insufficient trades"
- Bots need at least 10 trades in the last 30 days
- Wait for more trades or modify the requirement in the code

