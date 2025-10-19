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

    // Step 1: Clean up existing auth users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    for (const user of existingUsers.users) {
      if (user.email === 'digimiami@gmail.com') {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }

    // Step 2: Clean up database
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('email', 'digimiami@gmail.com')

    // Step 3: Create new auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (createError) {
      throw new Error(`Auth user creation failed: ${createError.message}`)
    }

    // Step 4: Create database record with matching ID
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email: 'digimiami@gmail.com',
        role: 'admin'
      })

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    // Step 5: Verify the setup
    const { data: verifyUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'digimiami@gmail.com')
      .single()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin account setup completed successfully',
        auth_user_id: newUser.user.id,
        db_user: verifyUser,
        instructions: 'You can now login with digimiami@gmail.com / lagina123'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Setup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Failed to setup admin account'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})