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

    // Create admin user with default credentials
    const adminEmail = 'admin@tradingbot.com'
    const adminPassword = 'admin123456'

    console.log('Setting up admin account...')

    // Step 1: Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAdmin = existingUsers.users.find(u => u.email === adminEmail)
    
    if (existingAdmin) {
      console.log('Admin already exists, deleting...')
      await supabaseAdmin.auth.admin.deleteUser(existingAdmin.id)
    }

    // Step 2: Delete any existing database record
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('email', adminEmail)

    // Step 3: Create new admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
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
      console.error('Database creation error:', dbError)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: dbError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Admin setup completed successfully')

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Admin account created successfully',
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
    console.error('Setup error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})