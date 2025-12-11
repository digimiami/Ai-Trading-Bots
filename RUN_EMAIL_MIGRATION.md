# 🚨 URGENT: Run Email System Migration

## Error:
```
Could not find the table 'public.mailboxes' in the schema cache
Could not find the table 'public.emails' in the schema cache
```

## ✅ SOLUTION - Run This SQL Now:

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project: `dkawxgwdqiirgmmjbvhc`
3. Click **SQL Editor** (left sidebar)

### Step 2: Copy & Run This SQL:
1. Click **New Query**
2. Open the file `APPLY_EMAIL_MIGRATION.sql` in this project
3. Copy the **ENTIRE** contents
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify
After running, you should see:
- ✅ "Email system tables created successfully! Schema cache refreshed."

### Step 4: Test
1. Refresh your browser (Ctrl+F5 or Cmd+Shift+R)
2. Go to Email Center in admin panel
3. Try creating a mailbox
4. Should work now! ✅

---

## ⚠️ Why This Happened:
- Code was deployed but database migration wasn't run
- Supabase needs SQL migrations to be run manually in SQL Editor
- Schema cache needs to be refreshed after creating tables

---

## ✅ After Running:
- Mailboxes table will exist
- Emails table will exist
- Default mailboxes will be created
- Email Center will work
- You can create/edit/delete mailboxes
- You can send and receive emails

---

## 📝 What Gets Created:
- `mailboxes` table - Stores email addresses for sending
- `emails` table - Stores sent and received emails
- Default mailboxes:
  - `no-reply@pablobots.com`
  - `support@pablobots.com`
  - `alerts@pablobots.com`
  - `contact@pablobots.com`
  - `pablo@pablobots.com`
- RLS policies for admin access
- Indexes for performance
