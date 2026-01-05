# 🚀 DEPLOYMENT INSTRUCTIONS - Tracking URL Generator

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project: `dkawxgwdqiirgmmjbvhc`

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy and Run Migration**
   - Open the file: `supabase/migrations/20250101_create_tracking_urls_tables.sql`
   - Copy the **entire contents** of the file
   - Paste into the SQL Editor
   - Click **Run** (or press Ctrl+Enter)

4. **Refresh Schema Cache** (Important!)
   After running the migration, also run this to refresh the PostgREST schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   SELECT pg_sleep(1);
   SELECT 'Schema cache refreshed successfully!' as status;
   ```

5. **Verify Migration**
   Run this query to verify tables were created:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('tracking_urls', 'tracking_url_clicks');
   ```
   
   Should return:
   - `tracking_urls`
   - `tracking_url_clicks`

6. **Verify Function Exists**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'generate_tracking_code';
   ```
   
   Should return: `generate_tracking_code`

### Option B: Using Supabase CLI (if installed)
```bash
npx supabase db push
```

---

## Step 2: Deploy Edge Function (Optional - for enhanced geographic tracking)

### Deploy tracking-redirect function

1. **Go to Supabase Dashboard**
   - Navigate to **Edge Functions**
   - Click **Create new function** (or find existing `tracking-redirect`)

2. **Add Function Code**
   - Name: `tracking-redirect`
   - Copy the entire contents of `supabase/functions/tracking-redirect/index.ts`
   - Paste into the function editor
   - Click **Deploy**

---

## Step 3: Verify Deployment

### Check Tables Exist
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('tracking_urls', 'tracking_url_clicks')
ORDER BY table_name, ordinal_position;
```

### Test the Feature
1. Go to Admin Panel → Tracking URLs
2. Click "Create Tracking URL"
3. Fill in the form and save
4. Should work without errors now!

---

## ⚠️ Troubleshooting

### If you still see "table not found" errors:

1. **Check if migration ran successfully**
   - Look for any error messages in SQL Editor
   - Verify tables exist with the query above

2. **Refresh schema cache again**
   ```sql
   NOTIFY pgrst, 'reload schema';
   SELECT pg_sleep(2);
   ```

3. **Clear browser cache**
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

4. **Check RLS Policies**
   - Ensure you're logged in as admin
   - Verify RLS policies allow admin access

---

## ✅ After Running Migration:

- ✅ Tracking URL Generator will work
- ✅ Can create tracking URLs
- ✅ Can view click analytics
- ✅ Geographic tracking will be available
- ✅ All tracking features functional

---

## 📝 Notes

- The migration creates two tables: `tracking_urls` and `tracking_url_clicks`
- It also creates a function: `generate_tracking_code` for unique short codes
- RLS policies ensure only admins can manage URLs, but anyone can track clicks
- Schema cache refresh is critical for PostgREST to recognize new tables/functions

