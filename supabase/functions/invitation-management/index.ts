import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const authHeader = req.headers.get('Authorization') ?? ''

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseAuthed = authHeader
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: { Authorization: authHeader },
          },
        })
      : null

    const requireUser = async () => {
      if (!supabaseAuthed) {
        return { error: 'Unauthorized', status: 401, user: null }
      }
      const { data: { user }, error } = await supabaseAuthed.auth.getUser()
      if (error || !user) {
        return { error: 'Unauthorized', status: 401, user: null }
      }
      return { user, error: null }
    }

    const requireAdmin = async () => {
      const { user, error, status } = await requireUser()
      if (error || !user) {
        return { error, status }
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'admin') {
        return { error: 'Admin access required', status: 403 }
      }

      return { user, error: null }
    }

    const { method } = req

    // Allow public validation of invitation codes
    if (method === 'POST' && action === 'validate') {
      const { code } = await req.json()

      const { data, error } = await supabaseAdmin
        .from('invitation_codes')
        .select('*')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Invalid or expired invitation code'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        valid: true,
        invitation: data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark invitation code as used (requires authenticated user)
    if (method === 'POST' && action === 'use') {
      const { code, userId } = await req.json()
      const { user, error, status } = await requireUser()
      if (error || !user) {
        return new Response(JSON.stringify({ error }), {
          status: status || 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (user.id !== userId) {
        return new Response(JSON.stringify({ error: 'Invalid user' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: invitation, error: invitationError } = await supabaseAdmin
        .from('invitation_codes')
        .select('*')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (invitationError || !invitation) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error: updateError } = await supabaseAdmin
        .from('invitation_codes')
        .update({
          used_at: new Date().toISOString(),
          used_by: userId
        })
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .select()
      .single()

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, invitation: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Remaining actions require admin privileges
    const { user, error: adminError, status: adminStatus } = await requireAdmin()
    if (adminError || !user) {
      return new Response(JSON.stringify({ error: adminError }), {
        status: adminStatus || 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (method === 'POST' && action === 'create') {
      const { email, expiresInDays } = await req.json()

      // Generate unique invitation code
      const code = generateInvitationCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7))

      const { data, error } = await supabaseAdmin
        .from('invitation_codes')
        .insert({
          code,
          created_by: user.id,
          email: email || null,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ 
        success: true, 
        invitation: data,
        invitationUrl: `${url.origin}/auth?invite=${code}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (method === 'GET' && action === 'list') {
      const { data, error } = await supabaseAdmin
        .from('invitation_codes')
        .select(`
          *,
          creator:created_by(email),
          user:used_by(email)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ invitations: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (method === 'DELETE') {
      const codeId = url.searchParams.get('id')
      
      const { error } = await supabaseAdmin
        .from('invitation_codes')
        .delete()
        .eq('id', codeId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}