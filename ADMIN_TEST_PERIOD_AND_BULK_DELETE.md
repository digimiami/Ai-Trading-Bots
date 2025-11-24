# Admin Test Period & Bulk Delete Features

## Overview
Added two new features to the admin panel:
1. **Test Period Management** - Set a time period to put the website in test/maintenance mode
2. **Bulk Delete Users** - Delete multiple users by date range

## Features Added

### 1. Test Period Management

**Location:** Admin Panel → Users Tab → "Test Period" button

**Features:**
- Enable/disable test period mode
- Set start and end dates for the test period
- Custom message to display during test period
- View current test period status

**How to Use:**
1. Go to Admin Panel → Users tab
2. Click "Test Period" button
3. Check "Enable Test Period" checkbox
4. Set start and end dates
5. Optionally customize the message
6. Click "Save Settings"

**Database:**
- New table: `test_period_settings`
- Stores: enabled status, start_date, end_date, message
- Only one test period setting at a time

### 2. Bulk Delete Users by Date Range

**Location:** Admin Panel → Users Tab → "Bulk Delete" button

**Features:**
- Delete all users created within a date range
- Automatically excludes admin users
- Requires confirmation (type "DELETE")
- Shows count of deleted users and any errors

**How to Use:**
1. Go to Admin Panel → Users tab
2. Click "Bulk Delete" button
3. Select start date and end date
4. Type "DELETE" in the confirmation field
5. Click "Delete Users"
6. Confirm the action in the popup

**Safety Features:**
- Cannot delete admin users
- Requires double confirmation (type "DELETE" + popup)
- Shows warning message
- Returns count of deleted users and any errors

## Database Migration

Run the migration to create the test period settings table:

```sql
-- File: supabase/migrations/20250122_add_test_period_settings.sql
```

This creates:
- `test_period_settings` table
- RLS policies (admin-only access)
- Auto-update trigger for `updated_at`

## Edge Function Updates

**File:** `supabase/functions/admin-management-enhanced/index.ts`

**New Actions:**
- `getTestPeriodSettings` - Get current test period settings
- `updateTestPeriodSettings` - Update test period settings
- `deleteUsersByDateRange` - Delete users by date range

## Frontend Updates

**Files Modified:**
- `src/pages/admin/page.tsx` - Added UI components and handlers
- `src/hooks/useAdmin.ts` - Added new hook functions

**New UI Components:**
- Test Period Settings Modal
- Bulk Delete Users Modal
- Buttons in Users tab

## Usage Examples

### Enable Test Period for 1 Week
1. Click "Test Period" button
2. Enable checkbox
3. Set start date: Today
4. Set end date: 7 days from now
5. Message: "Website is in maintenance mode"
6. Save

### Delete Test Users Created Last Month
1. Click "Bulk Delete" button
2. Start date: 30 days ago
3. End date: Today
4. Type "DELETE"
5. Confirm deletion
6. Review results

## Security

- **Admin Only:** Both features require admin role
- **RLS Policies:** Database tables protected with Row Level Security
- **Confirmation Required:** Bulk delete requires double confirmation
- **Admin Protection:** Admin users cannot be deleted via bulk delete

## Notes

- Test period settings are stored in the database and persist across sessions
- Bulk delete is irreversible - use with caution
- Test period can be enabled/disabled at any time
- Date ranges are inclusive (includes both start and end dates)

