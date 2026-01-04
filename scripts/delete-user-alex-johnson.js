/**
 * Script to delete user: alex.johnson@email.com
 * 
 * This script uses the admin Edge Function to delete the user by email.
 * 
 * Usage:
 *   node scripts/delete-user-alex-johnson.js
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file
 *   - Or set as environment variables
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAIL = 'alex.johnson@email.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Set them in .env file or as environment variables');
  process.exit(1);
}

async function deleteUser() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`🔍 Deleting user: ${TARGET_EMAIL}...`);

    // Call the admin Edge Function to delete by email
    const { data, error } = await supabase.functions.invoke('admin-management-enhanced', {
      body: {
        action: 'deleteUser',
        userEmail: TARGET_EMAIL
      },
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (error) {
      console.error('❌ Error calling Edge Function:', error);
      throw error;
    }

    if (data?.error) {
      console.error('❌ Edge Function returned error:', data.error);
      throw new Error(data.error);
    }

    if (data?.success) {
      console.log('✅ User deleted successfully!');
      console.log('Deleted user ID:', data.deletedUserId);
    } else {
      console.error('❌ Unexpected response:', data);
    }

  } catch (error) {
    console.error('❌ Failed to delete user:', error.message);
    process.exit(1);
  }
}

deleteUser();















