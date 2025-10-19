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

    const { email, password } = await req.json()

    console.log('Attempting to fix auth for:', email)

    // Step 1: Delete any existing auth user
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers.users.find(u => u.email === email)
      
      if (existingUser) {
        console.log('Deleting existing auth user:', existingUser.id)
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
      }
    } catch (error) {
      console.log('No existing auth user to delete:', error.message)
    }

    // Step 2: Delete any existing database record
    try {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', email)
      console.log('Deleted existing database record')
    } catch (error) {
      console.log('No existing database record to delete:', error.message)
    }

    // Step 3: Create new auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: authError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created auth user:', authUser.user.id)

    // Step 4: Create database record with same ID
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email,
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
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: dbError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created database user:', dbUser)

    // Step 5: Verify the setup by attempting to sign in
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: signInData, error: signInError } = await testClient.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      console.error('Sign in test failed:', signInError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Account created but sign in test failed: ' + signInError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Sign in test successful')

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin account created and verified successfully',
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
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})