import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RiskSettings {
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxOpenPositions: number;
  riskPerTrade: number;
  autoStopTrading: boolean;
  emergencyStopLoss: number;
}

interface AlertSettings {
  newTradeAlert: boolean;
  closePositionAlert: boolean;
  profitAlert: boolean;
  profitThreshold: number;
  lossAlert: boolean;
  lossThreshold: number;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  liquidationAlert: boolean;
  liquidationThreshold: number;
  dailyPnlAlert: boolean;
  weeklyPnlAlert: boolean;
  monthlyPnlAlert: boolean;
  emailAlerts: boolean;
  pushAlerts: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const method = req.method
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (method) {
      case 'GET':
        if (action === 'check-risk') {
          // Check current risk exposure
          const { data: positions } = await supabaseClient
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'open')

          const { data: todayTrades } = await supabaseClient
            .from('trades')
            .select('pnl')
            .eq('user_id', user.id)
            .gte('created_at', new Date().toISOString().split('T')[0])

          const dailyPnL = todayTrades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0
          const openPositions = positions?.length || 0
          const totalExposure = positions?.reduce((sum, pos) => sum + pos.size, 0) || 0

          return new Response(JSON.stringify({
            dailyPnL,
            openPositions,
            totalExposure,
            riskLevel: dailyPnL < -500 ? 'high' : dailyPnL < -200 ? 'medium' : 'low'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'settings') {
          const { data: settings } = await supabaseClient
            .from('user_settings')
            .select('risk_settings, alert_settings')
            .eq('user_id', user.id)
            .single()

          return new Response(JSON.stringify({ settings }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'POST':
        if (action === 'update-settings') {
          const body = await req.json()
          const { riskSettings, alertSettings } = body

          const { data, error } = await supabaseClient
            .from('user_settings')
            .upsert({
              user_id: user.id,
              risk_settings: riskSettings,
              alert_settings: alertSettings,
              updated_at: new Date().toISOString()
            })
            .select()

          if (error) throw error

          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'check-position') {
          const body = await req.json()
          const { symbol, size, leverage } = body

          // Get user's risk settings
          const { data: settings } = await supabaseClient
            .from('user_settings')
            .select('risk_settings')
            .eq('user_id', user.id)
            .single()

          const riskSettings: RiskSettings = settings?.risk_settings || {
            maxPositionSize: 1000,
            maxOpenPositions: 5,
            riskPerTrade: 2
          }

          // Check current positions
          const { data: positions } = await supabaseClient
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'open')

          const openPositions = positions?.length || 0
          const positionValue = size * leverage

          const checks = {
            positionSizeOk: positionValue <= riskSettings.maxPositionSize,
            maxPositionsOk: openPositions < riskSettings.maxOpenPositions,
            riskPerTradeOk: (positionValue * riskSettings.riskPerTrade / 100) <= 100, // Example calculation
            approved: true
          }

          checks.approved = checks.positionSizeOk && checks.maxPositionsOk && checks.riskPerTradeOk

          return new Response(JSON.stringify({ checks }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'send-alert') {
          const body = await req.json()
          const { type, message, data } = body

          // Get user's alert settings
          const { data: settings } = await supabaseClient
            .from('user_settings')
            .select('alert_settings')
            .eq('user_id', user.id)
            .single()

          const alertSettings: AlertSettings = settings?.alert_settings || {}

          // Check if this alert type is enabled
          const alertEnabled = alertSettings[type as keyof AlertSettings]
          
          if (!alertEnabled) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Alert disabled' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Store alert in database
          await supabaseClient
            .from('alerts')
            .insert({
              user_id: user.id,
              type,
              message,
              data,
              created_at: new Date().toISOString()
            })

          // Send notification based on user preferences
          if (alertSettings.emailAlerts) {
            // Send email notification (implement your email service)
            console.log(`Email alert: ${message}`)
          }

          if (alertSettings.pushAlerts) {
            // Send push notification (implement your push service)
            console.log(`Push alert: ${message}`)
          }

          return new Response(JSON.stringify({ success: true, sent: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'emergency-stop') {
          // Emergency stop all trading
          const { data: bots } = await supabaseClient
            .from('trading_bots')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')

          if (bots && bots.length > 0) {
            await supabaseClient
              .from('trading_bots')
              .update({ status: 'stopped', stopped_reason: 'Emergency stop triggered' })
              .eq('user_id', user.id)
              .eq('status', 'active')

            // Log the emergency stop
            await supabaseClient
              .from('admin_logs')
              .insert({
                user_id: user.id,
                action: 'emergency_stop',
                details: `Stopped ${bots.length} active bots`,
                created_at: new Date().toISOString()
              })
          }

          return new Response(JSON.stringify({ 
            success: true, 
            message: `Emergency stop executed. ${bots?.length || 0} bots stopped.` 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'PUT':
        if (action === 'close-position') {
          const body = await req.json()
          const { tradeId, reason } = body

          const { data: trade, error } = await supabaseClient
            .from('trades')
            .update({ 
              status: 'closed',
              closed_at: new Date().toISOString(),
              close_reason: reason
            })
            .eq('id', tradeId)
            .eq('user_id', user.id)
            .select()
            .single()

          if (error) throw error

          // Send close position alert if enabled
          await supabaseClient.functions.invoke('risk-management', {
            body: {
              action: 'send-alert',
              type: 'closePositionAlert',
              message: `Position closed: ${trade.symbol} - ${reason}`,
              data: trade
            }
          })

          return new Response(JSON.stringify({ success: true, trade }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})