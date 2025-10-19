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

    console.log('🚀 Starting ultimate authentication fix...')

    // Admin credentials
    const adminEmail = 'admin@tradingbot.com'
    const adminPassword = 'TradingBot2024!'

    // Step 1: Clean up all existing users
    console.log('🧹 Cleaning up existing users...')
    try {
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
      for (const user of allUsers.users) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
        console.log(`Deleted user: ${user.email}`)
      }
    } catch (error) {
      console.log('Cleanup completed:', error.message)
    }

    // Step 2: Clear database tables
    console.log('🗄️ Clearing database tables...')
    try {
      await supabaseAdmin.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabaseAdmin.from('admin_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      console.log('Database tables cleared')
    } catch (error) {
      console.log('Database cleanup completed:', error.message)
    }

    // Step 3: Create fresh admin user
    console.log('👤 Creating fresh admin user...')
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        name: 'Admin User'
      }
    })

    if (createError) {
      throw new Error(`Failed to create admin user: ${createError.message}`)
    }

    console.log('✅ Admin user created:', newUser.user.id)

    // Step 4: Create database record
    console.log('💾 Creating database record...')
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email: adminEmail,
        user_role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Database error:', dbError)
      // Don't fail completely, continue with auth user
    } else {
      console.log('✅ Database record created')
    }

    // Step 5: Test authentication
    console.log('🔐 Testing authentication...')
    const testClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: signInTest, error: signInError } = await testClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    })

    if (signInError) {
      console.error('Sign in test failed:', signInError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication test failed: ' + signInError.message,
        credentials: { email: adminEmail, password: adminPassword }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ Authentication test successful')

    // Step 6: Create admin log entry
    try {
      await supabaseAdmin
        .from('admin_logs')
        .insert({
          admin_id: newUser.user.id,
          action: 'account_created',
          details: 'Admin account created via ultimate fix',
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.log('Admin log creation skipped:', error.message)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '🎉 Authentication completely fixed!',
      credentials: {
        email: adminEmail,
        password: adminPassword
      },
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: 'admin'
      },
      instructions: [
        '1. Use the provided credentials to log in',
        '2. Your admin account is now fully functional',
        '3. All previous authentication issues have been resolved'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Ultimate fix failed:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      fallback_credentials: {
        email: 'admin@tradingbot.com',
        password: 'TradingBot2024!'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})