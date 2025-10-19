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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseClient
      .from('users')
      .select('user_role')
      .eq('id', user.id)
      .single()

    if (!adminUser || adminUser.user_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const method = req.method
    const action = url.pathname.split('/').pop()

    switch (method) {
      case 'GET':
        if (action === 'users') {
          const { data: users, error } = await supabaseClient
            .from('users')
            .select('id, email, user_role, created_at, updated_at')
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ users }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'stats') {
          const { data: userCount } = await supabaseClient
            .from('users')
            .select('id', { count: 'exact' })

          const { data: botCount } = await supabaseClient
            .from('trading_bots')
            .select('id', { count: 'exact' })

          const { data: tradeCount } = await supabaseClient
            .from('trades')
            .select('id', { count: 'exact' })

          const { data: alertCount } = await supabaseClient
            .from('alerts')
            .select('id', { count: 'exact' })

          return new Response(JSON.stringify({
            stats: {
              totalUsers: userCount?.length || 0,
              totalBots: botCount?.length || 0,
              totalTrades: tradeCount?.length || 0,
              totalAlerts: alertCount?.length || 0
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'logs') {
          const { data: logs, error } = await supabaseClient
            .from('admin_logs')
            .select(`
              id, action, details, created_at,
              admin:users!admin_logs_admin_id_fkey(email),
              target_user:users!admin_logs_target_user_id_fkey(email)
            `)
            .order('created_at', { ascending: false })
            .limit(100)

          if (error) throw error

          return new Response(JSON.stringify({ logs }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'POST':
        if (action === 'create-admin') {
          const body = await req.json()
          const { email, password } = body

          // Create user account
          const { data: newUser, error: signUpError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          })

          if (signUpError) throw signUpError

          // Set user role to admin
          const { error: roleError } = await supabaseClient
            .from('users')
            .update({ user_role: 'admin' })
            .eq('id', newUser.user.id)

          if (roleError) throw roleError

          // Log admin action
          await supabaseClient
            .from('admin_logs')
            .insert({
              admin_id: user.id,
              action: 'create_admin',
              target_user_id: newUser.user.id,
              details: { email }
            })

          return new Response(JSON.stringify({ 
            success: true, 
            admin: { id: newUser.user.id, email } 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'PUT':
        if (action === 'update-role') {
          const body = await req.json()
          const { userId, role } = body

          const { error } = await supabaseClient
            .from('users')
            .update({ user_role: role })
            .eq('id', userId)

          if (error) throw error

          // Log admin action
          await supabaseClient
            .from('admin_logs')
            .insert({
              admin_id: user.id,
              action: 'update_role',
              target_user_id: userId,
              details: { new_role: role }
            })

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'DELETE':
        const userId = url.searchParams.get('userId')
        if (userId && action === 'delete-user') {
          // Delete user account
          const { error } = await supabaseClient.auth.admin.deleteUser(userId)
          if (error) throw error

          // Log admin action
          await supabaseClient
            .from('admin_logs')
            .insert({
              admin_id: user.id,
              action: 'delete_user',
              target_user_id: userId,
              details: { deleted_at: new Date().toISOString() }
            })

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})