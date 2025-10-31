# How to Set Edge Function Secrets in Supabase

## Quick Guide: Setting OPENAI_API_KEY Secret

The `auto-optimize` function needs the OpenAI API key from **Edge Function Secrets**. Here's how to set it:

### Method 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open Project Settings**
   - Click the **gear icon** (⚙️) in the left sidebar
   - This opens "Project Settings"

3. **Go to Edge Functions**
   - In the settings menu, click **"Edge Functions"**

4. **Find Secrets Section**
   - Scroll down to find the **"Secrets"** section
   - You'll see a list of existing secrets (if any)

5. **Add New Secret**
   - Click **"Add new secret"** or **"New secret"** button
   - A dialog/form will appear

6. **Enter Secret Details**
   - **Name**: `OPENAI_API_KEY` (must be exact, case-sensitive, no spaces)
   - **Value**: `sk-your-actual-openai-key-here` (paste your OpenAI API key)
   - Click **"Save"** or **"Add secret"**

7. **Verify**
   - The secret should now appear in the secrets list
   - You can see it listed as `OPENAI_API_KEY` (value is hidden for security)

### Method 2: Via Supabase CLI

```bash
# Set the secret using Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-your-actual-openai-key-here

# Verify it's set
supabase secrets list
```

### Method 3: Via Supabase API (Advanced)

```bash
curl -X POST 'https://api.supabase.com/v1/projects/{project_ref}/secrets' \
  -H 'Authorization: Bearer {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "OPENAI_API_KEY",
    "value": "sk-your-actual-openai-key-here"
  }'
```

---

## How Edge Functions Access Secrets

Edge Functions automatically receive secrets as environment variables:

```typescript
// In your Edge Function code:
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

// This automatically gets the value from Edge Function Secrets
// No need to import or configure anything else!
```

---

## Important Notes

1. **Secret Name Must Match Exactly**
   - Name must be: `OPENAI_API_KEY` (case-sensitive)
   - No spaces or special characters

2. **Secrets Are Global**
   - Secrets are available to ALL Edge Functions in your project
   - You can use the same secret name across multiple functions

3. **Secrets Are Secure**
   - Values are encrypted at rest
   - Never visible in client-side code
   - Only accessible by Edge Functions using `Deno.env.get()`

4. **After Setting a Secret**
   - Edge Functions automatically have access (no restart needed)
   - Functions will pick up the secret on their next invocation

---

## Troubleshooting

### Secret Not Found
- **Error**: "OpenAI API key not configured"
- **Fix**: Make sure secret name is exactly `OPENAI_API_KEY` (case-sensitive)
- **Fix**: Verify secret exists in Dashboard → Project Settings → Edge Functions → Secrets

### Secret Not Working
- **Check**: Go to Dashboard and verify the secret is listed
- **Check**: Make sure there are no extra spaces in the secret name
- **Check**: Try removing and re-adding the secret

### Testing the Secret
```bash
# You can test if the secret is accessible by checking function logs
# Or test the function directly via API
curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'

# If secret is missing, you'll get:
# {"error":"OpenAI API key not configured","message":"Please set OPENAI_API_KEY..."}
```

---

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: Copy it immediately - you won't see it again!

---

## ✅ Verification Checklist

- [ ] OpenAI API key obtained from https://platform.openai.com/api-keys
- [ ] Secret added in Supabase Dashboard → Project Settings → Edge Functions → Secrets
- [ ] Secret name is exactly: `OPENAI_API_KEY` (case-sensitive)
- [ ] Secret value is your OpenAI key (starts with `sk-`)
- [ ] Secret is visible in the secrets list
- [ ] Function tested and working (no "key not configured" error)

---

## 🎉 Done!

Once the secret is set, your `auto-optimize` function will automatically have access to it via `Deno.env.get('OPENAI_API_KEY')`.

No additional configuration needed - it just works! 🚀

