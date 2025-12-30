import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminNotificationData {
  type: 'new_user' | 'subscription_paid';
  data: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'digimiami@gmail.com';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://pablobots.com';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { type, data } = await req.json() as AdminNotificationData;

    let subject = '';
    let html = '';

    if (type === 'new_user') {
      subject = `🆕 New User Signup: ${data.email}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">New User Signup</h2>
          <p>A new user has just registered on Pablo Trading Platform.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${data.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Signup Date:</strong> ${new Date().toLocaleString()}</p>
            <p style="margin: 5px 0;"><strong>User ID:</strong> ${data.id}</p>
          </div>
          <div style="margin-top: 30px;">
            <a href="${siteUrl}/admin/users" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Admin Panel</a>
          </div>
        </div>
      `;
    } else if (type === 'subscription_paid') {
      const amount = data.amount ? `$${parseFloat(data.amount).toFixed(2)}` : 'N/A';
      subject = `💰 Subscription Paid: ${data.user_email} (${data.plan_name})`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #10b981; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Subscription Payment Received</h2>
          <p>A user has successfully paid for a subscription.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>User:</strong> ${data.user_email}</p>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${data.plan_name}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount}</p>
            <p style="margin: 5px 0;"><strong>Invoice ID:</strong> ${data.invoice_id || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="margin-top: 30px;">
            <a href="${siteUrl}/admin/subscriptions" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Subscriptions</a>
          </div>
        </div>
      `;
    } else {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Pablo Trading <notifications@pablobots.net>',
        to: adminEmail,
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Resend API error: ${errorData.message || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in admin-notifications function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

