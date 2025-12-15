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

          // First, get the trade to fetch entry details
          const { data: existingTrade, error: fetchError } = await supabaseClient
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .eq('user_id', user.id)
            .single()

          if (fetchError || !existingTrade) {
            throw new Error('Trade not found')
          }

          // Fetch current market price
          let exitPrice = 0
          try {
            const tradingType = existingTrade.trading_type || 'spot'
            const exchange = existingTrade.exchange || 'bybit'
            const symbol = existingTrade.symbol

            if (exchange === 'bybit') {
              const categoryMap: { [key: string]: string } = {
                'spot': 'spot',
                'futures': 'linear',
                'linear': 'linear',
                'inverse': 'inverse'
              }
              const bybitCategory = categoryMap[tradingType] || 'spot'
              
              const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=${bybitCategory}&symbol=${symbol}`)
              const data = await response.json()
              
              if (data.retCode === 0 && data.result?.list?.length > 0) {
                exitPrice = parseFloat(data.result.list[0].lastPrice || '0')
              }
            } else if (exchange === 'okx') {
              const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`)
              const data = await response.json()
              
              if (data.code === '0' && data.data?.length > 0) {
                exitPrice = parseFloat(data.data[0].last || '0')
              }
            }
          } catch (priceError) {
            console.error('Error fetching exit price:', priceError)
            // Continue with pnl calculation even if price fetch fails
            // We'll use entry price as fallback (resulting in 0 pnl)
            exitPrice = parseFloat(existingTrade.entry_price || existingTrade.price || '0')
          }

          // Get entry price and size from trade (handle both field name variations)
          const entryPrice = parseFloat(existingTrade.entry_price || existingTrade.price || '0')
          const size = parseFloat(existingTrade.size || existingTrade.amount || '0')
          const side = existingTrade.side || 'long'
          const fee = parseFloat(existingTrade.fee || '0')

          // Calculate PnL based on side
          let pnl = 0
          if (entryPrice > 0 && exitPrice > 0 && size > 0) {
            if (side.toLowerCase() === 'long') {
              // Long: profit = (exit_price - entry_price) * size - fees
              pnl = (exitPrice - entryPrice) * size - fee
            } else {
              // Short: profit = (entry_price - exit_price) * size - fees
              pnl = (entryPrice - exitPrice) * size - fee
            }
          }

          // Update trade with exit price, PnL, and status
          const { data: trade, error } = await supabaseClient
            .from('trades')
            .update({ 
              status: 'closed',
              exit_price: exitPrice,
              pnl: parseFloat(pnl.toFixed(2)),
              closed_at: new Date().toISOString(),
              close_reason: reason,
              updated_at: new Date().toISOString()
            })
            .eq('id', tradeId)
            .eq('user_id', user.id)
            .select()
            .single()

          if (error) throw error

          // Get bot information for notification
          const { data: bot } = await supabaseClient
            .from('trading_bots')
            .select('*')
            .eq('id', trade.bot_id)
            .single()

          // Fetch account balance for notification (simplified - will show N/A if fetch fails)
          let accountBalance: number | null = null;
          try {
            // Get API keys for the bot
            const { data: apiKeys } = await supabaseClient
              .from('api_keys')
              .select('*')
              .eq('user_id', user.id)
              .eq('exchange', trade.exchange || 'bybit')
              .eq('is_testnet', false)
              .eq('is_active', true)
              .single();
            
            if (apiKeys) {
              const tradingType = bot?.trading_type || 'futures';
              const categoryMap: { [key: string]: string } = {
                'spot': 'spot',
                'futures': 'linear'
              };
              const bybitCategory = categoryMap[tradingType] || 'linear';
              
              // Fetch balance from Bybit API
              const timestamp = Date.now().toString();
              const recvWindow = '5000';
              
              // Create signature using Web Crypto API
              const queryParams = bybitCategory === 'linear' 
                ? `accountType=UNIFIED`
                : `accountType=SPOT&coin=USDT`;
              const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
              
              const encoder = new TextEncoder();
              const keyData = encoder.encode(apiKeys.api_secret);
              const messageData = encoder.encode(signaturePayload);
              const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
              );
              const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
              const signatureHex = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
              
              const response = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${queryParams}`, {
                method: 'GET',
                headers: {
                  'X-BAPI-API-KEY': apiKeys.api_key,
                  'X-BAPI-TIMESTAMP': timestamp,
                  'X-BAPI-RECV-WINDOW': recvWindow,
                  'X-BAPI-SIGN': signatureHex,
                },
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.retCode === 0 && data.result?.list?.[0]) {
                  if (bybitCategory === 'linear') {
                    const accountInfo = data.result.list[0];
                    accountBalance = parseFloat(
                      accountInfo.totalAvailableBalance || 
                      accountInfo.totalEquity || 
                      accountInfo.totalWalletBalance || 
                      '0'
                    );
                  } else {
                    const wallet = data.result.list[0].coin?.[0];
                    if (wallet) {
                      accountBalance = parseFloat(
                        wallet.availableToWithdraw || 
                        wallet.availableBalance || 
                        wallet.walletBalance || 
                        '0'
                      );
                    }
                  }
                }
              }
            }
          } catch (balanceError) {
            console.warn('⚠️ Failed to fetch balance for notification:', balanceError);
            // Continue without balance - notification will show N/A
          }

          // Send Telegram notification for position close
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
            const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
            
            if (supabaseUrl && supabaseAnonKey && bot) {
              await fetch(`${supabaseUrl}/functions/v1/telegram-notifier?action=send`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                  notification_type: 'position_close',
                  data: {
                    bot_name: bot.name || 'Unknown Bot',
                    symbol: trade.symbol,
                    side: trade.side,
                    entry_price: trade.entry_price || trade.price,
                    exit_price: exitPrice,
                    amount: trade.amount || trade.size,
                    quantity: trade.amount || trade.size,
                    pnl: pnl,
                    close_reason: reason,
                    user_id: user.id,
                    paper_trading: false,
                    exchange: trade.exchange || 'bybit',
                    trading_type: bot.trading_type || 'futures',
                    account_balance: accountBalance
                  }
                })
              });
            }
          } catch (notifError) {
            console.warn('⚠️ Failed to send position close notification:', notifError);
            // Don't fail position closure if notification fails
          }

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