/**
 * Script to delete user: alex.johnson@email.com
 * 
 * This script:
 * 1. Finds the user ID for alex.johnson@email.com
 * 2. Calls the admin-management-enhanced Edge Function to delete the user
 * 
 * Usage:
 * - Run this from the admin interface or with proper admin authentication
 * - Or use the SQL script delete_user_alex_johnson.sql to find the user ID first
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ADMIN_EMAIL = 'digimiami@gmail.com'; // Admin email to authenticate as

async function deleteAlexJohnsonUser() {
  try {
    // Create Supabase client with service role (for admin operations)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Find the user ID for alex.johnson@email.com
    console.log('🔍 Finding user: alex.johnson@email.com...');
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', 'alex.johnson@email.com')
      .single();

    if (userError || !userData) {
      // Try to find in auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === 'alex.johnson@email.com');
      
      if (!authUser) {
        console.error('❌ User not found: alex.johnson@email.com');
        return;
      }
      
      console.log('✅ Found user in auth.users:', authUser.id);
      await deleteUserById(authUser.id, supabase);
      return;
    }

    console.log('✅ Found user:', {
      id: userData.id,
      email: userData.email,
      role: userData.role
    });

    // Step 2: Delete the user
    await deleteUserById(userData.id, supabase);

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }
}

async function deleteUserById(userId: string, supabase: any) {
  try {
    console.log(`🗑️  Deleting user ID: ${userId}...`);

    // Delete from auth.users
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('❌ Error deleting from auth.users:', authError);
      throw authError;
    }
    console.log('✅ Deleted from auth.users');

    // Delete from users table
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (dbError) {
      console.warn('⚠️  Error deleting from users table (may not exist):', dbError);
      // Don't throw - user might already be deleted from users table
    } else {
      console.log('✅ Deleted from users table');
    }

    console.log('✅ User deleted successfully!');
  } catch (error) {
    console.error('❌ Error in deleteUserById:', error);
    throw error;
  }
}

// Run the script
if (import.meta.main) {
  deleteAlexJohnsonUser()
    .then(() => {
      console.log('✅ Script completed successfully');
      Deno.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      Deno.exit(1);
    });
}





