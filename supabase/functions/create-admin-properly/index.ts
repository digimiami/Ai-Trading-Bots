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

    // First, clean up any existing auth users with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === 'digimiami@gmail.com')
    
    if (existingUser) {
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
    }

    // Create new auth user with confirmed email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      throw new Error(`Auth creation failed: ${authError.message}`)
    }

    // Insert user record in database with matching ID
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'digimiami@gmail.com',
        role: 'admin'
      })

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin user created successfully',
        userId: authUser.user.id,
        email: authUser.user.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error creating admin user:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})