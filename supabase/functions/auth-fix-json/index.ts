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

    // Clean up any existing problematic users
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      for (const user of existingUsers.users) {
        if (user.email === 'digimiami@gmail.com') {
          await supabaseAdmin.auth.admin.deleteUser(user.id)
          console.log('Deleted existing user:', user.id)
        }
      }
    } catch (error) {
      console.log('No existing users to clean up')
    }

    // Clean up database records
    try {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', 'digimiami@gmail.com')
    } catch (error) {
      console.log('No database records to clean up')
    }

    // Create fresh admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('Auth creation failed:', authError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: authError.message,
        details: 'Failed to create auth user'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create database record
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'digimiami@gmail.com',
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
        error: dbError.message,
        details: 'Failed to create database record'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Test login to ensure it works
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: loginTest, error: loginError } = await testClient.auth.signInWithPassword({
      email: 'digimiami@gmail.com',
      password: 'lagina123'
    })

    if (loginError) {
      console.error('Login test failed:', loginError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: loginError.message,
        details: 'Account created but login test failed'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin account created and verified successfully',
      credentials: {
        email: 'digimiami@gmail.com',
        password: 'lagina123'
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
      error: error.message || 'Unknown error occurred',
      details: 'Unexpected server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})