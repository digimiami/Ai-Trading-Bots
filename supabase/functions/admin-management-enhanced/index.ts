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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
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

    const { action, ...params } = await req.json()

    switch (action) {
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
        
        // Create user in auth
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        })

        if (createError) throw createError

        // Create user record in database
        const { error: dbError } = await supabaseClient
          .from('users')
          .insert({
            id: newUser.user.id,
            email,
            role: role || 'user'
          })

        if (dbError) throw dbError

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
        return new Response(JSON.stringify({ codes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'generateInvitationCode':
        const { email: inviteEmail, expiresInDays } = params
        
        // Generate unique code
        const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7))

        const { data: invitation, error: inviteError } = await supabaseClient
          .from('invitation_codes')
          .insert({
            code,
            email: inviteEmail,
            expires_at: expiresAt.toISOString(),
            used: false
          })
          .select()
          .single()

        if (inviteError) throw inviteError

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Invitation code generated successfully',
          invitation 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'deleteUser':
        const { userId } = params
        
        // Delete from auth
        const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId)
        if (deleteAuthError) throw deleteAuthError

        // Delete from database
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