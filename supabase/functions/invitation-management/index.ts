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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('user_role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.user_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { method } = req
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (method === 'POST' && action === 'create') {
      const { email, expiresInDays } = await req.json()

      // Generate unique invitation code
      const code = generateInvitationCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7))

      const { data, error } = await supabaseClient
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
      const { data, error } = await supabaseClient
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

    if (method === 'POST' && action === 'validate') {
      const { code } = await req.json()

      const { data, error } = await supabaseClient
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

    if (method === 'POST' && action === 'use') {
      const { code, userId } = await req.json()

      const { data, error } = await supabaseClient
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

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, invitation: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (method === 'DELETE') {
      const codeId = url.searchParams.get('id')
      
      const { error } = await supabaseClient
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