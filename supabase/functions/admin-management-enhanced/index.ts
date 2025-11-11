import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    let action: string | null = null
    let params: any = {}
    
    try {
      if (req.method === 'POST') {
      const bodyText = await req.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
          action = body.action
          params = { ...body }
          delete params.action
        }
      } else if (req.method === 'GET') {
        const url = new URL(req.url)
        action = url.searchParams.get('action')
      }
    } catch (e) {
      console.error('Error parsing request body:', e)
      return new Response(JSON.stringify({ 
        error: 'Invalid request body',
        details: e.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      // Existing user management functions
      case 'getUsers': {
        try {
          const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, email, role, status, status_updated_at, created_at, last_sign_in_at')
            .order('created_at', { ascending: false })

          if (usersError) {
            console.error('Error fetching users:', usersError)
            throw usersError
          }

          const usersWithStats = await Promise.all(
            (users || []).map(async (user: any) => {
              try {
                const { data: bots } = await supabaseClient
                  .from('trading_bots')
                  .select('*')
                  .eq('user_id', user.id)

                const totalPnL = (bots || []).reduce((sum, bot) => sum + (parseFloat(bot.pnl || 0) || 0), 0)
                const totalTrades = (bots || []).reduce((sum, bot) => sum + (parseInt(bot.total_trades || bot.totalTrades || 0) || 0), 0)
                const activeBots = (bots || []).filter(bot => (bot.status || '').toLowerCase() === 'running').length
                const avgWinRate = (bots && bots.length > 0)
                  ? (bots.reduce((sum, bot) => sum + (parseFloat(bot.win_rate || bot.winRate || 0) || 0), 0) / bots.length)
                  : 0

                const { data: trades } = await supabaseClient
                  .from('trades')
                  .select('*')
                  .eq('user_id', user.id)

                const totalVolume = (trades || []).reduce((sum, trade) => {
                  const size = parseFloat(trade.size || trade.amount || trade.quantity || 0) || 0
                  const entryPrice = parseFloat(trade.entry_price || trade.price || 0) || 0
                  return sum + Math.abs(size * entryPrice)
                }, 0)

                const { data: paperTrades } = await supabaseClient
                  .from('paper_trading_trades')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('status', 'closed')

                const paperPnL = (paperTrades || []).reduce((sum, trade) => sum + (parseFloat(trade.pnl || 0) || 0), 0)
                const paperTradesCount = paperTrades?.length || 0

                const isActive = user.last_sign_in_at
                  ? (new Date(user.last_sign_in_at).getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000))
                  : false

                return {
                  ...user,
                  stats: {
                    totalPnL,
                    totalTrades,
                    activeBots,
                    avgWinRate,
                    totalVolume,
                    paperPnL,
                    paperTradesCount,
                    isActive
                  }
                }
              } catch (userError) {
                console.error(`Error processing stats for user ${user?.id}:`, userError)
                return {
                  ...user,
                  stats: {
                    totalPnL: 0,
                    totalTrades: 0,
                    activeBots: 0,
                    avgWinRate: 0,
                    totalVolume: 0,
                    paperPnL: 0,
                    paperTradesCount: 0,
                    isActive: false
                  }
                }
              }
            })
          )

          return new Response(JSON.stringify({ users: usersWithStats }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error('Error in getUsers:', error)
          return new Response(JSON.stringify({
            users: [],
            warning: 'Failed to fetch users. Returning empty list.',
            details: error?.message || String(error)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

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

      case 'updateUserRole': {
        const { userId: roleUserId, role: newRole } = params

        if (!roleUserId || !newRole) {
          return new Response(JSON.stringify({
            error: 'User ID and role are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: authUpdateError } = await supabaseClient.auth.admin.updateUserById(roleUserId, {
          user_metadata: { role: newRole }
        })

        if (authUpdateError) {
          console.error('Error updating auth user role:', authUpdateError)
          return new Response(JSON.stringify({
            error: authUpdateError.message || 'Failed to update user role in authentication system'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: updateRoleError } = await supabaseClient
          .from('users')
          .update({ role: newRole })
          .eq('id', roleUserId)

        if (updateRoleError) {
          console.error('Error updating user role in database:', updateRoleError)
          return new Response(JSON.stringify({
            error: updateRoleError.message || 'Failed to update user role in database'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'User role updated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'updateUserStatus': {
        const { userId: statusUserId, status: newStatus } = params

        if (!statusUserId || !newStatus) {
          return new Response(JSON.stringify({
            error: 'User ID and status are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!['active', 'suspended', 'disabled'].includes(newStatus)) {
          return new Response(JSON.stringify({
            error: 'Invalid status value'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: statusUpdateError } = await supabaseClient
          .from('users')
          .update({ status: newStatus, status_updated_at: new Date().toISOString() })
          .eq('id', statusUserId)

        if (statusUpdateError) {
          console.error('Error updating user status:', statusUpdateError)
          return new Response(JSON.stringify({
            error: statusUpdateError.message || 'Failed to update user status'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'User status updated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'sendPasswordResetLink': {
        const { email: resetEmail } = params

        if (!resetEmail) {
          return new Response(JSON.stringify({
            error: 'Email is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: resetData, error: resetError } = await supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: resetEmail
        })

        if (resetError) {
          console.error('Error generating password reset link:', resetError)
          return new Response(JSON.stringify({
            error: resetError.message || 'Failed to generate password reset link'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Password reset link generated successfully',
          resetLink: resetData?.properties?.action_link ?? null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

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
      case 'getSystemStats': {
        const safeCount = async (table: string) => {
          try {
            const { count, error } = await supabaseClient
              .from(table)
              .select('id', { count: 'exact', head: true })
            if (error) {
              console.warn(`Warning: failed to count from ${table}:`, error.message)
              return 0
            }
            return count || 0
          } catch (err) {
            console.warn(`Warning: exception counting ${table}:`, err)
            return 0
          }
        }

        const [userCount, botCount, tradeCount, alertCount] = await Promise.all([
          safeCount('users'),
          safeCount('trading_bots'),
          safeCount('trades'),
          safeCount('alerts')
        ])

        const { data: recentTrades, error: recentTradesError } = await supabaseClient
          .from('trades')
          .select('id, created_at, status, pnl')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        if (recentTradesError) {
          console.warn('Warning: failed to fetch recent trades:', recentTradesError.message)
        }

        const { data: platformTrades, error: platformTradesError } = await supabaseClient
          .from('trades')
          .select('pnl, status')

        if (platformTradesError) {
          console.warn('Warning: failed to fetch platform trades:', platformTradesError.message)
        }

        const totalPnL = (platformTrades || [])
          .filter(trade => (trade.status || '').toLowerCase() === 'closed' || (trade.status || '').toLowerCase() === 'filled')
          .reduce((sum, trade) => sum + (parseFloat(trade.pnl || 0) || 0), 0)

        return new Response(JSON.stringify({
          stats: {
            totalUsers: userCount,
            totalBots: botCount,
            totalTrades: tradeCount,
            totalAlerts: alertCount,
            platformPnL: totalPnL,
            recentTrades: recentTrades?.length || 0
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'getTradingAnalytics': {
        const { period = '7' } = params
        const daysAgo = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)

        const { data: trades, error: tradesError } = await supabaseClient
          .from('trades')
          .select('*')
          .gte('created_at', daysAgo.toISOString())
          .order('created_at', { ascending: false })

        if (tradesError) {
          console.error('Error fetching trades for analytics:', tradesError)
          return new Response(JSON.stringify({
            analytics: {
              totalTrades: 0,
              filledTrades: 0,
              failedTrades: 0,
              pendingTrades: 0,
              totalPnL: 0,
              successRate: 0,
              exchangeStats: {},
              trades: []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Calculate analytics
        const totalTrades = trades?.length || 0
        const filledTrades = trades?.filter(t => (t.status || '').toLowerCase() === 'closed' || (t.status || '').toLowerCase() === 'filled').length || 0
        const failedTrades = trades?.filter(t => (t.status || '').toLowerCase() === 'failed').length || 0
        const pendingTrades = trades?.filter(t => (t.status || '').toLowerCase() === 'open' || (t.status || '').toLowerCase() === 'pending').length || 0
        const totalPnL = trades?.reduce((sum, t) => sum + (parseFloat(t.pnl || 0) || 0), 0) || 0
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
      }

      // NEW: Financial Oversight
      case 'getFinancialOverview': {
        try {
          const { data: allTrades, error: allTradesError } = await supabaseClient
            .from('trades')
            .select('pnl, created_at, status, size, entry_price, exit_price')

          if (allTradesError) {
            console.warn('Warning: failed to fetch trades for financial overview:', allTradesError.message)
          }

          const closedTrades = (allTrades || []).filter(t => (t.status || '').toLowerCase() === 'closed' || (t.status || '').toLowerCase() === 'filled')

          const totalVolume = closedTrades.reduce((sum, t) => {
            const size = parseFloat(t.size || 0) || 0
            const price = parseFloat(t.entry_price || 0) || 0
            return sum + Math.abs(size * price)
          }, 0)

          const totalPnL = closedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl || 0) || 0), 0)
          const totalFees = 0 // Fees not stored in current schema

          const dailyPnL = closedTrades.reduce((acc, trade) => {
            const date = (trade.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0]
            if (!acc[date]) acc[date] = 0
            acc[date] += parseFloat(trade.pnl || 0) || 0
            return acc
          }, {} as Record<string, number>)

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
        } catch (err) {
          console.error('Error building financial overview:', err)
          return new Response(JSON.stringify({
            financial: {
              totalVolume: 0,
              totalFees: 0,
              totalPnL: 0,
              dailyPnL: {},
              netProfit: 0
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

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
      case 'getRiskMetrics': {
        const { data: trades, error: tradesError } = await supabaseClient
          .from('trades')
          .select('*')
          .order('created_at', { ascending: false })

        if (tradesError) {
          console.warn('Warning: failed to fetch trades for risk metrics:', tradesError.message)
          return new Response(JSON.stringify({
            risk: {
              largeTrades: [],
              failedTrades: [],
              riskScore: 0
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const largeTrades = (trades || []).filter(trade => {
          const size = parseFloat(trade.size || 0) || 0
          const price = parseFloat(trade.entry_price || trade.price || 0) || 0
          return Math.abs(size * price) >= 1000
        }).slice(0, 20)

        const failedTrades = (trades || []).filter(trade => {
          const status = (trade.status || '').toLowerCase()
          if (status === 'failed' || status === 'error') return true
          const createdAt = trade.created_at ? new Date(trade.created_at).getTime() : 0
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
          return status !== 'closed' && status !== 'filled' && createdAt >= oneDayAgo
        }).slice(0, 20)

        return new Response(JSON.stringify({
          risk: {
            largeTrades,
            failedTrades,
            riskScore: failedTrades.length
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // NEW: Data Export
      case 'exportData': {
        const { type, userId } = params
        
        let result
        switch (type) {
          case 'user_trades': {
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
          }
          case 'all_trades': {
            const { data: allTradesData, error: allTradesError } = await supabaseClient
              .from('trades')
              .select('*')
            if (allTradesError) throw allTradesError
            result = allTradesData
            break
          }
          case 'users': {
            const { data: usersData, error: usersError } = await supabaseClient
              .from('users')
              .select('*')
            if (usersError) throw usersError
            result = usersData
            break
          }
          default:
            return new Response(JSON.stringify({ error: 'Invalid export type' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ data: result || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Admin management error:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return new Response(JSON.stringify({ 
      error: error?.message || 'Internal server error',
      details: String(error),
      stack: error?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})