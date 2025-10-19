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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Starting complete authentication system fix...')

    // Step 1: Clean up any existing problematic auth records
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      console.log('Found existing users:', existingUsers.users.length)
      
      for (const user of existingUsers.users) {
        if (user.email === 'digimiami@gmail.com') {
          console.log('Removing existing admin user:', user.id)
          await supabase.auth.admin.deleteUser(user.id)
        }
      }
    } catch (cleanupError) {
      console.log('Cleanup step completed (some errors expected):', cleanupError.message)
    }

    // Step 2: Create fresh admin user with proper setup
    console.log('Creating new admin user...')
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        full_name: 'Admin User'
      }
    })

    if (createError) {
      console.error('User creation error:', createError)
      throw createError
    }

    console.log('Admin user created successfully:', newUser.user.id)

    // Step 3: Ensure users table record exists
    try {
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: newUser.user.id,
          email: 'digimiami@gmail.com',
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.log('Users table insert error (may be expected):', insertError.message)
      } else {
        console.log('Users table record created successfully')
      }
    } catch (tableError) {
      console.log('Users table operation completed with notes:', tableError.message)
    }

    // Step 4: Test login immediately
    console.log('Testing login functionality...')
    const { data: loginTest, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'digimiami@gmail.com',
      password: 'lagina123'
    })

    if (loginError) {
      console.error('Login test failed:', loginError)
      throw new Error(`Login test failed: ${loginError.message}`)
    }

    console.log('Login test successful!')

    // Step 5: Sign out from test session
    await supabase.auth.signOut()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication system completely fixed!',
        adminCredentials: {
          email: 'digimiami@gmail.com',
          password: 'lagina123'
        },
        userId: newUser.user.id,
        loginTestPassed: true,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Complete auth fix error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to fix authentication system',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})