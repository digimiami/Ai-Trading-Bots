import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const adminEmail = 'digimiami@gmail.com'
    const adminPassword = 'lagina123'

    console.log('Starting admin account creation process...')

    // Step 1: Clean up any existing auth users
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      console.log(`Found ${existingUsers.users.length} existing users`)
      
      for (const user of existingUsers.users) {
        if (user.email === adminEmail) {
          console.log(`Deleting existing auth user: ${user.id}`)
          await supabaseAdmin.auth.admin.deleteUser(user.id)
        }
      }
    } catch (error) {
      console.log('Error cleaning up existing users:', error.message)
    }

    // Step 2: Clean up database records
    try {
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', adminEmail)
      
      if (deleteError) {
        console.log('Database cleanup error:', deleteError.message)
      } else {
        console.log('Cleaned up existing database records')
      }
    } catch (error) {
      console.log('Database cleanup error:', error.message)
    }

    // Step 3: Create new auth user
    console.log('Creating new auth user...')
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }

    console.log('Auth user created successfully:', authUser.user.id)

    // Step 4: Create database record
    console.log('Creating database record...')
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: adminEmail,
        user_role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database creation error:', dbError)
      // Clean up auth user if database creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Failed to create database record: ${dbError.message}`)
    }

    console.log('Database record created successfully')

    // Step 5: Test login
    console.log('Testing login...')
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: signInData, error: signInError } = await testClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    })

    if (signInError) {
      console.error('Login test failed:', signInError)
      throw new Error(`Login test failed: ${signInError.message}`)
    }

    console.log('Login test successful!')

    // Step 6: Verify user role in database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .single()

    if (userError) {
      console.error('User verification error:', userError)
    } else {
      console.log('User verification successful:', userData)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin account created and verified successfully!',
      credentials: {
        email: adminEmail,
        password: adminPassword
      },
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: userData?.user_role || 'admin'
      },
      instructions: [
        '1. Use the credentials above to log in',
        '2. The Admin tab will appear in bottom navigation',
        '3. You can now access all admin features'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: 'Check the function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})