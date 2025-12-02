# 📰 Auto-Posting Setup Guide

## Overview

The auto-posting feature allows you to automatically generate and publish crypto news articles based on keyword lists you configure. Articles are generated using the DeepSeek API and can be automatically published or saved as drafts.

## Features

- ✅ Create keyword lists with multiple keywords
- ✅ Set frequency (how often articles are generated)
- ✅ Auto-publish option (publish immediately or save as draft)
- ✅ Category assignment for generated articles
- ✅ Enable/disable keyword lists
- ✅ Manual trigger option (run auto-posting immediately)
- ✅ Scheduled automatic execution

## Setup Steps

### 1. Run Database Migration

The migration creates the `auto_posting_keywords` table:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20250122_create_auto_posting_keywords.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

### 2. Deploy Edge Functions

Deploy the updated `crypto-news-management` function and the new `crypto-news-auto-poster` function:

```bash
# Deploy crypto-news-management (updated with auto-posting actions)
npx supabase functions deploy crypto-news-management

# Deploy crypto-news-auto-poster (scheduled function)
npx supabase functions deploy crypto-news-auto-poster
```

### 3. Set Up Scheduled Trigger

In Supabase Dashboard:

1. Go to **Edge Functions** → `crypto-news-auto-poster`
2. Click on **Schedules** tab
3. Click **Create Schedule**
4. Configure:
   - **Schedule Name**: `crypto-news-auto-poster-schedule`
   - **Cron Expression**: `0 * * * *` (every hour) or `0 */6 * * *` (every 6 hours)
   - **HTTP Method**: `GET` or `POST`
   - **Headers**:
     ```
     x-cron-secret: YOUR_CRON_SECRET_VALUE
     ```
   - **Enabled**: ✅ Yes
5. Click **Save**

### 4. Configure Environment Variables

Ensure these secrets are set in Supabase Dashboard → Edge Functions → Secrets:

- `DEEPSEEK_API_KEY`: Your DeepSeek API key (for article generation)
- `CRON_SECRET`: Secret key for scheduled function authentication
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for database access)
- `SUPABASE_ANON_KEY`: Anon key (for public access)

## How to Use

### Creating a Keyword List

1. Go to **Admin Panel** → **Crypto News** tab
2. Click on **Auto-Posting Keywords** tab
3. Click **Create Keyword List**
4. Fill in:
   - **Name**: Descriptive name (e.g., "Bitcoin News Keywords")
   - **Keywords**: Add keywords one by one (press Enter after each)
   - **Category**: Select category (BTC, ETH, SOL, etc.)
   - **Frequency**: How often to generate articles (in hours)
   - **Max Articles per Run**: Maximum articles to generate per execution
   - **Enabled**: Toggle to enable/disable
   - **Auto-Publish**: Check to publish articles immediately, or leave unchecked to save as drafts
5. Click **Create**

### Managing Keyword Lists

- **Edit**: Click the edit icon on any keyword list
- **Delete**: Click the delete icon (with confirmation)
- **Enable/Disable**: Toggle the enabled checkbox when editing

### Running Auto-Posting Manually

1. Go to **Auto-Posting Keywords** tab
2. Click **Run Auto-Posting Now**
3. The system will:
   - Check all enabled keyword lists
   - Generate articles for keywords that are due (based on frequency)
   - Create articles as drafts or publish them (based on auto-publish setting)
   - Update the `last_generated_at` timestamp

### Automatic Execution

The scheduled function (`crypto-news-auto-poster`) runs automatically based on your cron schedule. It:
- Checks all enabled keyword lists
- Generates articles for keywords that are due
- Respects the frequency settings

## How It Works

1. **Keyword List**: You create a list with keywords (e.g., ["Bitcoin", "BTC", "cryptocurrency"])
2. **Frequency Check**: The system checks if enough time has passed since the last generation (based on `frequency_hours`)
3. **Article Generation**: For each keyword in the list (up to `max_articles_per_run`), the system:
   - Calls DeepSeek API to generate article content
   - Auto-fills SEO meta tags
   - Generates featured image URL
   - Creates article with selected category
   - Publishes or saves as draft (based on `auto_publish` setting)
4. **Update Timestamp**: Updates `last_generated_at` for the keyword list

## Example Configuration

**Keyword List: "Bitcoin Daily News"**
- Keywords: ["Bitcoin", "BTC", "cryptocurrency", "blockchain"]
- Category: BTC
- Frequency: 24 hours
- Max Articles: 2
- Enabled: ✅ Yes
- Auto-Publish: ✅ Yes

This will generate 2 articles every 24 hours, automatically published.

## Troubleshooting

### Articles Not Generating

1. **Check Keyword List Status**:
   - Ensure the keyword list is enabled
   - Check if enough time has passed (based on frequency)

2. **Check Scheduled Function**:
   - Go to Edge Functions → `crypto-news-auto-poster` → Logs
   - Look for errors or execution logs

3. **Check DeepSeek API Key**:
   - Ensure `DEEPSEEK_API_KEY` is set in Edge Function secrets
   - Verify the API key is valid

4. **Manual Test**:
   - Use "Run Auto-Posting Now" button to test manually
   - Check the response for any errors

### Scheduled Function Not Running

1. **Verify Schedule**:
   - Go to Edge Functions → `crypto-news-auto-poster` → Schedules
   - Ensure schedule is enabled and cron expression is correct

2. **Check CRON_SECRET**:
   - Ensure `CRON_SECRET` matches in both:
     - Edge Function secrets
     - Schedule headers (`x-cron-secret`)

3. **Check Logs**:
   - Review Edge Function logs for authentication errors

## Best Practices

1. **Keyword Selection**: Use relevant, specific keywords for better article quality
2. **Frequency**: Don't set too frequent (e.g., every 1 hour) to avoid API rate limits
3. **Max Articles**: Start with 1-2 articles per run to test
4. **Review Before Publishing**: Initially, set `auto_publish` to false to review articles
5. **Category Matching**: Use appropriate categories for better organization

## API Reference

### Edge Function Actions

- `getKeywordLists`: Get all keyword lists
- `createKeywordList`: Create a new keyword list
- `updateKeywordList`: Update an existing keyword list
- `deleteKeywordList`: Delete a keyword list
- `runAutoPosting`: Manually trigger auto-posting (checks all enabled lists)

All actions require admin authentication (except when called by scheduled function with valid `x-cron-secret`).

