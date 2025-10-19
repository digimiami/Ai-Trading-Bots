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

    // Step 1: Clean up any existing auth users with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)
    
    if (existingUser) {
      console.log('Deleting existing user:', existingUser.id)
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
    }

    // Step 2: Clean up database records
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('email', email)

    // Step 3: Create new auth user with confirmed email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }

    console.log('Created auth user:', authUser.user.id)

    // Step 4: Create database record
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      // Don't throw here, auth user is created successfully
    }

    // Step 5: Verify the user can sign in
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: signInData, error: signInError } = await testClient.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (signInError) {
      console.error('Sign in test error:', signInError)
      throw new Error(`Sign in test failed: ${signInError.message}`)
    }

    console.log('Sign in test successful')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin user created and verified successfully',
        userId: authUser.user.id,
        email: email,
        signInTest: 'passed'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})