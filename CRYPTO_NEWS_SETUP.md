# Crypto News Blog System Setup Guide

## Quick Setup

### 1. Run Database Migration

Run this SQL in **Supabase SQL Editor**:

```sql
-- File: supabase/migrations/20250122_create_crypto_news_articles.sql
```

### 2. Deploy Edge Function

```bash
npx supabase functions deploy crypto-news-management
```

### 3. Set DeepSeek API Key (Recommended Method)

**Option A: Set in Supabase Secrets (Recommended)**
1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Click **"Add new secret"**
3. **Name**: `DEEPSEEK_API_KEY`
4. **Value**: `sk-1140f2af061a4ff8a2caea2e81b449bd`
5. Click **"Save"**

**Option B: Already Configured**
The API key is already set as a fallback in the Edge Function code, so it will work immediately after deployment.

### 4. Test Article Generation

1. Go to **Admin Panel** → **Crypto News** tab
2. Click **"Create Article"**
3. Add keywords (e.g., "Bitcoin", "Ethereum")
4. Click **"Generate with DeepSeek"**
5. Review and edit the generated content
6. Fill in SEO meta tags
7. Click **"Create Article"**

## Features

- ✅ AI Article Generation with DeepSeek API
- ✅ SEO Meta Tags Editor
- ✅ Article CRUD Operations
- ✅ Category and Tag Management
- ✅ Public Crypto News Page
- ✅ View Count Tracking
- ✅ Reading Time Calculation

## Troubleshooting

### Error: "Failed to send a request to the Edge Function"

**Solution:**
1. Make sure the Edge Function is deployed:
   ```bash
   npx supabase functions deploy crypto-news-management
   ```

2. Check browser console for detailed error messages

3. Verify you're logged in as an admin user

4. Check Supabase Edge Function logs:
   - Go to Supabase Dashboard → Edge Functions → crypto-news-management → Logs

### Error: "DeepSeek API key not configured"

**Solution:**
The API key is already set as a fallback in the code. If you still see this error:
1. Set `DEEPSEEK_API_KEY` in Supabase Edge Function secrets
2. Redeploy the function

### Article Generation Takes Too Long

DeepSeek API can take 10-30 seconds to generate articles. Please be patient and don't close the modal.

## API Key Security

⚠️ **Important**: The API key is currently hardcoded as a fallback. For production:
1. Remove the hardcoded key from the Edge Function
2. Set it only in Supabase Secrets
3. Never commit API keys to git

