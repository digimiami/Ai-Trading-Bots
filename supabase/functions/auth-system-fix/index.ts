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

    const { action, email, password } = await req.json()

    if (action === 'create_admin') {
      // Delete existing admin if exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingAdmin = existingUsers.users.find(u => u.email === 'digimiami@gmail.com')
      
      if (existingAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(existingAdmin.id)
        await supabaseAdmin.from('users').delete().eq('email', 'digimiami@gmail.com')
      }

      // Create new admin user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: 'digimiami@gmail.com',
        password: 'lagina123',
        email_confirm: true
      })

      if (authError) {
        throw authError
      }

      // Add to users table
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: 'digimiami@gmail.com',
          role: 'admin',
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('Database error:', dbError)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin user created successfully',
          credentials: {
            email: 'digimiami@gmail.com',
            password: 'lagina123'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'test_login') {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: email || 'digimiami@gmail.com',
        password: password || 'lagina123'
      })

      return new Response(
        JSON.stringify({ 
          success: !error,
          data: error ? null : data,
          error: error?.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})