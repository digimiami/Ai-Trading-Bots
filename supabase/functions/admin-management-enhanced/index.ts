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
        // First, get all users from the users table
        const { data: users, error: usersError } = await supabaseClient
          .from('users')
            .select('id, email, role, status, status_updated_at, created_at')
          .order('created_at', { ascending: false })

          if (usersError) {
            console.error('Error fetching users:', usersError)
            return new Response(JSON.stringify({ 
              users: [],
              error: 'Failed to fetch users',
              details: usersError.message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Get all auth users to find any missing from users table
          // This ensures users who signed up but the trigger didn't fire will appear
          try {
            const { data: { users: authUsers }, error: authError } = await supabaseClient.auth.admin.listUsers()
            
            if (!authError && authUsers) {
              const existingUserIds = new Set((users || []).map((u: any) => u.id))
              
              // Find auth users that don't have entries in users table
              const missingUsers = authUsers.filter(authUser => !existingUserIds.has(authUser.id))
              
              if (missingUsers.length > 0) {
                console.log(`📝 Found ${missingUsers.length} auth users without entries in users table. Creating missing entries...`)
                
                // Create missing user entries
                const usersToInsert = missingUsers.map(authUser => ({
                  id: authUser.id,
                  email: authUser.email || '',
                  name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
                  role: authUser.app_metadata?.role || 'user',
                  status: 'active',
                  status_updated_at: new Date().toISOString(),
                  created_at: authUser.created_at || new Date().toISOString()
                }))
                
                const { error: insertError } = await supabaseClient
                  .from('users')
                  .insert(usersToInsert)
                
                if (insertError) {
                  console.error('Error creating missing user entries:', insertError)
                } else {
                  console.log(`✅ Created ${usersToInsert.length} missing user entries`)
                  // Re-fetch users to include the newly created ones
                  const { data: updatedUsers } = await supabaseClient
                    .from('users')
                    .select('id, email, role, status, status_updated_at, created_at')
                    .order('created_at', { ascending: false })
                  
                  if (updatedUsers) {
                    users.length = 0
                    users.push(...updatedUsers)
                  }
                }
              }
            }
          } catch (authCheckError) {
            console.warn('Could not check auth users for missing entries:', authCheckError)
            // Continue with existing users even if auth check fails
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
                
                // Fetch trades (handle if table doesn't exist)
                let trades: any[] = []
                try {
                  const { data: tradesData } = await supabaseClient
                    .from('trades')
                    .select('*')
                    .eq('user_id', user.id)
                  trades = tradesData || []
                } catch (tradesError) {
                  console.warn(`Could not fetch trades for user ${user.id}:`, tradesError)
                  trades = []
                }
                
                const totalVolume = (trades || []).reduce((sum, trade) => {
                  const size = parseFloat(trade.size || trade.amount || trade.quantity || 0) || 0
                  const entryPrice = parseFloat(trade.entry_price || trade.price || 0) || 0
                  return sum + Math.abs(size * entryPrice)
                }, 0)

                // Fetch paper trades (handle if table doesn't exist)
                let paperTrades: any[] = []
                try {
                  const { data: paperTradesData } = await supabaseClient
                    .from('paper_trading_trades')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'closed')
                  paperTrades = paperTradesData || []
                } catch (paperError) {
                  console.warn(`Could not fetch paper trades for user ${user.id}:`, paperError)
                  paperTrades = []
                }
                
                const paperPnL = (paperTrades || []).reduce((sum, trade) => sum + (parseFloat(trade.pnl || 0) || 0), 0)
                const paperTradesCount = paperTrades?.length || 0
                
                // Check if user is active (logged in within last 30 days)
                // Try to get last_sign_in_at from auth.users if available
                let isActive = false
                try {
                  const { data: authUser } = await supabaseClient.auth.admin.getUserById(user.id)
                  if (authUser?.user?.last_sign_in_at) {
                    const lastSignIn = new Date(authUser.user.last_sign_in_at).getTime()
                    isActive = lastSignIn > Date.now() - (30 * 24 * 60 * 60 * 1000)
                  }
                } catch (authError) {
                  // If we can't get auth data, assume inactive
                  console.warn('Could not fetch auth data for user:', user.id)
                }
                
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
        const { email, password, role, planId } = params
        
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

        // Create subscription if planId is provided
        if (planId) {
          try {
            // Verify plan exists
            const { data: plan, error: planError } = await supabaseClient
              .from('subscription_plans')
              .select('id, name')
              .eq('id', planId)
              .single()

            if (planError || !plan) {
              console.warn(`Plan ${planId} not found, skipping subscription creation`)
            } else {
              // Calculate expiration (30 days from now)
              const expiresAt = new Date()
              expiresAt.setDate(expiresAt.getDate() + 30)

              // Create subscription
              const { error: subError } = await supabaseClient
                .from('user_subscriptions')
                .insert({
                  user_id: newUser.user.id,
                  plan_id: planId,
                  status: 'active',
                  expires_at: expiresAt.toISOString(),
                  started_at: new Date().toISOString(),
                  trial_started_at: null,
                  trial_period_days: null
                })

              if (subError) {
                console.error('Error creating subscription:', subError)
                // Don't fail user creation if subscription fails, just log it
              } else {
                console.log(`✅ Subscription created for user ${newUser.user.id} with plan ${plan.name}`)
              }
            }
          } catch (subError) {
            console.error('Error creating subscription:', subError)
            // Don't fail user creation if subscription fails
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: planId ? 'User created successfully with subscription' : 'User created successfully',
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
          used: code.used_by !== null,
          users_created: code.users_created || 0,
          user_limit: code.user_limit
        }))
        
        return new Response(JSON.stringify({ codes: codesWithUsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'generateInvitationCode':
        const { email: inviteEmail, expiresInDays, userLimit } = params
        
        const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7))

        const { data: invitation, error: inviteError } = await supabaseClient
          .from('invitation_codes')
          .insert({
            code,
            email: inviteEmail,
            expires_at: expiresAt.toISOString(),
            user_limit: userLimit || null,
            users_created: 0
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
        try {
          console.log('🔍 deleteUser called with params:', JSON.stringify(params))
          let userId = params.userId
          const userEmail = params.userEmail
          
          // If email provided instead of userId, find the user ID
          if (!userId && userEmail) {
            console.log(`📧 Looking up user by email: ${userEmail}`)
            const { data: userData, error: findError } = await supabaseClient
              .from('users')
              .select('id')
              .eq('email', userEmail)
              .single()
            
            if (findError || !userData) {
              console.log(`⚠️ User not found in database, error:`, findError)
              // Don't try listUsers() as it can be slow/error-prone with many users
              // Just return not found
              return new Response(JSON.stringify({ 
                error: `User not found: ${userEmail}`,
                details: findError?.message || 'User does not exist in database'
              }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            } else {
              userId = userData.id
              console.log(`✅ Found user ID: ${userId}`)
            }
          }
          
          if (!userId) {
            console.error('❌ No userId or userEmail provided')
            return new Response(JSON.stringify({ 
              error: 'Either userId or userEmail must be provided' 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          console.log(`🔍 Checking user existence for ID: ${userId}`)
          
          // Check if user exists in database
          const { data: dbUser, error: checkDbError } = await supabaseClient
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .maybeSingle()
          
          if (checkDbError) {
            console.error('❌ Error checking database user:', checkDbError)
            return new Response(JSON.stringify({ 
              error: `Failed to check user existence: ${checkDbError.message}` 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          // Check if user exists in auth
          let authUserExists = false
          let authCheckError: any = null
          try {
            const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(userId)
            authCheckError = authError
            authUserExists = !authError && !!authUser?.user
            console.log(`🔐 Auth user exists: ${authUserExists}, error:`, authError?.message || 'none')
          } catch (authCheckErr: any) {
            authCheckError = authCheckErr
            console.warn('⚠️ Exception checking auth user existence:', authCheckErr)
            authUserExists = false
          }
          
          // If neither exists, return success (already deleted)
          if (!dbUser && !authUserExists) {
            console.log(`ℹ️ User ${userId} already deleted from both systems`)
            return new Response(JSON.stringify({ 
              success: true, 
              message: 'User was already deleted',
              deletedUserId: userId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          // Delete from auth (only if exists)
          if (authUserExists) {
            console.log(`🗑️ Deleting auth user: ${userId}`)
            const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId)
            if (deleteAuthError) {
              console.error('❌ Error deleting auth user:', deleteAuthError)
              // Check if it's a "not found" error (acceptable)
              const isNotFoundError = deleteAuthError.message?.toLowerCase().includes('not found') || 
                                     deleteAuthError.message?.toLowerCase().includes('does not exist') ||
                                     deleteAuthError.message?.toLowerCase().includes('user not found')
              
              if (!isNotFoundError) {
                return new Response(JSON.stringify({ 
                  error: `Failed to delete auth user: ${deleteAuthError.message}`,
                  code: deleteAuthError.status || 'AUTH_DELETE_ERROR'
                }), {
                  status: 500,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              } else {
                console.log(`ℹ️ Auth user already deleted, continuing...`)
              }
            } else {
              console.log(`✅ Auth user deleted successfully`)
            }
          } else {
            console.log(`ℹ️ Auth user ${userId} does not exist, skipping auth deletion`)
          }

          // Delete from database (only if exists)
          if (dbUser) {
            console.log(`🗑️ Deleting database user: ${userId}`)
            const { error: deleteDbError } = await supabaseClient
              .from('users')
              .delete()
              .eq('id', userId)

            if (deleteDbError) {
              console.error('❌ Error deleting database user:', deleteDbError)
              // Check if it's a foreign key constraint error
              if (deleteDbError.code === '23503' || deleteDbError.message?.includes('foreign key')) {
                return new Response(JSON.stringify({ 
                  error: `Cannot delete user: User has associated data (bots, trades, etc.). Please delete or reassign related data first.`,
                  details: deleteDbError.message,
                  code: deleteDbError.code
                }), {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              }
              return new Response(JSON.stringify({ 
                error: `Failed to delete database user: ${deleteDbError.message}`,
                code: deleteDbError.code || 'DB_DELETE_ERROR',
                details: deleteDbError
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            } else {
              console.log(`✅ Database user deleted successfully`)
            }
          } else {
            console.log(`ℹ️ Database user ${userId} does not exist, skipping database deletion`)
          }

          console.log(`✅ User deletion completed successfully for: ${userId}`)
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'User deleted successfully',
            deletedUserId: userId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('❌ Unexpected error in deleteUser:', error)
          console.error('Error stack:', error?.stack)
          console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
          return new Response(JSON.stringify({ 
            error: error?.message || 'Failed to delete user',
            details: String(error),
            code: error?.code || 'UNKNOWN_ERROR',
            stack: error?.stack
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

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

      case 'getLatestTrades': {
        try {
          const { limit = 100, user_id = null } = params

          // Build query for real trades (service role bypasses RLS)
          let realTradesQuery = supabaseClient
            .from('trades')
            .select('id, user_id, bot_id, symbol, side, amount, price, status, pnl, fee, executed_at, created_at')
            .not('executed_at', 'is', null)
            .order('executed_at', { ascending: false })
            .limit(limit)

          // Filter by user_id if provided
          if (user_id) {
            realTradesQuery = realTradesQuery.eq('user_id', user_id)
          }

          const { data: realTrades, error: realError } = await realTradesQuery

          if (realError) {
            console.error('Error fetching real trades:', realError)
            throw realError
          }

          // Build query for paper trades (service role bypasses RLS)
          let paperTradesQuery = supabaseClient
            .from('paper_trading_trades')
            .select('id, user_id, bot_id, symbol, side, quantity, entry_price, exit_price, status, pnl, fees, executed_at, created_at')
            .not('executed_at', 'is', null)
            .order('executed_at', { ascending: false })
            .limit(limit)

          // Filter by user_id if provided
          if (user_id) {
            paperTradesQuery = paperTradesQuery.eq('user_id', user_id)
          }

          const { data: paperTrades, error: paperError } = await paperTradesQuery

          if (paperError) {
            console.error('Error fetching paper trades:', paperError)
            throw paperError
          }

          // Collect unique user IDs and bot IDs
          const userIds = new Set<string>()
          const botIds = new Set<string>()

          ;(realTrades || []).forEach((trade: any) => {
            if (trade.user_id) userIds.add(trade.user_id)
            if (trade.bot_id) botIds.add(trade.bot_id)
          })

          ;(paperTrades || []).forEach((trade: any) => {
            if (trade.user_id) userIds.add(trade.user_id)
            if (trade.bot_id) botIds.add(trade.bot_id)
          })

          // Fetch user emails
          const userEmailsMap = new Map<string, string>()
          if (userIds.size > 0) {
            const { data: users, error: usersError } = await supabaseClient
              .from('users')
              .select('id, email')
              .in('id', Array.from(userIds))

            if (!usersError && users) {
              users.forEach((user: any) => {
                userEmailsMap.set(user.id, user.email || 'Unknown')
              })
            }
          }

          // Fetch bot names
          const botNamesMap = new Map<string, string>()
          if (botIds.size > 0) {
            const { data: bots, error: botsError } = await supabaseClient
              .from('trading_bots')
              .select('id, name')
              .in('id', Array.from(botIds))

            if (!botsError && bots) {
              bots.forEach((bot: any) => {
                botNamesMap.set(bot.id, bot.name || 'Unknown Bot')
              })
            }
          }

          // Format real trades
          const formattedRealTrades = (realTrades || []).map((trade: any) => ({
            trade_type: 'REAL',
            trade_id: trade.id,
            user_email: userEmailsMap.get(trade.user_id) || 'Unknown',
            user_id: trade.user_id,
            bot_name: botNamesMap.get(trade.bot_id) || 'Unknown Bot',
            symbol: trade.symbol,
            side: trade.side,
            amount: trade.amount,
            price: trade.price,
            status: trade.status,
            pnl: trade.pnl || 0,
            fee: trade.fee || 0,
            executed_at: trade.executed_at,
            created_at: trade.created_at,
            minutes_ago: trade.executed_at ? Math.floor((Date.now() - new Date(trade.executed_at).getTime()) / 60000) : null
          }))

          // Format paper trades
          const formattedPaperTrades = (paperTrades || []).map((trade: any) => ({
            trade_type: 'PAPER',
            trade_id: trade.id,
            user_email: userEmailsMap.get(trade.user_id) || 'Unknown',
            user_id: trade.user_id,
            bot_name: botNamesMap.get(trade.bot_id) || 'Unknown Bot',
            symbol: trade.symbol,
            side: trade.side,
            amount: trade.quantity,
            price: trade.exit_price || trade.entry_price,
            status: trade.status,
            pnl: trade.pnl || 0,
            fee: trade.fees || 0,
            executed_at: trade.executed_at,
            created_at: trade.created_at,
            minutes_ago: trade.executed_at ? Math.floor((Date.now() - new Date(trade.executed_at).getTime()) / 60000) : null
          }))

          // Combine and sort by executed_at
          const allTrades = [...formattedRealTrades, ...formattedPaperTrades]
            .sort((a, b) => {
              const timeA = a.executed_at ? new Date(a.executed_at).getTime() : 0
              const timeB = b.executed_at ? new Date(b.executed_at).getTime() : 0
              return timeB - timeA
            })
            .slice(0, limit)

          return new Response(JSON.stringify({ trades: allTrades }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Error in getLatestTrades:', error)
          return new Response(JSON.stringify({
            error: error?.message || 'Failed to fetch latest trades',
            trades: []
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'getTestPeriodSettings': {
        try {
          // Check if table exists first
          const { data: settings, error: settingsError } = await supabaseClient
            .from('test_period_settings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() // Use maybeSingle instead of single to handle missing table gracefully

          // If table doesn't exist or no rows, return default settings
          if (settingsError) {
            // Check if it's a "table doesn't exist" error
            if (settingsError.message?.includes('relation') || settingsError.message?.includes('does not exist') || settingsError.code === 'PGRST116') {
              console.log('test_period_settings table does not exist, returning default settings')
              return new Response(JSON.stringify({ 
                settings: { 
                  enabled: false, 
                  start_date: null, 
                  end_date: null, 
                  message: 'The website is currently in test mode. Some features may be limited.' 
                } 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
            // For other errors, throw to be caught by outer catch
            throw settingsError
          }

          return new Response(JSON.stringify({ 
            settings: settings || { 
              enabled: false, 
              start_date: null, 
              end_date: null, 
              message: 'The website is currently in test mode. Some features may be limited.' 
            } 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Error fetching test period settings:', error)
          // Return default settings instead of error to prevent admin page from breaking
          return new Response(JSON.stringify({ 
            settings: { 
              enabled: false, 
              start_date: null, 
              end_date: null, 
              message: 'The website is currently in test mode. Some features may be limited.' 
            },
            warning: 'Could not load test period settings, using defaults'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'updateTestPeriodSettings': {
        const { enabled, start_date, end_date, message } = params

        if (enabled && (!start_date || !end_date)) {
          return new Response(JSON.stringify({
            error: 'Start date and end date are required when enabling test period'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (enabled && new Date(start_date) >= new Date(end_date)) {
          return new Response(JSON.stringify({
            error: 'End date must be after start date'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        try {
          // Check if settings exist
          const { data: existing, error: checkError } = await supabaseClient
            .from('test_period_settings')
            .select('id')
            .limit(1)
            .single()

          let result
          if (existing) {
            // Update existing
            const { data, error: updateError } = await supabaseClient
              .from('test_period_settings')
              .update({
                enabled: enabled || false,
                start_date: enabled ? start_date : null,
                end_date: enabled ? end_date : null,
                message: message || 'The website is currently in test mode. Some features may be limited.',
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)
              .select()
              .single()

            if (updateError) throw updateError
            result = data
          } else {
            // Insert new
            const { data, error: insertError } = await supabaseClient
              .from('test_period_settings')
              .insert({
                enabled: enabled || false,
                start_date: enabled ? start_date : null,
                end_date: enabled ? end_date : null,
                message: message || 'The website is currently in test mode. Some features may be limited.',
                created_by: user.id
              })
              .select()
              .single()

            if (insertError) throw insertError
            result = data
          }

          return new Response(JSON.stringify({
            success: true,
            message: enabled ? 'Test period enabled successfully' : 'Test period disabled successfully',
            settings: result
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Error updating test period settings:', error)
          return new Response(JSON.stringify({
            error: error?.message || 'Failed to update test period settings'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'deleteUsersByDateRange': {
        const { start_date, end_date, confirm } = params

        if (!confirm || confirm !== 'DELETE') {
          return new Response(JSON.stringify({
            error: 'Confirmation required. Set confirm to "DELETE" to proceed.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!start_date || !end_date) {
          return new Response(JSON.stringify({
            error: 'Start date and end date are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        try {
          // Get users created in date range
          const { data: usersToDelete, error: fetchError } = await supabaseClient
            .from('users')
            .select('id, email, created_at')
            .gte('created_at', start_date)
            .lte('created_at', end_date)
            .neq('role', 'admin') // Don't delete admins

          if (fetchError) throw fetchError

          if (!usersToDelete || usersToDelete.length === 0) {
            return new Response(JSON.stringify({
              success: true,
              message: 'No users found in the specified date range',
              deleted_count: 0
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          let deletedCount = 0
          const errors: string[] = []

          // Delete each user
          for (const userToDelete of usersToDelete) {
            try {
              // Delete from auth
              const { error: authError } = await supabaseClient.auth.admin.deleteUser(userToDelete.id)
              if (authError) throw authError

              // Delete from database (cascade will handle related data)
              const { error: dbError } = await supabaseClient
                .from('users')
                .delete()
                .eq('id', userToDelete.id)

              if (dbError) throw dbError

              deletedCount++
            } catch (userError: any) {
              errors.push(`${userToDelete.email}: ${userError?.message || 'Unknown error'}`)
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: `Deleted ${deletedCount} user(s)`,
            deleted_count: deletedCount,
            total_found: usersToDelete.length,
            errors: errors.length > 0 ? errors : undefined
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Error deleting users by date range:', error)
          return new Response(JSON.stringify({
            error: error?.message || 'Failed to delete users'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'upgradeUserSubscription': {
        const { userId, planId } = params

        if (!userId || !planId) {
          return new Response(JSON.stringify({
            error: 'userId and planId are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        try {
          // Find user's subscription
          const { data: subscription, error: subError } = await supabaseClient
            .from('user_subscriptions')
            .select(`
              *,
              subscription_plans!user_subscriptions_plan_id_fkey(*),
              users!user_subscriptions_user_id_fkey(email)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          // If no subscription exists, create one
          if (subError || !subscription) {
            // Fetch plan details
            const { data: plan, error: planError } = await supabaseClient
              .from('subscription_plans')
              .select('*')
              .eq('id', planId)
              .single()

            if (planError || !plan) {
              return new Response(JSON.stringify({
                error: 'Plan not found'
              }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }

            // Create new subscription
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 30)

            const { data: newSubscription, error: createError } = await supabaseClient
              .from('user_subscriptions')
              .insert({
                user_id: userId,
                plan_id: planId,
                status: 'active',
                expires_at: expiresAt.toISOString(),
                started_at: new Date().toISOString()
              })
              .select(`
                *,
                subscription_plans!user_subscriptions_plan_id_fkey(*),
                users!user_subscriptions_user_id_fkey(email)
              `)
              .single()

            if (createError) {
              console.error('Error creating subscription:', createError)
              return new Response(JSON.stringify({
                error: 'Failed to create subscription',
                details: createError.message
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }

            return new Response(JSON.stringify({
              success: true,
              message: 'Subscription created successfully',
              subscription: newSubscription
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Update existing subscription
          const currentPlan = subscription.subscription_plans
          const currentPlanId = subscription.plan_id

          if (currentPlanId === planId) {
            return new Response(JSON.stringify({
              error: 'User is already on this plan'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Fetch new plan details
          const { data: newPlan, error: planError } = await supabaseClient
            .from('subscription_plans')
            .select('*')
            .eq('id', planId)
            .single()

          if (planError || !newPlan) {
            return new Response(JSON.stringify({
              error: 'Plan not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Calculate expiration - preserve remaining time or set to 30 days from now
          let expiresAt = new Date()
          if (subscription.expires_at && new Date(subscription.expires_at) > new Date()) {
            expiresAt = new Date(subscription.expires_at)
          } else {
            expiresAt.setDate(expiresAt.getDate() + 30)
          }

          // Update subscription
          const { data: updatedSubscription, error: updateError } = await supabaseClient
            .from('user_subscriptions')
            .update({
              plan_id: planId,
              status: 'active',
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)
            .select(`
              *,
              subscription_plans!user_subscriptions_plan_id_fkey(*),
              users!user_subscriptions_user_id_fkey(email)
            `)
            .single()

          if (updateError) {
            console.error('Error updating subscription:', updateError)
            return new Response(JSON.stringify({
              error: 'Failed to update subscription',
              details: updateError.message
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Determine if upgrade or downgrade
          const isUpgrade = (newPlan.price_monthly_usd || 0) > (currentPlan?.price_monthly_usd || 0)
          const action = isUpgrade ? 'upgraded' : 'downgraded'

          return new Response(JSON.stringify({
            success: true,
            message: `Subscription ${action} successfully`,
            subscription: updatedSubscription,
            action: action
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })

        } catch (error: any) {
          console.error('Error in upgradeUserSubscription:', error)
          return new Response(JSON.stringify({
            error: error?.message || 'Failed to upgrade subscription'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // NEW: Tracking Scripts Management
      case 'getTrackingScripts': {
        try {
          const { data: scripts, error: scriptsError } = await supabaseClient
            .from('tracking_scripts')
            .select('*')
            .order('created_at', { ascending: false })

          if (scriptsError) {
            console.error('Error fetching tracking scripts:', scriptsError)
            return new Response(JSON.stringify({ 
              error: 'Failed to fetch tracking scripts',
              details: scriptsError.message,
              code: scriptsError.code,
              hint: scriptsError.hint
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ scripts: scripts || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (err) {
          console.error('Unexpected error in getTrackingScripts:', err)
          throw err
        }
      }

      case 'createTrackingScript': {
        try {
          const { name, script_content, event_type, is_active } = params
          
          if (!name || !script_content || !event_type) {
            return new Response(JSON.stringify({ 
              error: 'Missing required fields',
              required: ['name', 'script_content', 'event_type']
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          const { data: script, error: createError } = await supabaseClient
            .from('tracking_scripts')
            .insert({ name, script_content, event_type, is_active: is_active !== undefined ? is_active : true })
            .select()
            .single()

          if (createError) {
            console.error('Error creating tracking script:', createError)
            return new Response(JSON.stringify({ 
              error: 'Failed to create tracking script',
              details: createError.message,
              code: createError.code,
              hint: createError.hint
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ success: true, script }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (err) {
          console.error('Unexpected error in createTrackingScript:', err)
          throw err
        }
      }

      case 'updateTrackingScript': {
        try {
          const { id, ...updates } = params
          
          if (!id) {
            return new Response(JSON.stringify({ 
              error: 'Missing required field: id'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          const { data: script, error: updateError } = await supabaseClient
            .from('tracking_scripts')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

          if (updateError) {
            console.error('Error updating tracking script:', updateError)
            return new Response(JSON.stringify({ 
              error: 'Failed to update tracking script',
              details: updateError.message,
              code: updateError.code,
              hint: updateError.hint
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ success: true, script }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (err) {
          console.error('Unexpected error in updateTrackingScript:', err)
          throw err
        }
      }

      case 'deleteTrackingScript': {
        try {
          const { id } = params
          
          if (!id) {
            return new Response(JSON.stringify({ 
              error: 'Missing required field: id'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          const { error: deleteError } = await supabaseClient
            .from('tracking_scripts')
            .delete()
            .eq('id', id)

          if (deleteError) {
            console.error('Error deleting tracking script:', deleteError)
            return new Response(JSON.stringify({ 
              error: 'Failed to delete tracking script',
              details: deleteError.message,
              code: deleteError.code,
              hint: deleteError.hint
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (err) {
          console.error('Unexpected error in deleteTrackingScript:', err)
          throw err
        }
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