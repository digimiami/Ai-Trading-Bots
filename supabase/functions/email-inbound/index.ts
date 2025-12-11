/**
 * Email Inbound Webhook Handler
 * Receives emails from email providers (Resend, Mailgun, Postmark, etc.)
 * and stores them in the database for admin management
 * 
 * Configure your email provider to forward incoming emails to this webhook:
 * - Resend: https://resend.com/docs/dashboard/webhooks
 * - Mailgun: https://documentation.mailgun.com/en/latest/user_manual.html#receiving-messages
 * - Postmark: https://postmarkapp.com/developer/webhooks/inbound-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InboundEmailPayload {
  // Resend format
  type?: string
  data?: {
    from?: string
    to?: string | string[]
    subject?: string
    html?: string
    text?: string
    headers?: Record<string, string>
    message_id?: string
    in_reply_to?: string
  }
  // Mailgun format
  'sender'?: string
  'recipient'?: string
  'subject'?: string
  'body-html'?: string
  'body-plain'?: string
  'Message-Id'?: string
  'In-Reply-To'?: string
  // Generic format
  from?: string
  to?: string | string[]
  subject?: string
  html?: string
  text?: string
  messageId?: string
  inReplyTo?: string
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

    // Verify webhook secret (optional but recommended)
    const webhookSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
    const providedSecret = req.headers.get('X-Webhook-Secret') || req.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.warn('⚠️ Invalid webhook secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: InboundEmailPayload = await req.json()
    console.log('📧 Inbound email received:', JSON.stringify(payload, null, 2))

    // Parse email data based on provider format
    let fromAddress: string = ''
    let toAddress: string | string[] = ''
    let subject: string = ''
    let htmlBody: string = ''
    let textBody: string = ''
    let messageId: string = ''
    let inReplyTo: string = ''

    // Resend format
    if (payload.type === 'email.received' && payload.data) {
      fromAddress = payload.data.from || ''
      toAddress = payload.data.to || ''
      subject = payload.data.subject || ''
      htmlBody = payload.data.html || ''
      textBody = payload.data.text || ''
      messageId = payload.data.message_id || payload.data.headers?.['Message-Id'] || ''
      inReplyTo = payload.data.in_reply_to || payload.data.headers?.['In-Reply-To'] || ''
    }
    // Mailgun format
    else if (payload.sender) {
      fromAddress = payload.sender
      toAddress = payload.recipient || ''
      subject = payload.subject || ''
      htmlBody = payload['body-html'] || ''
      textBody = payload['body-plain'] || ''
      messageId = payload['Message-Id'] || ''
      inReplyTo = payload['In-Reply-To'] || ''
    }
    // Generic format
    else {
      fromAddress = payload.from || ''
      toAddress = payload.to || ''
      subject = payload.subject || ''
      htmlBody = payload.html || ''
      textBody = payload.text || ''
      messageId = payload.messageId || payload.message_id || ''
      inReplyTo = payload.inReplyTo || payload.in_reply_to || ''
    }

    // Validate required fields
    if (!fromAddress || !toAddress) {
      console.error('❌ Missing required fields: from or to')
      return new Response(
        JSON.stringify({ error: 'Missing required fields: from, to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize to address (handle arrays)
    const toArray = Array.isArray(toAddress) ? toAddress : [toAddress]
    const toAddressString = toArray.join(', ')

    // Find matching mailbox(es)
    const { data: mailboxes, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('is_active', true)
      .in('email_address', toArray)

    if (mailboxError) {
      console.error('❌ Error fetching mailboxes:', mailboxError)
      return new Response(
        JSON.stringify({ error: 'Failed to find mailbox' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!mailboxes || mailboxes.length === 0) {
      console.warn('⚠️ No active mailbox found for:', toArray)
      // Still save the email but without mailbox_id
    }

    // Generate thread_id from subject or in_reply_to
    let threadId: string | null = null
    if (inReplyTo) {
      // Try to find the original email's thread_id
      const { data: originalEmail } = await supabaseClient
        .from('emails')
        .select('thread_id, id')
        .eq('message_id', inReplyTo)
        .single()
      
      if (originalEmail?.thread_id) {
        threadId = originalEmail.thread_id
      } else {
        // Use the original email's ID as thread_id
        threadId = originalEmail?.id || null
      }
    }

    if (!threadId) {
      // Generate thread_id from subject (remove Re:, Fwd:, etc.)
      const cleanSubject = subject.replace(/^(Re:|Fwd?:|RE:|FWD?:)\s*/i, '').trim()
      threadId = cleanSubject.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50)
    }

    // Save email to database (for each matching mailbox)
    const savedEmails = []
    for (const mailbox of mailboxes || []) {
      const { data: savedEmail, error: saveError } = await supabaseClient
        .from('emails')
        .insert({
          mailbox_id: mailbox.id,
          direction: 'inbound',
          from_address: fromAddress,
          to_address: toAddressString,
          subject: subject,
          html_body: htmlBody,
          text_body: textBody,
          message_id: messageId,
          in_reply_to: inReplyTo,
          thread_id: threadId,
          status: 'delivered',
          received_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) {
        console.error(`❌ Error saving email to mailbox ${mailbox.email_address}:`, saveError)
      } else {
        savedEmails.push(savedEmail)
        console.log(`✅ Email saved to mailbox ${mailbox.email_address}`)
      }
    }

    // If no mailbox matched, still save without mailbox_id (for logging)
    if (!mailboxes || mailboxes.length === 0) {
      const { data: savedEmail, error: saveError } = await supabaseClient
        .from('emails')
        .insert({
          direction: 'inbound',
          from_address: fromAddress,
          to_address: toAddressString,
          subject: subject,
          html_body: htmlBody,
          text_body: textBody,
          message_id: messageId,
          in_reply_to: inReplyTo,
          thread_id: threadId,
          status: 'delivered',
          received_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) {
        console.error('❌ Error saving email without mailbox:', saveError)
      } else {
        savedEmails.push(savedEmail)
        console.log('✅ Email saved without mailbox (for logging)')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email received and stored',
        emailsSaved: savedEmails.length,
        emailIds: savedEmails.map(e => e.id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Inbound email error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

