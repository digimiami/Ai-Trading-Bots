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

    console.log('Starting ultimate authentication fix...')

    // Step 1: Clean up existing admin users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const adminUsers = existingUsers?.users?.filter(user => 
      user.email === 'digimiami@gmail.com'
    ) || []

    for (const user of adminUsers) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      console.log(`Deleted existing user: ${user.id}`)
    }

    // Step 2: Create new admin user with proper setup
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        name: 'Admin User'
      }
    })

    if (createError) {
      console.error('Create user error:', createError)
      throw createError
    }

    console.log('Created new admin user:', newUser.user?.id)

    // Step 3: Insert into users table with admin role
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: newUser.user!.id,
        email: 'digimiami@gmail.com',
        role: 'admin',
        name: 'Admin User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Insert user error:', insertError)
      // Continue anyway, user might already exist
    }

    // Step 4: Test login functionality
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: 'digimiami@gmail.com',
      password: 'lagina123'
    })

    if (loginError) {
      console.error('Login test failed:', loginError)
      throw new Error(`Login test failed: ${loginError.message}`)
    }

    console.log('Login test successful')

    // Step 5: Verify user data
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', loginData.user.id)
      .single()

    if (userError) {
      console.error('User data error:', userError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication system fixed successfully',
        admin_credentials: {
          email: 'digimiami@gmail.com',
          password: 'lagina123'
        },
        user_id: newUser.user?.id,
        login_test: 'passed',
        user_data: userData,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Ultimate auth fix error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Authentication fix failed',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})