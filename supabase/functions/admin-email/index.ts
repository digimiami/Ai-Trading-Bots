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
    const action = url.searchParams.get('action')
    
    console.log('📧 [admin-email] Request received:', {
      method: req.method,
      action: action,
      url: req.url
    })

    // Get mailboxes (check this first as it's a common operation)
    if (action === 'get-mailboxes' && req.method === 'GET') {
      // Get all mailboxes for management, but filter active ones for sending
      const includeInactive = url.searchParams.get('include_inactive') === 'true'
      let query = supabaseClient
        .from('mailboxes')
        .select('*')
        .order('email_address')

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data: mailboxes, error } = await query

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

    // Create mailbox
    if (action === 'create-mailbox' && req.method === 'POST') {
      const body = await req.json()
      const { email_address, display_name, is_active } = body

      if (!email_address) {
        return new Response(
          JSON.stringify({ error: 'email_address is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email_address)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email address format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: mailbox, error } = await supabaseClient
        .from('mailboxes')
        .insert({
          email_address,
          display_name: display_name || email_address.split('@')[0],
          is_active: is_active !== undefined ? is_active : true,
        })
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ mailbox }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update mailbox
    if (action === 'update-mailbox' && req.method === 'POST') {
      const body = await req.json()
      const { id, email_address, display_name, is_active } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updateData: any = {}
      if (email_address !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email_address)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email address format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        updateData.email_address = email_address
      }
      if (display_name !== undefined) updateData.display_name = display_name
      if (is_active !== undefined) updateData.is_active = is_active
      updateData.updated_at = new Date().toISOString()

      const { data: mailbox, error } = await supabaseClient
        .from('mailboxes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ mailbox }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete mailbox
    if (action === 'delete-mailbox' && req.method === 'POST') {
      const body = await req.json()
      const { id } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseClient
        .from('mailboxes')
        .delete()
        .eq('id', id)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
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

    // Send email (default action if no action specified)
    // NOTE: This must come AFTER broadcast handler to avoid conflicts
    if ((action === 'send' || !action) && req.method === 'POST') {
      console.log('📧 [admin-email] Processing send action (default)')
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

    // Broadcast email to all users or selected users (check BEFORE send handler)
    if (action === 'broadcast' && req.method === 'POST') {
      console.log('📧 [admin-email] Processing broadcast action')
      const body = await req.json()
      const { from, subject, html, text, userIds, userEmails, sendToAll } = body

      // Validate required fields
      if (!from || !subject) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: from, subject' }),
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

      // Get recipients
      let recipients: string[] = []
      
      if (sendToAll) {
        // Get all active users
        const { data: users, error: usersError } = await supabaseClient
          .from('users')
          .select('email')
          .eq('status', 'active')
        
        if (usersError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch users', details: usersError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        recipients = users?.map(u => u.email).filter(Boolean) || []
      } else if (userIds && userIds.length > 0) {
        // Get emails for specific user IDs
        const { data: users, error: usersError } = await supabaseClient
          .from('users')
          .select('email')
          .in('id', userIds)
        
        if (usersError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch users', details: usersError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        recipients = users?.map(u => u.email).filter(Boolean) || []
      } else if (userEmails && userEmails.length > 0) {
        recipients = Array.isArray(userEmails) ? userEmails : [userEmails]
      } else {
        return new Response(
          JSON.stringify({ error: 'No recipients specified. Provide userIds, userEmails, or set sendToAll=true' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid recipients found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Send emails via Resend (batch sending)
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
        emailIds: [] as string[]
      }

      // Send to each recipient (Resend doesn't support true BCC for multiple recipients in one call)
      for (const recipient of recipients) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${mailbox.display_name || mailbox.email_address} <${mailbox.email_address}>`,
              to: recipient,
              subject: subject,
              html: html || text?.replace(/\n/g, '<br>'),
              text: text || html?.replace(/<[^>]*>/g, ''),
            }),
          })

          if (!emailResponse.ok) {
            const errorData = await emailResponse.json()
            results.failed++
            results.errors.push(`${recipient}: ${errorData.message || 'Failed to send'}`)
            
            // Save failed email to database
            await supabaseClient
              .from('emails')
              .insert({
                mailbox_id: mailbox.id,
                direction: 'outbound',
                from_address: from,
                to_address: recipient,
                subject: subject,
                html_body: html,
                text_body: text,
                status: 'failed',
                error_message: errorData.message || 'Failed to send email',
                sent_at: new Date().toISOString(),
              })
          } else {
            const emailResult = await emailResponse.json()
            results.sent++
            
            // Save email to database
            const { data: savedEmail } = await supabaseClient
              .from('emails')
              .insert({
                mailbox_id: mailbox.id,
                direction: 'outbound',
                from_address: from,
                to_address: recipient,
                subject: subject,
                html_body: html,
                text_body: text,
                message_id: emailResult.id,
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .select()
              .single()
            
            if (savedEmail) {
              results.emailIds.push(savedEmail.id)
            }
          }
        } catch (err: any) {
          results.failed++
          results.errors.push(`${recipient}: ${err.message || 'Unknown error'}`)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Broadcast completed: ${results.sent} sent, ${results.failed} failed`,
          results: {
            total: recipients.length,
            sent: results.sent,
            failed: results.failed,
            errors: results.errors,
            emailIds: results.emailIds
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('❌ [admin-email] Invalid action:', action, 'Method:', req.method)
    return new Response(
      JSON.stringify({ error: 'Invalid action', receivedAction: action, method: req.method }),
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




