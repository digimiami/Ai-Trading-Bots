import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests - MUST be first to avoid any errors
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body safely
    let body: any = {}
    try {
      const bodyText = await req.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch (e) {
      // If body is empty or invalid, use empty object
      body = {}
    }

    const { action, ...params } = body

    switch (action) {
      // Existing user management functions
      case 'getUsers':
        const { data: users, error: usersError } = await supabaseClient
          .from('users')
          .select('id, email, role, created_at, last_sign_in_at')
          .order('created_at', { ascending: false })

        if (usersError) throw usersError
        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'createUser':
        const { email, password, role } = params
        
        if (!email || !password) {
          return new Response(JSON.stringify({ 
            error: 'Email and password are required' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Check if user already exists
        const { data: existingUser } = await supabaseClient
          .from('users')
          .select('id')
          .eq('email', email)
          .single()

        if (existingUser) {
          return new Response(JSON.stringify({ 
            error: 'User with this email already exists' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        })

        if (createError) {
          console.error('Error creating auth user:', createError)
          return new Response(JSON.stringify({ 
            error: createError.message || 'Failed to create user in authentication system' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Insert into users table
        const { error: dbError } = await supabaseClient
          .from('users')
          .insert({
            id: newUser.user.id,
            email,
            name: email.split('@')[0], // Default name from email
            role: role || 'user'
          })

        if (dbError) {
          console.error('Error inserting user into database:', dbError)
          // Try to cleanup auth user if DB insert fails
          await supabaseClient.auth.admin.deleteUser(newUser.user.id)
          return new Response(JSON.stringify({ 
            error: dbError.message || 'Failed to create user in database' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'User created successfully',
          user: newUser.user 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'getInvitationCodes':
        const { data: codes, error: codesError } = await supabaseClient
          .from('invitation_codes')
          .select('*')
          .order('created_at', { ascending: false })

        if (codesError) throw codesError
        
        // Transform to match frontend expectations (used field)
        const codesWithUsed = (codes || []).map(code => ({
          ...code,
          used: code.used_by !== null
        }))
        
        return new Response(JSON.stringify({ codes: codesWithUsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'generateInvitationCode':
        const { email: inviteEmail, expiresInDays } = params
        
        const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7))

        const { data: invitation, error: inviteError } = await supabaseClient
          .from('invitation_codes')
          .insert({
            code,
            email: inviteEmail,
            expires_at: expiresAt.toISOString()
            // Note: used_by and used_at are NULL by default, which means not used
          })
          .select()
          .single()

        if (inviteError) throw inviteError

        // Transform to match frontend expectations (used field)
        const invitationWithUsed = {
          ...invitation,
          used: invitation.used_by !== null
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Invitation code generated successfully',
          invitation: invitationWithUsed
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'deleteUser':
        const { userId } = params
        
        const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId)
        if (deleteAuthError) throw deleteAuthError

        const { error: deleteDbError } = await supabaseClient
          .from('users')
          .delete()
          .eq('id', userId)

        if (deleteDbError) throw deleteDbError

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'User deleted successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: Trading Bot Management
      case 'getAllBots':
        const { data: allBots, error: allBotsError } = await supabaseClient
          .from('trading_bots')
          .select(`
            *,
            users(email)
          `)
          .order('created_at', { ascending: false })

        if (allBotsError) throw allBotsError
        
        // Transform to match frontend expectations
        const transformedBots = (allBots || []).map(bot => ({
          ...bot,
          users: bot.users || { email: 'Unknown' }
        }))
        
        return new Response(JSON.stringify({ bots: transformedBots }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'adminControlBot':
        const { botId, action: botAction } = params
        
        const { error: botControlError } = await supabaseClient
          .from('trading_bots')
          .update({ status: botAction })
          .eq('id', botId)

        if (botControlError) throw botControlError

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Bot ${botAction} successfully` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'getBotAnalytics':
        const { data: botStats, error: botStatsError } = await supabaseClient
          .from('trading_bots')
          .select(`
            id,
            name,
            status,
            total_trades,
            win_rate,
            pnl,
            users(email)
          `)

        if (botStatsError) throw botStatsError
        
        // Transform to match frontend expectations
        const transformedStats = (botStats || []).map(bot => ({
          ...bot,
          users: bot.users || { email: 'Unknown' }
        }))
        
        return new Response(JSON.stringify({ analytics: transformedStats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: System Monitoring
      case 'getSystemStats':
        const { count: userCount } = await supabaseClient
          .from('users')
          .select('id', { count: 'exact', head: true })

        const { count: botCount } = await supabaseClient
          .from('trading_bots')
          .select('id', { count: 'exact', head: true })

        const { count: tradeCount } = await supabaseClient
          .from('trades')
          .select('id', { count: 'exact', head: true })

        const { count: alertCount } = await supabaseClient
          .from('alerts')
          .select('id', { count: 'exact', head: true })

        // Get recent trading activity
        const { data: recentTrades } = await supabaseClient
          .from('trades')
          .select('id, created_at, status, pnl')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        // Calculate platform PnL
        const { data: platformPnL } = await supabaseClient
          .from('trades')
          .select('pnl')
          .eq('status', 'filled')

        const totalPnL = platformPnL?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0

        return new Response(JSON.stringify({
          stats: {
            totalUsers: userCount || 0,
            totalBots: botCount || 0,
            totalTrades: tradeCount || 0,
            totalAlerts: alertCount || 0,
            platformPnL: totalPnL,
            recentTrades: recentTrades?.length || 0
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'getTradingAnalytics':
        const { period = '7' } = params
        const daysAgo = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)

        const { data: trades } = await supabaseClient
          .from('trades')
          .select('*')
          .gte('created_at', daysAgo.toISOString())
          .order('created_at', { ascending: false })

        // Calculate analytics
        const totalTrades = trades?.length || 0
        const filledTrades = trades?.filter(t => t.status === 'filled').length || 0
        const failedTrades = trades?.filter(t => t.status === 'failed').length || 0
        const pendingTrades = trades?.filter(t => t.status === 'pending').length || 0
        const totalPnL = trades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0
        const successRate = totalTrades > 0 ? (filledTrades / totalTrades) * 100 : 0

        // Group by exchange
        const exchangeStats = trades?.reduce((acc, trade) => {
          if (!acc[trade.exchange]) {
            acc[trade.exchange] = { count: 0, pnl: 0 }
          }
          acc[trade.exchange].count++
          acc[trade.exchange].pnl += trade.pnl || 0
          return acc
        }, {} as Record<string, { count: number; pnl: number }>) || {}

        return new Response(JSON.stringify({
          analytics: {
            totalTrades,
            filledTrades,
            failedTrades,
            pendingTrades,
            totalPnL,
            successRate,
            exchangeStats,
            trades: trades?.slice(0, 50) || [] // Last 50 trades
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: Financial Oversight
      case 'getFinancialOverview':
        const { data: allTrades } = await supabaseClient
          .from('trades')
          .select('pnl, fee, amount, price, created_at, status')
          .eq('status', 'filled')

        const totalVolume = allTrades?.reduce((sum, t) => sum + (t.amount * t.price), 0) || 0
        const totalFees = allTrades?.reduce((sum, t) => sum + (t.fee || 0), 0) || 0
        const totalPnL = allTrades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0

        // Daily PnL for last 30 days
        const dailyPnL = allTrades?.reduce((acc, trade) => {
          const date = trade.created_at.split('T')[0]
          if (!acc[date]) acc[date] = 0
          acc[date] += trade.pnl || 0
          return acc
        }, {} as Record<string, number>) || {}

        return new Response(JSON.stringify({
          financial: {
            totalVolume,
            totalFees,
            totalPnL,
            dailyPnL,
            netProfit: totalPnL - totalFees
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: User Activity Monitoring
      case 'getUserActivity':
        const { data: userActivity } = await supabaseClient
          .from('users')
          .select(`
            id,
            email,
            created_at,
            last_sign_in_at,
            trading_bots(id, name, status, total_trades, pnl),
            trades(id, created_at, status, pnl)
          `)
          .order('last_sign_in_at', { ascending: false })

        return new Response(JSON.stringify({ userActivity }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: System Logs
      case 'getSystemLogs':
        const { limit = 100 } = params
        
        const { data: logs } = await supabaseClient
          .from('bot_activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit)

        return new Response(JSON.stringify({ logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: Risk Monitoring
      case 'getRiskMetrics':
        const { data: largeTrades } = await supabaseClient
          .from('trades')
          .select('*')
          .gte('amount', 1000) // Large trades
          .order('created_at', { ascending: false })
          .limit(20)

        const { data: failedTrades } = await supabaseClient
          .from('trades')
          .select('*')
          .eq('status', 'failed')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        return new Response(JSON.stringify({
          risk: {
            largeTrades,
            failedTrades,
            riskScore: failedTrades?.length || 0
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // NEW: Data Export
      case 'exportData':
        const { type, userId } = params
        
        let result
        switch (type) {
          case 'user_trades':
            if (!userId) {
              return new Response(JSON.stringify({ error: 'User ID is required for user_trades export' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
            const { data: userTrades, error: userTradesError } = await supabaseClient
              .from('trades')
              .select('*')
              .eq('user_id', userId)
            if (userTradesError) throw userTradesError
            result = userTrades
            break
          case 'all_trades':
            const { data: allTradesData, error: allTradesError } = await supabaseClient
              .from('trades')
              .select('*')
            if (allTradesError) throw allTradesError
            result = allTradesData
            break
          case 'users':
            const { data: usersData, error: usersError } = await supabaseClient
              .from('users')
              .select('*')
            if (usersError) throw usersError
            result = usersData
            break
          default:
            return new Response(JSON.stringify({ error: 'Invalid export type' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ data: result || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Admin management error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})