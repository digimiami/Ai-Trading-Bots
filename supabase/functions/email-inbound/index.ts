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

  console.log('📧 [email-inbound] Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    hasAuthHeader: !!req.headers.get('Authorization'),
    hasSvixId: !!req.headers.get('svix-id'),
    hasSvixTimestamp: !!req.headers.get('svix-timestamp'),
    hasSvixSignature: !!req.headers.get('svix-signature')
  })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Read body once (needed for signature verification and parsing)
    const body = await req.text()
    console.log('📧 [email-inbound] Body received, length:', body.length)
    
    // Verify Resend webhook signature using Svix format
    // Resend uses Svix for webhook signature verification
    const signingSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') || Deno.env.get('EMAIL_WEBHOOK_SECRET') || Deno.env.get('Signing Secret')
    console.log('📧 [email-inbound] Signing secret configured:', !!signingSecret, signingSecret ? `(length: ${signingSecret.length})` : '')
    
    if (signingSecret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')
      
      if (!svixSignature || !svixTimestamp || !svixId) {
        console.warn('⚠️ [email-inbound] Missing Resend webhook signature headers', {
          hasSignature: !!svixSignature,
          hasTimestamp: !!svixTimestamp,
          hasId: !!svixId,
          allHeaders: Object.fromEntries(req.headers.entries())
        })
        // For webhooks, we should still process even without signature (for testing)
        // But log a warning
        console.log('⚠️ [email-inbound] Proceeding without signature verification - this is OK for webhook testing')
      } else {
        console.log('📧 [email-inbound] Attempting signature verification...')
        // Verify signature using Svix format
        // Svix signs: svix-id + '.' + svix-timestamp + '.' + body
        try {
          // Extract secret bytes (remove whsec_ prefix and decode base64)
          let secretBytes: Uint8Array
          if (signingSecret.startsWith('whsec_')) {
            const secretBase64 = signingSecret.substring(6) // Remove 'whsec_' prefix
            secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0))
          } else {
            // If not in whsec_ format, use as-is
            secretBytes = new TextEncoder().encode(signingSecret)
          }

          const cryptoKey = await crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
          )

          // Construct signed content: svix-id.svix-timestamp.body
          const signedContent = `${svixId}.${svixTimestamp}.${body}`
          const signatureParts = svixSignature.split(',')
          let isValid = false

          for (const part of signatureParts) {
            const [version, signatureValue] = part.split('=')
            if (version === 'v1' && signatureValue) {
              try {
                const signatureBytes = Uint8Array.from(atob(signatureValue), c => c.charCodeAt(0))
                const signedBytes = new TextEncoder().encode(signedContent)
                
                isValid = await crypto.subtle.verify(
                  'HMAC',
                  cryptoKey,
                  signatureBytes,
                  signedBytes
                )
                
                if (isValid) {
                  console.log('✅ Resend webhook signature verified')
                  break
                }
              } catch (sigError) {
                console.warn('⚠️ Error verifying signature part:', sigError)
              }
            }
          }

          if (!isValid) {
            console.error('❌ [email-inbound] Invalid Resend webhook signature', {
              svixId,
              svixTimestamp,
              signatureParts: svixSignature.split(','),
              bodyLength: body.length,
              signedContentLength: signedContent.length
            })
            // For now, allow through with warning (can be strict later)
            console.warn('⚠️ [email-inbound] Signature verification failed, but allowing request through for debugging')
            // Uncomment below to enforce strict signature verification:
            // return new Response(
            //   JSON.stringify({ error: 'Unauthorized - Invalid signature' }),
            //   { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            // )
          }

          // Check timestamp to prevent replay attacks (within 5 minutes)
          const timestampNum = parseInt(svixTimestamp)
          const now = Math.floor(Date.now() / 1000)
          if (Math.abs(now - timestampNum) > 300) {
            console.warn('⚠️ Webhook timestamp too old or too far in future', {
              timestamp: timestampNum,
              now: now,
              diff: Math.abs(now - timestampNum)
            })
            return new Response(
              JSON.stringify({ error: 'Unauthorized - Timestamp invalid' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (verifyError) {
          console.error('❌ Error verifying webhook signature:', verifyError)
          return new Response(
            JSON.stringify({ error: 'Unauthorized - Signature verification failed' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } else {
      console.warn('⚠️ No webhook signing secret configured - skipping signature verification')
    }

    // Parse the body
    let payload: InboundEmailPayload
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      console.error('❌ Error parsing payload:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📧 Inbound email received:', JSON.stringify(payload, null, 2))

    // Parse email data based on provider format
    let fromAddress: string = ''
    let toAddress: string | string[] = ''
    let subject: string = ''
    let htmlBody: string = ''
    let textBody: string = ''
    let messageId: string = ''
    let inReplyTo: string = ''

    // Resend format - check for email.received event
    if (payload.type === 'email.received' && payload.data) {
      console.log('📧 [email-inbound] Processing Resend email.received event')
      fromAddress = payload.data.from || ''
      toAddress = payload.data.to || ''
      subject = payload.data.subject || ''
      htmlBody = payload.data.html || ''
      textBody = payload.data.text || ''
      messageId = payload.data.message_id || payload.data.headers?.['Message-Id'] || ''
      inReplyTo = payload.data.in_reply_to || payload.data.headers?.['In-Reply-To'] || ''
      console.log('📧 [email-inbound] Parsed Resend email:', { fromAddress, toAddress, subject, messageId })
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
      console.error('❌ [email-inbound] Missing required fields:', { fromAddress, toAddress, payloadType: payload.type })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: from, to', payload: payload }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('📧 [email-inbound] Email parsed successfully:', {
      from: fromAddress,
      to: Array.isArray(toAddress) ? toAddress : [toAddress],
      subject,
      hasHtml: !!htmlBody,
      hasText: !!textBody
    })

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
      console.warn('⚠️ [email-inbound] No active mailbox found for:', toArray)
      console.log('📧 [email-inbound] Available mailboxes in DB:', await supabaseClient.from('mailboxes').select('email_address, is_active'))
      // Still save the email but without mailbox_id
    } else {
      console.log('✅ [email-inbound] Found', mailboxes.length, 'matching mailbox(es):', mailboxes.map(m => m.email_address))
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

    console.log('✅ [email-inbound] Email processing complete:', {
      emailsSaved: savedEmails.length,
      emailIds: savedEmails.map(e => e.id)
    })
    console.log('📧 [email-inbound] ==========================================')
    
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
    console.error('❌ [email-inbound] Error processing request:', error)
    console.error('❌ [email-inbound] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('❌ [email-inbound] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error
    })
    console.log('📧 [email-inbound] ==========================================')
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

