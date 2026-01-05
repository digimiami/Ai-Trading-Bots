# 🔍 Debugging "Tracking URL not found" Error

## Issue
Getting "Tracking URL not found" when accessing tracking links like `/t/SvsYl46N`

## Possible Causes

### 1. Short Code Doesn't Exist in Database
- The short code `SvsYl46N` might not exist in the `tracking_urls` table
- Check in Supabase: `SELECT * FROM tracking_urls WHERE short_code = 'SvsYl46N';`

### 2. Case Sensitivity
- PostgreSQL is case-sensitive by default
- The short code might be stored as `svsyl46n` (lowercase) but accessed as `SvsYl46N`
- Check: `SELECT * FROM tracking_urls WHERE LOWER(short_code) = LOWER('SvsYl46N');`

### 3. Database Table/Column Issues
- The `tracking_urls` table might not exist
- The `short_code` column might not exist
- Run the migration: `APPLY_TRACKING_URLS_MIGRATION.sql`

### 4. RLS (Row Level Security) Issues
- RLS policies might be blocking the query
- Check if the `tracking_urls` table has RLS enabled and proper policies

## How to Debug

### Step 1: Check if the tracking URL exists
```sql
-- In Supabase SQL Editor
SELECT id, name, short_code, destination_url, is_active 
FROM tracking_urls 
WHERE short_code = 'SvsYl46N';
```

### Step 2: Check all tracking URLs
```sql
SELECT id, name, short_code, destination_url, is_active, created_at
FROM tracking_urls
ORDER BY created_at DESC;
```

### Step 3: Check RLS Policies
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'tracking_urls';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'tracking_urls';
```

### Step 4: Test the Query Directly
Try querying from the browser console or from Supabase dashboard to see if the data exists.

## Solution

1. **Verify the tracking URL exists**:
   - Go to Admin Panel → Tracking URLs
   - Check if the tracking URL with short code `SvsYl46N` exists
   - Verify the short_code matches exactly (case-sensitive)

2. **If it doesn't exist**:
   - The tracking URL might have been deleted
   - Create a new tracking URL

3. **If it exists but query fails**:
   - Check RLS policies
   - Ensure the query is using the correct case
   - Check browser console for detailed error messages (now improved in the code)

4. **Check the actual URL**:
   - Make sure you're using the correct short code
   - The URL format should be: `https://pablobots.com/t/[short_code]`
   - Check in the admin panel what the actual short_code is for your tracking URL

