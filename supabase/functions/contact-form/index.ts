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

    // Optional: Send email notification to admin
    // You can add email sending logic here using your email service
    // For example: await sendEmailNotification(data)

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

