# Delete User: alex.johnson@email.com

This guide provides multiple methods to delete the user `alex.johnson@email.com`.

## Method 1: Using Admin Interface (Recommended)

1. Log in to the admin interface as an admin user
2. Navigate to the "Users" section
3. Find the user `alex.johnson@email.com`
4. Click the "Delete" button next to the user
5. Confirm the deletion

## Method 2: Using SQL Script

Run the SQL script `DELETE_ALEX_JOHNSON_USER.sql` in your Supabase SQL editor:

```sql
-- This will find and delete the user
-- See DELETE_ALEX_JOHNSON_USER.sql for the full script
```

**Note:** Direct SQL deletion may bypass logging. Use Method 1 for proper audit trails.

## Method 3: Using Edge Function Directly

If you have the user ID, you can call the admin Edge Function:

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/admin-management-enhanced" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "deleteUser",
    "userId": "USER_ID_HERE"
  }'
```

## Method 4: Find User ID First

1. Run `delete_user_alex_johnson.sql` to find the user ID
2. Use the user ID with Method 3 or the admin interface

## Important Notes

- ⚠️ **This action cannot be undone**
- The deletion will cascade to related data (bots, trades, etc.)
- Make sure you have admin privileges
- The deletion is logged in `admin_logs` when using the Edge Function

## Verification

After deletion, verify the user is removed:

```sql
SELECT id, email FROM users WHERE email = 'alex.johnson@email.com';
SELECT id, email FROM auth.users WHERE email = 'alex.johnson@email.com';
```

Both queries should return no results.





