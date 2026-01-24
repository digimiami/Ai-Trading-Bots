import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Simple encryption/decryption (same as api-keys function)
function decrypt(encryptedText: string): string {
  return atob(encryptedText) // Base64 decoding
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
    paper_trade_notifications?: boolean;
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
    position_open: '📈',
    position_close: '📉',
    bot_started: '🚀',
    bot_stopped: '🛑',
    error_occurred: '❌',
    daily_summary: '📊',
    profit_alert: '🎉',
    loss_alert: '⚠️'
  };

  const icon = emoji[type as keyof typeof emoji] || '📢';
  
  // Format balance information - ALWAYS show balance (even if 0 or failed)
  let balanceText = 'N/A';
  if (data.account_balance !== undefined && data.account_balance !== null) {
    const balanceValue = typeof data.account_balance === 'number' 
      ? data.account_balance 
      : parseFloat(data.account_balance || '0');
    balanceText = `$${balanceValue.toFixed(2)}`;
  } else if (data.balance_fetch_error) {
    balanceText = 'Error fetching';
  }
  const balanceSection = `\n💵 Available Balance: ${balanceText}`;

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

    case 'position_open':
      const openAmount = data.amount || data.quantity || 'N/A';
      return `${icon} <b>Position Opened</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Symbol: ${data.symbol}\n` +
             `Side: ${data.side.toUpperCase()}\n` +
             `Entry Price: $${(data.entry_price || data.price || 0).toFixed(2)}\n` +
             `Amount: ${openAmount}\n` +
             `${data.leverage ? `Leverage: ${data.leverage}x\n` : ''}` +
             `${data.order_id ? `Order ID: ${data.order_id}\n` : ''}` +
             balanceSection;

    case 'position_close':
      const pnlEmoji = data.pnl >= 0 ? '✅' : '❌';
      const pnlSign = data.pnl >= 0 ? '+' : '';
      const amount = data.amount || data.quantity || 'N/A';
      return `${icon} <b>Position Closed</b>\n\n` +
             `Bot: ${data.bot_name}\n` +
             `Symbol: ${data.symbol}\n` +
             `Side: ${data.side.toUpperCase()}\n` +
             `Entry Price: $${(data.entry_price || data.price || 0).toFixed(2)}\n` +
             `Exit Price: $${(data.exit_price || 0).toFixed(2)}\n` +
             `Amount: ${amount}\n` +
             `${pnlEmoji} P&L: ${pnlSign}$${Math.abs(data.pnl || 0).toFixed(2)}\n` +
             `${data.close_reason ? `Reason: ${data.close_reason}\n` : ''}` +
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
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    try {
      return new Response(null, { 
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        }
      })
    } catch (error) {
      console.error(`❌ Error in OPTIONS handler:`, error);
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      })
    }
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    )

    // Try to get user from session (for manual calls)
    let user: any = null;
    let userResult: any = null;
    
    if (authHeader) {
      try {
        userResult = await supabaseClient.auth.getUser();
        user = userResult.data?.user || null;
        if (userResult.error) {
          console.error('❌ Auth error:', userResult.error.message);
        }
      } catch (authError: any) {
        // Auth might fail for cron jobs using service role key - that's OK, we'll handle it below
        console.log('⚠️ Auth check failed (may be cron job), will check body for user_id...', authError?.message);
      }
    } else {
      console.log('⚠️ No Authorization header provided, will check body for user_id...');
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
          .maybeSingle()

        if (error) {
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

        // Default notification settings - all enabled by default
        const defaultNotifications = {
          trade_executed: true,
          bot_started: true,
          bot_stopped: true,
          error_occurred: true,
          daily_summary: true,
          profit_alert: true,
          loss_alert: true
        };

        // Merge user's notification preferences with defaults
        // If user provides notifications, use them; otherwise use defaults
        const finalNotifications = notifications 
          ? { ...defaultNotifications, ...notifications }
          : defaultNotifications;

        const { data: config, error } = await supabaseClient
          .from('telegram_config')
          .upsert({
            user_id: user.id,
            bot_token: bot_token,
            chat_id: chat_id,
            enabled: enabled !== undefined ? enabled : true,
            notifications: finalNotifications,
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
          .maybeSingle()

        if (configError) {
          console.error('❌ Telegram config query error:', configError);
          throw new Error(`Telegram not configured: ${configError.message || 'Failed to fetch config'}`)
        }

        if (!config) {
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
          .maybeSingle()

        if (configError) {
          console.error('❌ Telegram config query error:', configError);
          throw new Error(`Telegram not configured: ${configError.message || 'Failed to fetch config'}`)
        }
        
        if (!config) {
          console.warn('⚠️ No Telegram config found for user_id:', user.id);
          // For cron jobs/automated notifications, gracefully skip instead of throwing error
          return new Response(
            JSON.stringify({ 
              success: false, 
              skipped: true,
              message: 'Telegram not configured. Notification skipped.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log(`✅ Telegram config found for user_id: ${user.id}, enabled: ${config.enabled}`);
        console.log(`📋 Notification preferences:`, JSON.stringify(config.notifications, null, 2));
        console.log(`🔔 Checking notification type: ${notification_type}`);

        // Check if Telegram is enabled
        if (!config.enabled) {
          console.log(`⚠️ Telegram notifications are disabled for user ${user.id}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              skipped: true,
              message: 'Telegram notifications are disabled'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if this specific notification type is enabled
        // Default to true if not explicitly set to false (backward compatibility)
        const notifications = config.notifications || {};
        const isNotificationTypeEnabled = notifications[notification_type as keyof typeof notifications];
        
        // If explicitly set to false, skip. Otherwise, allow (true or undefined = enabled by default)
        if (isNotificationTypeEnabled === false) {
          console.log(`⚠️ Notification type ${notification_type} is explicitly disabled for user ${user.id}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              skipped: true,
              message: `Notification type ${notification_type} is disabled`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`✅ Notification type ${notification_type} is enabled, proceeding to send...`);

        // ALWAYS fetch account balance for ALL notification types
        let accountBalance: number | null = null;
        let balanceFetchError: string | null = null;
        try {
          console.log(`🔍 Fetching balance for notification type: ${notification_type}, user_id: ${user.id}`);
          
          // First, check if balance was passed in notification data (preferred - bot-executor fetches it)
          if (notificationData.account_balance !== undefined && notificationData.account_balance !== null) {
            accountBalance = typeof notificationData.account_balance === 'number' 
              ? notificationData.account_balance 
              : parseFloat(notificationData.account_balance || '0');
            console.log(`✅ Account balance from notification data: $${accountBalance.toFixed(2)}`);
          } else {
            console.log(`⚠️ Balance not in notification data, fetching from exchange...`);
            // Fetch balance ourselves for ALL notification types
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
            } else {
              // For real trading, fetch balance from exchange API
              // Get exchange info from notification data or try to get from user's API keys
              const exchange = notificationData.exchange || 'bybit';
              const tradingType = notificationData.trading_type || notificationData.tradingType || 'futures';
              
              // Get API keys for the user
              const { data: apiKeys, error: apiKeysError } = await queryClient
                .from('api_keys')
                .select('*')
                .eq('user_id', user.id)
                .eq('exchange', exchange)
                .eq('is_testnet', false)
                .eq('is_active', true)
                .limit(1)
                .single();
              
              if (!apiKeysError && apiKeys) {
                // CRITICAL: Decrypt API keys before using them (same as api-keys function)
                let decryptedApiKey: string;
                let decryptedApiSecret: string;
                try {
                  decryptedApiKey = decrypt(apiKeys.api_key);
                  decryptedApiSecret = decrypt(apiKeys.api_secret);
                  console.log(`🔑 API keys decrypted successfully for user ${user.id}`);
                } catch (decryptError: any) {
                  console.error(`❌ Failed to decrypt API keys:`, decryptError);
                  balanceFetchError = `Failed to decrypt API keys: ${decryptError?.message || decryptError}`;
                  throw decryptError;
                }
                
                if (exchange === 'bitunix') {
                  // Bitunix balance fetching
                  const marketType = tradingType === 'futures' || tradingType === 'linear' ? 'futures' : 'spot';
                  const baseUrls = marketType === 'futures'
                    ? ['https://fapi.bitunix.com']
                    : ['https://api.bitunix.com'];
                  
                  const timestamp = Date.now().toString();
                  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  
                  // Bitunix signature function (double SHA256)
                  const createBitunixSignature = async (nonce: string, timestamp: string, apiKey: string, queryParams: string, body: string, secretKey: string): Promise<string> => {
                    const encoder = new TextEncoder();
                    // digest = SHA256(nonce + timestamp + api-key + queryParams + body)
                    const digestPayload = nonce + timestamp + apiKey + queryParams + body;
                    const digestData = encoder.encode(digestPayload);
                    const digestHash = await crypto.subtle.digest('SHA-256', digestData);
                    // sign = SHA256(digest + secretKey)
                    const signPayload = Array.from(new Uint8Array(digestHash)).map(b => b.toString(16).padStart(2, '0')).join('') + secretKey;
                    const signData = encoder.encode(signPayload);
                    const signHash = await crypto.subtle.digest('SHA-256', signData);
                    return Array.from(new Uint8Array(signHash)).map(b => b.toString(16).padStart(2, '0')).join('');
                  };
                  
                  // Try account balance endpoints
                  const endpointsToTry = marketType === 'futures'
                    ? [
                        { path: '/api/v1/futures/account', params: 'marginCoin=USDT' },
                        { path: '/api/v1/account', params: '' },
                        { path: '/api/v1/account/balance', params: '' },
                      ]
                    : [
                        { path: '/api/v1/spot/account', params: '' },
                        { path: '/api/v1/account', params: '' },
                        { path: '/api/v1/account/balance', params: '' },
                      ];
                  
                  let balanceFetched = false;
                  for (const baseUrl of baseUrls) {
                    for (const endpoint of endpointsToTry) {
                      try {
                        const queryParams = endpoint.params;
                        const body = '';
                        const signature = await createBitunixSignature(nonce, timestamp, decryptedApiKey, queryParams, body, decryptedApiSecret);
                        
                        const url = queryParams ? `${baseUrl}${endpoint.path}?${queryParams}` : `${baseUrl}${endpoint.path}`;
                        const response = await fetch(url, {
                          method: 'GET',
                          headers: {
                            'api-key': decryptedApiKey,
                            'nonce': nonce,
                            'timestamp': timestamp,
                            'sign': signature,
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          if (data && data.code === 0) {
                            const responseData = data.data || {};
                            let assets: any[] = [];
                            
                            if (Array.isArray(responseData)) {
                              assets = responseData;
                            } else if (responseData.assets) {
                              assets = responseData.assets;
                            } else if (responseData.balances) {
                              assets = responseData.balances;
                            } else if (responseData.coin || responseData.balance !== undefined) {
                              assets = [responseData];
                            }
                            
                            // Calculate total balance
                            if (marketType === 'futures') {
                              // For futures, sum total equity
                              let totalEquity = 0;
                              for (const asset of assets) {
                                const equity = parseFloat(
                                  asset.totalEquity ||
                                  asset.equity ||
                                  asset.balance ||
                                  asset.total ||
                                  '0'
                                );
                                totalEquity += equity;
                              }
                              accountBalance = totalEquity;
                              console.log(`✅ Bitunix Futures balance: $${accountBalance.toFixed(2)}`);
                            } else {
                              // For spot, find USDT balance
                              const usdtAsset = assets.find((a: any) => {
                                const assetSymbol = (a.asset || a.coin || a.currency || '').toUpperCase();
                                return assetSymbol === 'USDT';
                              });
                              accountBalance = usdtAsset ? parseFloat(
                                usdtAsset.available ||
                                usdtAsset.free ||
                                usdtAsset.balance ||
                                '0'
                              ) : 0;
                              console.log(`✅ Bitunix Spot balance: $${accountBalance.toFixed(2)}`);
                            }
                            balanceFetched = true;
                            break;
                          }
                        }
                      } catch (err: any) {
                        console.warn(`⚠️ Bitunix balance fetch error for ${baseUrl}${endpoint.path}:`, err.message);
                        continue;
                      }
                    }
                    if (balanceFetched) break;
                  }
                  
                  if (!balanceFetched) {
                    balanceFetchError = 'Failed to fetch Bitunix balance from all endpoints';
                    console.warn(`⚠️ ${balanceFetchError}`);
                  }
                } else {
                  // Bybit balance fetching (existing code)
                  // Use the SAME method as api-keys function (which works correctly for dashboard)
                  const baseUrl = apiKeys.is_testnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
                  
                  const timestamp = Date.now().toString();
                  const recvWindow = '5000';
                  
                  // Create signature using the SAME method as api-keys function
                  const createSignature = async (payload: string, secret: string): Promise<string> => {
                    const encoder = new TextEncoder();
                    const keyData = encoder.encode(secret);
                    const messageData = encoder.encode(payload);
                    const cryptoKey = await crypto.subtle.importKey(
                      'raw',
                      keyData,
                      { name: 'HMAC', hash: 'SHA-256' },
                      false,
                      ['sign']
                    );
                    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
                    const hashArray = Array.from(new Uint8Array(signature));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                  };
                  
                  // Use UNIFIED account type (same as dashboard)
                  const params = {
                    api_key: decryptedApiKey, // Use DECRYPTED key
                    accountType: 'UNIFIED',
                    recv_window: recvWindow,
                    timestamp: timestamp
                  };
                  
                  // Sort parameters alphabetically (same as api-keys)
                  const sortedParams = Object.keys(params)
                    .sort()
                    .map(key => `${key}=${params[key]}`)
                    .join('&');
                  
                  // Create signature string (same as api-keys)
                  const signatureString = timestamp + decryptedApiKey + recvWindow + sortedParams; // Use DECRYPTED key
                  const signature = await createSignature(signatureString, decryptedApiSecret); // Use DECRYPTED secret
                  
                  const finalUrl = `${baseUrl}/v5/account/wallet-balance?${sortedParams}`;
                  
                  try {
                    console.log(`🔍 Fetching balance from: ${finalUrl}`);
                    const response = await fetch(finalUrl, {
                      method: 'GET',
                      headers: {
                        'X-BAPI-API-KEY': decryptedApiKey, // Use DECRYPTED key
                        'X-BAPI-SIGN': signature,
                        'X-BAPI-TIMESTAMP': timestamp,
                        'X-BAPI-RECV-WINDOW': recvWindow,
                        'Content-Type': 'application/json',
                      }
                    });
                    
                    if (!response.ok) {
                      const errorText = await response.text();
                      console.error(`❌ Bybit API HTTP Error: ${response.status}`, errorText);
                      balanceFetchError = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
                    } else {
                      const data = await response.json();
                      console.log(`📊 Bybit API Response:`, JSON.stringify(data, null, 2));
                      
                      if (data.retCode !== 0) {
                        console.error(`❌ Bybit API Error: ${data.retCode} - ${data.retMsg}`);
                        balanceFetchError = `API Error ${data.retCode}: ${data.retMsg}`;
                      } else if (data.result?.list?.[0]) {
                        const account = data.result.list[0];
                        console.log(`📊 Account data:`, JSON.stringify(account, null, 2));
                        
                        // Use totalWalletBalance (same as dashboard) - this is what shows $784.02
                        if (account.totalWalletBalance && parseFloat(account.totalWalletBalance) > 0) {
                          accountBalance = parseFloat(account.totalWalletBalance);
                          console.log(`✅ Found available balance: $${accountBalance.toFixed(2)}`);
                        } else {
                          // Fallback: calculate from coins
                          const coins = account.coin || [];
                          let calculatedBalance = 0;
                          for (const coin of coins) {
                            const free = parseFloat(coin.free || '0');
                            calculatedBalance += free;
                          }
                          if (calculatedBalance > 0) {
                            accountBalance = calculatedBalance;
                            console.log(`✅ Calculated balance from coins: $${accountBalance.toFixed(2)}`);
                          } else {
                            console.warn(`⚠️ No balance found in account data`);
                            balanceFetchError = 'No balance data in account';
                          }
                        }
                      } else {
                        console.warn(`⚠️ No account data in response`);
                        balanceFetchError = 'No account data found';
                      }
                    }
                  } catch (fetchError: any) {
                    console.error(`❌ Failed to fetch balance:`, fetchError);
                    balanceFetchError = fetchError?.message || String(fetchError);
                  }
                }
              } else {
                balanceFetchError = `No active API keys found for user ${user.id} on exchange ${exchange}`;
                console.warn(`⚠️ ${balanceFetchError}`);
              }
            }
          }
        } catch (balanceError: any) {
          balanceFetchError = balanceError?.message || String(balanceError);
          console.error('❌ Failed to fetch account balance for notification:', balanceFetchError);
          // Don't fail the notification if balance fetch fails, but log the error
        }

        // ALWAYS add balance to notification data (even if null/0/error)
        // This ensures balance section always appears in the message
        const notificationDataWithBalance = {
          ...notificationData,
          account_balance: accountBalance !== null ? accountBalance : 0, // Default to 0 if null
          balance_fetch_error: balanceFetchError || null
        };
        
        console.log(`📊 Final balance for notification: ${accountBalance !== null ? `$${accountBalance.toFixed(2)}` : 'null'}, error: ${balanceFetchError || 'none'}`);

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

