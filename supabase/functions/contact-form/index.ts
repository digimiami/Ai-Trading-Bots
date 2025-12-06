/**
 * Contact Form Edge Function
 * Handles contact form submissions and stores them in the database
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
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

    // Get user session if available (optional - form works for anonymous users too)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseClient.auth.getUser(token)
        userId = user?.id ?? null
      } catch (e) {
        // User not authenticated, that's okay - anonymous submissions allowed
        console.log('Anonymous contact form submission')
      }
    }

    // Parse request body
    const body: ContactFormData = await req.json()

    // Validate required fields
    if (!body.name || !body.email || !body.subject || !body.message) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        message: 'Please fill in all required fields: name, email, subject, and message'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Store contact message in database
    const { data, error } = await supabaseClient
      .from('contact_messages')
      .insert({
        user_id: userId,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        subject: body.subject.trim(),
        message: body.message.trim(),
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing contact message:', error)
      return new Response(JSON.stringify({ 
        error: 'Failed to save message',
        message: 'An error occurred while saving your message. Please try again later.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ Contact message saved: ${data.id} from ${body.email}`)

    // Send email notification to admin
    try {
      await sendAdminEmailNotification(data, body)
    } catch (emailError) {
      console.error('Failed to send admin email notification:', emailError)
      // Don't fail the request if email fails - message is already saved
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon!',
      id: data.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Contact form error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Send email notification to admin when a new contact message is received
 */
async function sendAdminEmailNotification(messageData: any, formData: ContactFormData): Promise<void> {
  // Get admin email from environment variable or use default
  const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'digimiami@gmail.com'
  
  // Use Resend API if available
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  
  if (resendApiKey) {
    try {
      const emailSubject = `New Contact Form Message: ${formData.subject}`
      const emailHtml = formatContactEmailHTML(formData, messageData)
      const emailText = formatContactEmailText(formData, messageData)

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'Pablo Trading <notifications@pablobots.net>',
          to: adminEmail,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          reply_to: formData.email, // Allow admin to reply directly
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send email')
      }

      console.log(`✅ Admin email notification sent to ${adminEmail}`)
      return
    } catch (error: any) {
      console.error('Resend API error:', error)
      throw error
    }
  }

  // Fallback: Log if email service not configured
  console.log('📧 Email notification would be sent to admin:', {
    to: adminEmail,
    subject: `New Contact Form Message: ${formData.subject}`,
    from: formData.email,
    messageId: messageData.id
  })
  console.warn('⚠️ Email service not configured. Set RESEND_API_KEY environment variable to enable email notifications.')
}

function formatContactEmailHTML(formData: ContactFormData, messageData: any): string {
  const userInfo = messageData.user_id 
    ? `<p><strong>User Account:</strong> Linked to user ID: ${messageData.user_id}</p>`
    : '<p><strong>User Account:</strong> Anonymous (not logged in)</p>'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Form Message</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Message</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">${formData.subject}</h2>
          
          <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${formData.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${formData.email}" style="color: #667eea;">${formData.email}</a></p>
            ${userInfo}
            <p style="margin: 5px 0;"><strong>Message ID:</strong> ${messageData.id}</p>
            <p style="margin: 5px 0;"><strong>Received:</strong> ${new Date(messageData.created_at).toLocaleString()}</p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">Message:</h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
              <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${formData.message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-radius: 5px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>💡 Quick Actions:</strong><br>
              • Reply directly to this email (reply-to: ${formData.email})<br>
              • View in Admin Panel: <a href="${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}/admin" style="color: #3b82f6;">Admin Panel → Contact Messages</a><br>
              • Message Status: ${messageData.status}
            </p>
          </div>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">This is an automated email from Pablo Trading Platform.</p>
          <p style="margin: 5px 0 0 0;">Contact form messages are stored in the database and can be managed from the Admin Panel.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function formatContactEmailText(formData: ContactFormData, messageData: any): string {
  return `
New Contact Form Message

Subject: ${formData.subject}

From: ${formData.name} <${formData.email}>
User Account: ${messageData.user_id ? `Linked (ID: ${messageData.user_id})` : 'Anonymous'}
Message ID: ${messageData.id}
Received: ${new Date(messageData.created_at).toLocaleString()}

Message:
${formData.message}

---
View in Admin Panel: ${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}/admin
Reply to: ${formData.email}
  `.trim()
}

