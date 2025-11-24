# Invitation Code User Limit Feature

## Overview
Added user account limit functionality to invitation codes, allowing admins to control how many users can be created from each invitation code.

## Features Added

### 1. User Limit on Invitation Codes
- **Location:** Admin Panel → Users Tab → Create Invitation
- **Feature:** Set maximum number of users that can be created with an invitation code
- **Options:**
  - Set a specific limit (e.g., 10 users)
  - Leave empty for unlimited users

### 2. User Count Display
- **Location:** Admin Panel → Users Tab → Invitation Codes section
- **Shows:**
  - Current number of users created from each invitation code
  - User limit (if set)
  - "Limit Reached" warning when limit is hit
  - "Unlimited" indicator when no limit is set

### 3. Invitation Code Management
- **Delete:** Delete invitation codes with a button
- **User Tracking:** Automatically tracks users created from each code
- **Validation:** Prevents new user creation when limit is reached

### 4. User Management (Already Exists)
- **Delete:** Delete individual users
- **Pause/Active:** Change user status (active, suspended, disabled)
- **Status Dropdown:** Already available in user management section

## Database Changes

### Migration: `20250122_add_invitation_user_limit.sql`

**New Columns:**
- `invitation_codes.user_limit` - Maximum users allowed (NULL = unlimited)
- `invitation_codes.users_created` - Current count of users created
- `users.invitation_code_id` - Links users to their invitation code

**New Functions:**
- `update_invitation_user_count()` - Auto-updates user count when user is created
- `check_invitation_user_limit()` - Checks if limit is reached

**New Triggers:**
- `trigger_update_invitation_user_count` - Auto-increments user count

## Edge Function Updates

### `admin-management-enhanced`
- Updated `generateInvitationCode` to accept `userLimit` parameter
- Updated `getInvitationCodes` to return `user_limit` and `users_created`

### `invitation-management`
- Updated `validate` action to check user limits before allowing registration

## Frontend Updates

### `src/pages/admin/page.tsx`
- Added `userLimit` field to invitation creation form
- Updated invitation code display to show user count/limit
- Added delete button for invitation codes
- Enhanced invitation code card with user statistics

### `src/hooks/useAdmin.ts`
- Updated `generateInvitationCode` to accept `userLimit` parameter
- Updated `InvitationCode` interface to include `user_limit` and `users_created`

## Usage Examples

### Create Invitation with 10 User Limit
1. Go to Admin Panel → Users tab
2. Click "Create Invitation"
3. Enter email
4. Set expiration (e.g., 7 days)
5. Set "User Account Limit" to 10
6. Click "Create Invitation"

### Monitor User Count
- View invitation codes in the list
- See "Users: 5 / 10" for limited codes
- See "Users: 3 (Unlimited)" for unlimited codes
- See "Limit Reached" when limit is hit

### Delete Invitation Code
1. Find invitation code in list
2. Click delete button (trash icon)
3. Confirm deletion

### Manage User Status
1. Go to Users section
2. Find user
3. Use "Status" dropdown:
   - **Active** - User can use the platform
   - **Suspended** - Temporarily disabled
   - **Disabled** - Permanently disabled
4. Click "Delete" to permanently remove user

## Security & Validation

- **Limit Enforcement:** Users cannot register when invitation limit is reached
- **Auto-Tracking:** User count automatically increments when user is created
- **Admin Only:** Only admins can create/manage invitation codes
- **RLS Policies:** Database protected with Row Level Security

## Notes

- User limit is optional - leave empty for unlimited
- User count is automatically tracked
- Once limit is reached, invitation code becomes invalid for new registrations
- Existing users are not affected when limit is reached
- Deleting an invitation code does not delete users created from it

