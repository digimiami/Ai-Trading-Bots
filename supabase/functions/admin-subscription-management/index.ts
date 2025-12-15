/**
 * Admin Subscription Management Edge Function
 * Allows admins to upgrade/downgrade user subscriptions
 * Sends email and in-app message notifications to users
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

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
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { subscriptionId, newPlanId } = body

    if (!subscriptionId || !newPlanId) {
      return new Response(
        JSON.stringify({ error: 'subscriptionId and newPlanId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch current subscription with plan and user details
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans!user_subscriptions_plan_id_fkey(*),
        users!user_subscriptions_user_id_fkey(email)
      `)
      .eq('id', subscriptionId)
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch new plan details
    const { data: newPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .single()

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const currentPlan = subscription.subscription_plans
    const currentPlanId = subscription.plan_id

    // Check if plan is actually changing
    if (currentPlanId === newPlanId) {
      return new Response(
        JSON.stringify({ error: 'User is already on this plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate expiration - preserve remaining time or set to 30 days from now
    let expiresAt = new Date()
    if (subscription.expires_at && new Date(subscription.expires_at) > new Date()) {
      // Keep existing expiration date
      expiresAt = new Date(subscription.expires_at)
    } else {
      // Set to 30 days from now
      expiresAt.setDate(expiresAt.getDate() + 30)
    }

    // Update subscription
    const { data: updatedSubscription, error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        plan_id: newPlanId,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)
      .select(`
        *,
        subscription_plans!user_subscriptions_plan_id_fkey(*),
        users!user_subscriptions_user_id_fkey(email)
      `)
      .single()

    if (updateError) {
      console.error('Error updating subscription:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine if upgrade or downgrade
    const isUpgrade = (newPlan.price_monthly_usd || 0) > (currentPlan?.price_monthly_usd || 0)
    const action = isUpgrade ? 'upgraded' : 'downgraded'

    // Send email and message notifications
    await sendSubscriptionChangeEmail(supabaseClient, updatedSubscription, currentPlan, newPlan, action)
    await sendSubscriptionChangeMessage(supabaseClient, updatedSubscription, currentPlan, newPlan, action)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Subscription ${action} successfully`,
        subscription: updatedSubscription
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in admin subscription management:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Send email notification when subscription changes
 */
async function sendSubscriptionChangeEmail(
  supabaseClient: any,
  subscription: any,
  oldPlan: any,
  newPlan: any,
  action: 'upgraded' | 'downgraded'
) {
  try {
    const user = subscription.users
    if (!user?.email) {
      console.warn('No user email found for subscription change notification')
      return
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://pablobots.com'
    const emailSubject = action === 'upgraded'
      ? '🎉 Subscription Upgraded - Pablo Trading Bots'
      : '📉 Subscription Changed - Pablo Trading Bots'

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">${action === 'upgraded' ? '🎉 Subscription Upgraded!' : '📉 Subscription Changed'}</h2>
        <p>Your subscription has been ${action} by an administrator.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Previous Plan:</strong> ${oldPlan?.display_name || 'Unknown'}</p>
          <p style="margin: 5px 0;"><strong>New Plan:</strong> ${newPlan.display_name}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
          <p style="margin: 5px 0;"><strong>Expires:</strong> ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}</p>
          <p style="margin: 5px 0;"><strong>Max Bots:</strong> ${newPlan.max_bots === null ? 'Unlimited' : newPlan.max_bots}</p>
        </div>

        <div style="margin: 30px 0;">
          <a href="${siteUrl}/bots" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Your Bots</a>
        </div>
        
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          If you have any questions about this change, please contact our support team.
        </p>
      </div>
    `

    // Use Resend API
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Pablo Trading Bots <noreply@pablobots.com>',
          to: user.email,
          subject: emailSubject,
          html: emailBody
        })
      })

      if (emailResponse.ok) {
        console.log(`✅ Email sent to ${user.email} for subscription ${action}`)
      } else {
        const errorText = await emailResponse.text()
        console.error(`❌ Failed to send email:`, errorText)
      }
    } else {
      console.log(`ℹ️ Email notification (${action}) for ${user.email} - Resend API key not configured`)
    }
  } catch (error) {
    console.error('Error sending subscription change email:', error)
  }
}

/**
 * Send in-app message notification when subscription changes
 */
async function sendSubscriptionChangeMessage(
  supabaseClient: any,
  subscription: any,
  oldPlan: any,
  newPlan: any,
  action: 'upgraded' | 'downgraded'
) {
  try {
    const siteUrl = Deno.env.get('SITE_URL') || 'https://pablobots.com'

    // Try to find an admin user to send from (system messages)
    const { data: adminUsers } = await supabaseClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    const senderId = adminUsers && adminUsers.length > 0 ? adminUsers[0].id : subscription.user_id

    const subject = action === 'upgraded'
      ? '🎉 Subscription Upgraded!'
      : '📉 Subscription Changed'

    const body = `Your subscription has been ${action} by an administrator.

Previous Plan: ${oldPlan?.display_name || 'Unknown'}
New Plan: ${newPlan.display_name}
Status: Active
Expires: ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}
Max Bots: ${newPlan.max_bots === null ? 'Unlimited' : newPlan.max_bots}

You can now create up to ${newPlan.max_bots === null ? 'unlimited' : newPlan.max_bots} trading bots. Start creating your bots here: ${siteUrl}/bots

If you have any questions about this change, please contact our support team.`

    // Send message to user's inbox
    const { error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        sender_id: senderId,
        recipient_id: subscription.user_id,
        subject: subject,
        body: body,
        is_read: false
      })

    if (messageError) {
      console.error(`❌ Failed to send in-app message:`, messageError)
    } else {
      console.log(`✅ In-app message sent to user ${subscription.user_id} for subscription ${action}`)
    }
  } catch (error) {
    console.error('Error sending subscription change message:', error)
  }
}
