import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailNotificationData {
  type: string;
  subject: string;
  message: string;
  data?: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'send';

    if (action === 'send') {
      const body: EmailNotificationData = await req.json();
      const { type, subject, message, data } = body;

      if (!type || !subject || !message) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: type, subject, message' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's email notification preferences
      const { data: settings, error: settingsError } = await supabaseClient
        .from('user_settings')
        .select('notification_preferences')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching user settings:', settingsError);
      }

      const emailPrefs = settings?.notification_preferences?.email || {};
      
      // Check if email notifications are enabled
      if (!emailPrefs.enabled) {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'Email notifications disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this specific notification type is enabled
      const notificationKey = type.toLowerCase().replace(/_/g, '_');
      if (emailPrefs[notificationKey as keyof typeof emailPrefs] === false) {
        return new Response(
          JSON.stringify({ skipped: true, reason: `Notification type ${type} is disabled` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's email from auth.users
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.admin.getUserById(user.id);
      
      if (authError || !authUser?.email) {
        return new Response(
          JSON.stringify({ error: 'User email not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send email using Resend API (or your preferred email service)
      // For now, we'll log it and store it in a notifications table
      // You can integrate with Resend, SendGrid, or Supabase's email service
      
      const emailResult = await sendEmail({
        to: authUser.email,
        subject: subject,
        html: formatEmailHTML(subject, message, data),
        text: message,
      });

      // Store notification in database
      const { error: insertError } = await supabaseClient
        .from('email_notifications')
        .insert({
          user_id: user.id,
          type: type,
          subject: subject,
          message: message,
          data: data || {},
          status: emailResult.success ? 'sent' : 'failed',
          sent_at: emailResult.success ? new Date().toISOString() : null,
          error: emailResult.error || null,
        });

      if (insertError) {
        console.error('Error storing email notification:', insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: emailResult.success, 
          message: emailResult.success ? 'Email sent successfully' : 'Failed to send email',
          error: emailResult.error 
        }),
        { status: emailResult.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'test') {
      // Send a test email
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.admin.getUserById(user.id);
      
      if (authError || !authUser?.email) {
        return new Response(
          JSON.stringify({ error: 'User email not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const testSubject = 'Test Email Notification - Pablo Trading';
      const testMessage = 'This is a test email to verify your email notification settings are working correctly.';

      const emailResult = await sendEmail({
        to: authUser.email,
        subject: testSubject,
        html: formatEmailHTML(testSubject, testMessage),
        text: testMessage,
      });

      return new Response(
        JSON.stringify({ 
          success: emailResult.success, 
          message: emailResult.success ? 'Test email sent successfully!' : 'Failed to send test email',
          error: emailResult.error 
        }),
        { status: emailResult.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in email-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<{ success: boolean; error?: string }> {
  // Option 1: Use Resend API (recommended)
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'Pablo Trading <notifications@pablobots.net>',
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }
  }

  // Option 2: Use Supabase's built-in email (if configured)
  // This would require Supabase Auth email to be configured
  // For now, we'll just log it
  console.log('📧 Email would be sent:', {
    to: params.to,
    subject: params.subject,
    html: params.html.substring(0, 100) + '...',
  });

  // In production, you should integrate with a real email service
  // For now, return success but log that it's not actually sent
  return { success: false, error: 'Email service not configured. Please set RESEND_API_KEY environment variable.' };
}

function formatEmailHTML(subject: string, message: string, data?: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Pablo Trading</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #4b5563;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        ${data ? `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">Details:</h3>
            <pre style="background: #f3f4f6; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; color: #4b5563;">${JSON.stringify(data, null, 2)}</pre>
          </div>
        ` : ''}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">This is an automated email from Pablo Trading Platform.</p>
          <p style="margin: 5px 0 0 0;">You can manage your email preferences in your account settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

