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

    // Admin credentials
    const adminEmail = 'digimiami@gmail.com'
    const adminPassword = 'lagina123'

    console.log('Starting complete authentication fix...')

    // Step 1: Clean up existing users
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
    console.log(`Found ${allUsers.users.length} existing users`)

    for (const user of allUsers.users) {
      if (user.email === adminEmail) {
        console.log(`Removing existing user: ${user.id}`)
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }

    // Step 2: Clean database
    await supabaseAdmin.from('users').delete().eq('email', adminEmail)
    console.log('Cleaned database records')

    // Step 3: Create fresh admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    })

    if (createError) {
      throw new Error(`User creation failed: ${createError.message}`)
    }

    console.log(`Created new admin user: ${newUser.user.id}`)

    // Step 4: Insert into database
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email: adminEmail,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      console.log('Database insert warning:', dbError.message)
    }

    // Step 5: Test login immediately
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: loginTest, error: loginError } = await testClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    })

    if (loginError) {
      throw new Error(`Login test failed: ${loginError.message}`)
    }

    console.log('Login test successful!')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Authentication system completely fixed',
        adminEmail: adminEmail,
        adminPassword: adminPassword,
        userId: newUser.user.id,
        loginTestPassed: true,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Fix failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})