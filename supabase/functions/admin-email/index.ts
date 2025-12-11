/**
 * Admin Email Management Edge Function
 * Handles sending emails from admin panel
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendEmailRequest {
  from: string // email address from mailboxes table
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: userData } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'send'

    // Send email
    if (action === 'send' && req.method === 'POST') {
      const body: SendEmailRequest = await req.json()
      const { from, to, cc, bcc, subject, html, text, replyTo } = body

      // Validate required fields
      if (!from || !to || !subject) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: from, to, subject' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify mailbox exists and is active
      const { data: mailbox, error: mailboxError } = await supabaseClient
        .from('mailboxes')
        .select('*')
        .eq('email_address', from)
        .eq('is_active', true)
        .single()

      if (mailboxError || !mailbox) {
        return new Response(
          JSON.stringify({ error: `Mailbox ${from} not found or inactive` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Send email via Resend
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const toArray = Array.isArray(to) ? to : [to]
      const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined
      const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${mailbox.display_name || mailbox.email_address} <${mailbox.email_address}>`,
          to: toArray,
          cc: ccArray,
          bcc: bccArray,
          reply_to: replyTo,
          subject: subject,
          html: html || text?.replace(/\n/g, '<br>'),
          text: text || html?.replace(/<[^>]*>/g, ''),
        }),
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        console.error('Resend API error:', errorData)
        
        // Save failed email to database
        await supabaseClient
          .from('emails')
          .insert({
            mailbox_id: mailbox.id,
            direction: 'outbound',
            from_address: from,
            to_address: Array.isArray(to) ? to.join(', ') : to,
            cc_addresses: ccArray,
            bcc_addresses: bccArray,
            subject: subject,
            html_body: html,
            text_body: text,
            status: 'failed',
            error_message: errorData.message || 'Failed to send email',
            sent_at: new Date().toISOString(),
          })

        return new Response(
          JSON.stringify({ 
            error: 'Failed to send email',
            details: errorData.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const emailResult = await emailResponse.json()

      // Save email to database
      const { data: savedEmail, error: saveError } = await supabaseClient
        .from('emails')
        .insert({
          mailbox_id: mailbox.id,
          direction: 'outbound',
          from_address: from,
          to_address: Array.isArray(to) ? to.join(', ') : to,
          cc_addresses: ccArray,
          bcc_addresses: bccArray,
          subject: subject,
          html_body: html,
          text_body: text,
          message_id: emailResult.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) {
        console.error('Error saving email to database:', saveError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          emailId: savedEmail?.id,
          resendId: emailResult.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get mailboxes
    if (action === 'get-mailboxes' && req.method === 'GET') {
      const { data: mailboxes, error } = await supabaseClient
        .from('mailboxes')
        .select('*')
        .eq('is_active', true)
        .order('email_address')

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ mailboxes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get emails (handles both GET and POST for flexibility)
    if (action === 'get-emails' && (req.method === 'GET' || req.method === 'POST')) {
      let mailboxId: string | null = null
      let direction: string = 'outbound'
      let limit: number = 50
      let offset: number = 0

      if (req.method === 'GET') {
        mailboxId = url.searchParams.get('mailboxId')
        direction = url.searchParams.get('direction') || 'outbound'
        limit = parseInt(url.searchParams.get('limit') || '50')
        offset = parseInt(url.searchParams.get('offset') || '0')
      } else {
        const body = await req.json()
        mailboxId = body.mailboxId || null
        direction = body.direction || 'outbound'
        limit = body.limit || 50
        offset = body.offset || 0
      }

      let query = supabaseClient
        .from('emails')
        .select('*, mailboxes(email_address, display_name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (direction !== 'all') {
        query = query.eq('direction', direction)
      }

      if (mailboxId) {
        query = query.eq('mailbox_id', mailboxId)
      }

      const { data: emails, error } = await query

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ emails }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Admin email error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})




