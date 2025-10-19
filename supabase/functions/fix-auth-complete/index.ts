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

    console.log('Starting complete auth fix process...')

    // Step 1: Clean up existing auth users
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      for (const user of existingUsers.users) {
        if (user.email === adminEmail) {
          console.log('Deleting existing auth user:', user.id)
          await supabaseAdmin.auth.admin.deleteUser(user.id)
        }
      }
    } catch (error) {
      console.log('Cleanup phase error (continuing):', error.message)
    }

    // Step 2: Clean up database records
    try {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', adminEmail)
      console.log('Cleaned up database records')
    } catch (error) {
      console.log('Database cleanup error (continuing):', error.message)
    }

    // Step 3: Create fresh auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('Auth creation failed:', authError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to create auth user: ' + authError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created auth user successfully:', authUser.user.id)

    // Step 4: Create database record
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
      console.error('Database creation failed:', dbError)
      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to create database record: ' + dbError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created database record successfully')

    // Step 5: Test login
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: signInTest, error: signInError } = await testClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    })

    if (signInError) {
      console.error('Login test failed:', signInError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Account created but login test failed: ' + signInError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Login test successful!')

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin account fixed and verified successfully!',
      credentials: {
        email: adminEmail,
        password: adminPassword
      },
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: 'admin'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Unexpected error: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})