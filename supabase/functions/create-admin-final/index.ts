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

    console.log('Creating admin user...')

    // Create admin user in auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@tradingbot.com',
      password: 'TradingBot2024!',
      email_confirm: true
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Auth user created:', authUser.user?.id)

    // Insert user into users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'admin@tradingbot.com',
        role: 'admin',
        created_at: new Date().toISOString()
      })
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Database user created:', dbUser)

    // Test login
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email: 'admin@tradingbot.com',
      password: 'TradingBot2024!'
    })

    if (loginError) {
      console.error('Login test failed:', loginError)
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Admin user created but login test failed',
        user: dbUser,
        loginError: loginError.message
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin user created and login test successful!',
      user: dbUser,
      credentials: {
        email: 'admin@tradingbot.com',
        password: 'TradingBot2024!'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})