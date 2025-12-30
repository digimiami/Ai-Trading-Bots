import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const adminNotificationUrl = `${supabaseUrl}/functions/v1/admin-notifications`;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending notifications
    const { data: pendingNotifications, error: fetchError } = await supabaseClient
      .from('admin_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending notifications' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${pendingNotifications.length} pending admin notifications`);

    const results = [];

    for (const notification of pendingNotifications) {
      try {
        // Call admin-notifications function
        const response = await fetch(adminNotificationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            type: notification.type,
            data: notification.data
          })
        });

        if (response.ok) {
          // Mark as processed
          await supabaseClient
            .from('admin_notification_queue')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          results.push({ id: notification.id, status: 'success' });
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send notification');
        }
      } catch (err: any) {
        console.error(`Failed to process notification ${notification.id}:`, err);
        // Mark as failed
        await supabaseClient
          .from('admin_notification_queue')
          .update({
            status: 'failed',
            error_message: err.message
          })
          .eq('id', notification.id);
        results.push({ id: notification.id, status: 'failed', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in process-admin-notifications function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

