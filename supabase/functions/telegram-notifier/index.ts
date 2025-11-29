import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  notifications: {
    trade_executed?: boolean;
    bot_started?: boolean;
    bot_stopped?: boolean;
    error_occurred?: boolean;
    daily_summary?: boolean;
    profit_alert?: boolean;
    loss_alert?: boolean;
  };
}

async function sendTelegramMessage(botToken: string, chatId: string, message: string, parseMode: string = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true
    })
  });

  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
  }
  
  return result;
}

function formatNotificationMessage(type: string, data: any): string {
  const emoji = {
    trade_executed: '💰',
    bot_started: '🚀',
    bot_stopped: '🛑',
    error_occurred: '❌',
    daily_summary: '📊',
    profit_alert: '🎉',
    loss_alert: '⚠️'
  };

  const icon = emoji[type as keyof typeof emoji] || '📢';
  
  // Format balance information if available
  const balanceSection = data.account_balance !== undefined && data.account_balance !== null
    ? `\n💵 Available Balance: $${typeof data.account_balance === 'number' ? data.account_balance.toFixed(2) : parseFloat(data.account_balance || '0').toFixed(2)}`
    : '';

  switch (type) {
    case 'trade_executed':
      return `${icon} <b>Trade Executed</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Symbol: ${data.symbol}\n` +
             `Side: ${data.side.toUpperCase()}\n` +
             `Price: $${data.price}\n` +
             `Amount: ${data.amount}\n` +
             `${data.order_id ? `Order ID: ${data.order_id}\n` : ''}` +
             balanceSection;

    case 'bot_started':
      return `${icon} <b>Bot Started</b>\n\n` +
             `${data.bot_name} is now running\n` +
             `Symbol: ${data.symbol}\n` +
             `Exchange: ${data.exchange.toUpperCase()}` +
             balanceSection;

    case 'bot_stopped':
      return `${icon} <b>Bot Stopped</b>\n\n` +
             `${data.bot_name} has been stopped\n` +
             `Symbol: ${data.symbol}\n` +
             `Reason: ${data.reason || 'Manual stop'}` +
             balanceSection;

    case 'error_occurred':
      return `${icon} <b>Error Alert</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Error: ${data.error_message}\n` +
             `${data.details ? `Details: ${data.details}\n` : ''}` +
             balanceSection;

    case 'profit_alert':
      return `${icon} <b>Profit Alert!</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Profit: $${data.profit}\n` +
             `Win Rate: ${data.win_rate}%\n` +
             `Total P&L: $${data.total_pnl}` +
             balanceSection;

    case 'loss_alert':
      return `${icon} <b>Loss Alert</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Loss: $${data.loss}\n` +
             `Action: ${data.action || 'Review bot settings'}` +
             balanceSection;

    case 'daily_summary':
      return `${icon} <b>Daily Summary</b>\n\n` +
             `Total Trades: ${data.total_trades}\n` +
             `Win Rate: ${data.win_rate}%\n` +
             `Total P&L: ${data.total_pnl >= 0 ? '+' : ''}$${data.total_pnl}\n` +
             `Active Bots: ${data.active_bots}\n` +
             `Best Performer: ${data.best_bot}` +
             balanceSection;

    default:
      return `${icon} <b>Notification</b>\n\n${data.message || 'No message provided'}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Try to get user from session (for manual calls)
    let user: any = null;
    let userResult: any = null;
    
    try {
      userResult = await supabaseClient.auth.getUser();
      user = userResult.data?.user || null;
    } catch (authError) {
      // Auth might fail for cron jobs using service role key - that's OK, we'll handle it below
      console.log('⚠️ Auth check failed (may be cron job), will check body for user_id...');
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'send'
    
    // If no user from session and this is a POST with 'send' action, check body for user_id
    // (This is for cron jobs that don't have user sessions)
    // Store bodyText in outer scope so POST handler can access it
    let bodyText: string | null = null;
    if (!user && action === 'send' && req.method === 'POST') {
      try {
        // Read body once and store it - we'll reuse it in POST handler below
        bodyText = await req.text();
        const body = JSON.parse(bodyText);
        const userId = body.data?.user_id || null;
        
        if (userId) {
          user = { id: userId }; // Create minimal user object for cron jobs
          console.log('✅ Using user_id from body for cron job:', userId);
        }
      } catch (bodyError) {
        console.warn('⚠️ Could not read user_id from body:', bodyError);
      }
    }
    
    // For non-send actions or if still no user, require authenticated session
    if (!user && action !== 'send') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user && action === 'send') {
      return new Response(
        JSON.stringify({ error: 'No user found. Please provide user_id in request body or use authenticated session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET') {
      if (action === 'get_config') {
        const { data: config, error } = await supabaseClient
          .from('telegram_config')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        return new Response(
          JSON.stringify({ success: true, config: config || null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_logs') {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const { data: logs, error } = await supabaseClient
          .from('notification_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, logs: logs || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      // Body might have been read above for user_id extraction
      // If req.body was consumed, recreate it from the stored bodyText
      let body: any;
      if (bodyText) {
        // Body was already consumed above, parse from stored text
        body = JSON.parse(bodyText);
      } else {
        // Body not consumed yet, read it normally
        body = await req.json();
      }

      if (action === 'save_config') {
        const { bot_token, chat_id, enabled, notifications } = body

        if (!bot_token || !chat_id) {
          throw new Error('bot_token and chat_id are required')
        }

        const { data: config, error } = await supabaseClient
          .from('telegram_config')
          .upsert({
            user_id: user.id,
            bot_token: bot_token,
            chat_id: chat_id,
            enabled: enabled !== undefined ? enabled : true,
            notifications: notifications || {
              trade_executed: true,
              bot_started: true,
              bot_stopped: true,
              error_occurred: true,
              daily_summary: true,
              profit_alert: true,
              loss_alert: true
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            success: true, 
            config: config,
            message: 'Telegram configuration saved successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'test') {
        // Get user's Telegram config
        const { data: config, error: configError } = await supabaseClient
          .from('telegram_config')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (configError || !config) {
          throw new Error('Telegram not configured. Please add your bot token and chat ID.')
        }

        // Send test message
        const testMessage = '🤖 <b>Pablo Trading Bot - Test Message</b>\n\n' +
                          '✅ Your Telegram notifications are working!\n\n' +
                          'You will receive alerts for:\n' +
                          '• Trade executions\n' +
                          '• Bot status changes\n' +
                          '• Errors and warnings\n' +
                          '• Daily summaries';

        const telegramResult = await sendTelegramMessage(
          config.bot_token,
          config.chat_id,
          testMessage
        );

        // Log the test notification
        await supabaseClient
          .from('notification_logs')
          .insert({
            user_id: user.id,
            notification_type: 'test',
            message: testMessage,
            telegram_response: telegramResult,
            status: 'sent',
            sent_at: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Test notification sent successfully!',
            telegram_response: telegramResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'send') {
        const { notification_type, data: notificationData } = body

        if (!notification_type) {
          throw new Error('notification_type is required')
        }

        // For cron jobs (service role auth), we need to use a service role client to bypass RLS
        // If user was extracted from body (cron job), use service role client to bypass RLS
        const isServiceRole = !userResult?.data?.user && user?.id && bodyText !== null;
        const queryClient = isServiceRole 
          ? createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
          : supabaseClient;

        console.log(`🔍 Looking up Telegram config for user_id: ${user.id}`);
        
        // Get user's Telegram config
        const { data: config, error: configError } = await queryClient
          .from('telegram_config')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (configError) {
          console.error('❌ Telegram config query error:', configError);
          throw new Error(`Telegram not configured: ${configError.message || 'No config found for this user'}`)
        }
        
        if (!config) {
          console.warn('⚠️ No Telegram config found for user_id:', user.id);
          throw new Error('Telegram not configured. Please configure Telegram in Settings → Notifications.')
        }
        
        console.log(`✅ Telegram config found for user_id: ${user.id}, enabled: ${config.enabled}`);

        // Check if this notification type is enabled
        if (!config.enabled || !(config.notifications as any)[notification_type]) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Notification type ${notification_type} is disabled`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch account balance for the user
        let accountBalance: number | null = null;
        try {
          // Check if balance was passed in notification data (preferred - bot-executor fetches it)
          if (notificationData.account_balance !== undefined && notificationData.account_balance !== null) {
            accountBalance = typeof notificationData.account_balance === 'number' 
              ? notificationData.account_balance 
              : parseFloat(notificationData.account_balance || '0');
            console.log(`📊 Account balance from notification data: $${accountBalance.toFixed(2)}`);
          } else {
            // Fallback: fetch balance ourselves if not provided
            const isPaperTrading = notificationData.paper_trading || notificationData.is_paper_trading;
            
            if (isPaperTrading) {
              // Get paper trading account available balance
              const { data: paperAccount, error: paperError } = await queryClient
                .from('paper_trading_accounts')
                .select('balance')
                .eq('user_id', user.id)
                .single();
              
              if (!paperError && paperAccount && paperAccount.balance !== null && paperAccount.balance !== undefined) {
                accountBalance = parseFloat(paperAccount.balance || '0');
                console.log(`📊 Paper trading available balance: $${accountBalance.toFixed(2)}`);
              }
            }
            // For real trading, we rely on bot-executor to pass the balance
            // If not provided, we can't fetch it here without API keys
          }
        } catch (balanceError: any) {
          console.warn('⚠️ Failed to fetch account balance for notification:', balanceError?.message || balanceError);
          // Don't fail the notification if balance fetch fails
        }

        // Add balance to notification data if available
        const notificationDataWithBalance = {
          ...notificationData,
          account_balance: accountBalance
        };

        // Format and send message
        const message = formatNotificationMessage(notification_type, notificationDataWithBalance);
        
        const telegramResult = await sendTelegramMessage(
          config.bot_token,
          config.chat_id,
          message
        );

        // Log the notification
        await supabaseClient
          .from('notification_logs')
          .insert({
            user_id: user.id,
            notification_type: notification_type,
            message: message,
            telegram_response: telegramResult,
            status: 'sent',
            sent_at: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Notification sent successfully',
            telegram_response: telegramResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action or method' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Telegram notifier error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

