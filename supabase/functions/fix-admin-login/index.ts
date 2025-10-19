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

    // Step 1: Delete all existing auth users with this email
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
    for (const user of allUsers.users) {
      if (user.email === 'digimiami@gmail.com') {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }

    // Step 2: Delete database record
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('email', 'digimiami@gmail.com')

    // Step 3: Create fresh auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'digimiami@gmail.com',
      password: 'lagina123',
      email_confirm: true
    })

    if (authError) {
      throw new Error(`Auth creation failed: ${authError.message}`)
    }

    // Step 4: Create database record with matching auth ID
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'digimiami@gmail.com',
        role: 'admin',
        user_role: 'admin'
      })

    if (dbError) {
      throw new Error(`Database creation failed: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin login fixed successfully!',
        user_id: authUser.user.id,
        email: authUser.user.email,
        note: 'You can now login with digimiami@gmail.com / lagina123'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
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