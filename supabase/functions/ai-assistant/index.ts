import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    );

    // Verify user authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, conversationHistory = [], attachments = [], apiKey: userApiKey, provider: userProvider } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process attachments - extract text content if available
    let attachmentContext = '';
    if (attachments && attachments.length > 0) {
      attachmentContext = '\n\n## ATTACHED DOCUMENTS:\n';
      for (const att of attachments) {
        attachmentContext += `- **${att.name}** (${att.type || 'unknown type'})\n`;
        
        try {
          let fileContent: string | null = null;
          let fileBuffer: Uint8Array | null = null;
          
          // Check if attachment has a URL (from Supabase storage)
          if (att.url) {
            try {
              const fileResponse = await fetch(att.url);
              if (fileResponse.ok) {
                const arrayBuffer = await fileResponse.arrayBuffer();
                fileBuffer = new Uint8Array(arrayBuffer);
              }
            } catch (e) {
              console.warn(`Failed to fetch file from URL ${att.url}:`, e);
            }
          }
          // Check if attachment has base64 data
          else if (att.data) {
            try {
              const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
              const binaryString = atob(base64Data);
              fileBuffer = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                fileBuffer[i] = binaryString.charCodeAt(i);
              }
            } catch (e) {
              console.warn(`Failed to decode base64 data for ${att.name}:`, e);
            }
          }
          
          // Extract text content based on file type
          if (fileBuffer) {
            fileContent = await extractTextFromFile(att.name, att.type, fileBuffer);
          }
          
          if (fileContent) {
            // Limit content to avoid token limits (keep first 5000 chars for important files)
            const maxLength = 5000;
            const preview = fileContent.length > maxLength 
              ? fileContent.substring(0, maxLength) + `\n\n... [Content truncated. Total length: ${fileContent.length} characters]` 
              : fileContent;
            attachmentContext += `  **Content:**\n\`\`\`\n${preview}\n\`\`\`\n`;
          } else {
            attachmentContext += `  (File attached but content could not be extracted. Please describe the file contents in your message.)\n`;
          }
        } catch (e) {
          console.error(`Error processing attachment ${att.name}:`, e);
          attachmentContext += `  (Error processing file: ${e.message || 'Unknown error'})\n`;
        }
      }
    }

    // Get AI API keys: Priority: user-provided > environment variables
    const openaiApiKey = userProvider === 'openai' && userApiKey 
      ? userApiKey 
      : (Deno.env.get('OPENAI_API_KEY') || '');
    const deepseekApiKey = userProvider === 'deepseek' && userApiKey 
      ? userApiKey 
      : (Deno.env.get('DEEPSEEK_API_KEY') || '');

    // Determine which provider to use
    // Priority: user preference > DeepSeek (if available) > OpenAI
    let useDeepSeek = false;
    let apiKey = '';
    
    if (userProvider === 'deepseek' && deepseekApiKey) {
      useDeepSeek = true;
      apiKey = deepseekApiKey;
    } else if (userProvider === 'openai' && openaiApiKey) {
      useDeepSeek = false;
      apiKey = openaiApiKey;
    } else if (deepseekApiKey) {
      useDeepSeek = true;
      apiKey = deepseekApiKey;
    } else if (openaiApiKey) {
      useDeepSeek = false;
      apiKey = openaiApiKey;
    }

    const baseUrl = useDeepSeek ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const model = useDeepSeek ? 'deepseek-chat' : 'gpt-4o';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'AI API key not configured. Please configure OpenAI or DeepSeek API key in Settings → AI API Configuration, or set OPENAI_API_KEY or DEEPSEEK_API_KEY in Edge Function secrets.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for bot operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch user's bots for context
    const { data: userBots, error: botsError } = await supabaseServiceClient
      .from('trading_bots')
      .select('id, name, exchange, trading_type, symbol, timeframe, leverage, risk_level, trade_amount, stop_loss, take_profit, strategy, strategy_config, status, pnl, pnl_percentage, total_trades, win_rate, paper_trading')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const botsContext = botsError ? [] : (userBots || []);

    // Fetch user's settings for context
    const { data: userSettings, error: settingsError } = await supabaseServiceClient
      .from('user_settings')
      .select('notification_preferences, alert_settings, risk_settings')
      .eq('user_id', user.id)
      .single();

    const settingsContext = settingsError ? null : userSettings;

    // Build comprehensive knowledge base prompt
    const knowledgeBase = buildKnowledgeBase();

    // Build user's bots context
    const botsContextText = botsContext.length > 0
      ? `\n\n## USER'S CURRENT BOTS (${botsContext.length} total):\n` +
        botsContext.map((bot: any, idx: number) => {
          const strategy = typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy;
          const strategyConfig = bot.strategy_config ? (typeof bot.strategy_config === 'string' ? JSON.parse(bot.strategy_config) : bot.strategy_config) : null;
          return `${idx + 1}. **${bot.name}** (ID: ${bot.id})
   - Exchange: ${bot.exchange}, Type: ${bot.trading_type || 'spot'}
   - Symbol: ${bot.symbol}, Timeframe: ${bot.timeframe || '1h'}
   - Leverage: ${bot.leverage || 1}x, Risk: ${bot.risk_level || 'medium'}
   - Trade Amount: ${bot.trade_amount || 100} USDT
   - Stop Loss: ${bot.stop_loss || 2.0}%, Take Profit: ${bot.take_profit || 4.0}%
   - Strategy: ${JSON.stringify(strategy)}
   - Status: ${bot.status}
   - Performance: PnL ${bot.pnl || 0} USDT (${bot.pnl_percentage || 0}%), Win Rate: ${bot.win_rate || 0}%, Trades: ${bot.total_trades || 0}
   - Paper Trading: ${bot.paper_trading ? 'Yes' : 'No'}`;
        }).join('\n\n')
      : `\n\n## USER'S CURRENT BOTS: None (user has no bots yet)`;

    // Build user's settings context
    const settingsContextText = settingsContext
      ? `\n\n## USER'S CURRENT SETTINGS:\n` +
        `Notification Preferences: ${JSON.stringify(settingsContext.notification_preferences || {})}\n` +
        `Alert Settings: ${JSON.stringify(settingsContext.alert_settings || {})}\n` +
        `Risk Settings: ${JSON.stringify(settingsContext.risk_settings || {})}`
      : `\n\n## USER'S CURRENT SETTINGS: None (default settings will be used)`;

    // Define functions/tools for OpenAI function calling
    const functions = [
      {
        name: 'create_bot',
        description: 'MANDATORY: Create a new trading bot with specified configuration. YOU MUST CALL THIS FUNCTION whenever the user asks to create, add, set up, make, or start a new trading bot. Do not just explain how to create a bot - actually create it by calling this function. Required parameters: name (bot name), exchange (bybit/okx/bitunix/mexc), symbol (trading pair like BTCUSDT).',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Bot name (e.g., "BTCUSDT RSI Low Risk")'
            },
            exchange: {
              type: 'string',
              enum: ['bybit', 'okx', 'bitunix', 'mexc'],
              description: 'Exchange to trade on'
            },
            tradingType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Trading type'
            },
            symbol: {
              type: 'string',
              description: 'Trading pair symbol (e.g., BTCUSDT, ETHUSDT)'
            },
            timeframe: {
              type: 'string',
              enum: ['1m', '3m', '5m', '15m', '30m', '45m', '1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '12h', '1d', '1w', '1M'],
              description: 'Chart timeframe'
            },
            leverage: {
              type: 'number',
              description: 'Leverage (1-100x, only for futures, default: 1 for spot)'
            },
            riskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk level (affects default parameters)'
            },
            tradeAmount: {
              type: 'number',
              description: 'Trade amount in USDT (default: 100)'
            },
            stopLoss: {
              type: 'number',
              description: 'Stop loss percentage (default: 2.0 for low risk, 3.0 for medium, 4.0 for high)'
            },
            takeProfit: {
              type: 'number',
              description: 'Take profit percentage (default: 4.0 for low risk, 6.0 for medium, 8.0 for high)'
            },
            strategy: {
              type: 'object',
              description: 'Trading strategy configuration'
            },
            strategyConfig: {
              type: 'object',
              description: 'Advanced strategy configuration (optional)'
            },
            paperTrading: {
              type: 'boolean',
              description: 'Enable paper trading mode (default: true for safety)'
            }
          },
          required: ['name', 'exchange', 'symbol']
        }
      },
      {
        name: 'update_bot',
        description: 'Update an existing bot\'s configuration. Use this when user asks to modify, change, or optimize a bot.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot to update'
            },
            name: {
              type: 'string',
              description: 'New bot name'
            },
            stopLoss: {
              type: 'number',
              description: 'New stop loss percentage'
            },
            takeProfit: {
              type: 'number',
              description: 'New take profit percentage'
            },
            tradeAmount: {
              type: 'number',
              description: 'New trade amount in USDT'
            },
            leverage: {
              type: 'number',
              description: 'New leverage value'
            },
            riskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'New risk level'
            },
            strategy: {
              type: 'object',
              description: 'Updated strategy configuration'
            },
            strategyConfig: {
              type: 'object',
              description: 'Updated advanced strategy configuration'
            },
            paperTrading: {
              type: 'boolean',
              description: 'Paper trading mode'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'get_bot_performance',
        description: 'Get detailed performance metrics for a specific bot. Use this when user asks about bot performance, stats, or results.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot to analyze'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'update_user_settings',
        description: 'Update user settings including notification preferences, alert settings, or risk settings. Use this when user asks to change settings, enable/disable notifications, or modify preferences.',
        parameters: {
          type: 'object',
          properties: {
            notificationPreferences: {
              type: 'object',
              description: 'Notification preferences (email, push notifications)',
              properties: {
                email: {
                  type: 'object',
                  description: 'Email notification preferences',
                  properties: {
                    enabled: { type: 'boolean' },
                    trade_executed: { type: 'boolean' },
                    bot_started: { type: 'boolean' },
                    bot_stopped: { type: 'boolean' },
                    error_occurred: { type: 'boolean' },
                    daily_summary: { type: 'boolean' },
                    profit_alert: { type: 'boolean' },
                    loss_alert: { type: 'boolean' },
                    position_opened: { type: 'boolean' },
                    position_closed: { type: 'boolean' },
                    stop_loss_triggered: { type: 'boolean' },
                    take_profit_triggered: { type: 'boolean' }
                  }
                },
                push: {
                  type: 'object',
                  description: 'Push notification preferences',
                  properties: {
                    enabled: { type: 'boolean' },
                    trade_executed: { type: 'boolean' },
                    bot_started: { type: 'boolean' },
                    bot_stopped: { type: 'boolean' },
                    error_occurred: { type: 'boolean' }
                  }
                }
              }
            },
            alertSettings: {
              type: 'object',
              description: 'Alert settings (profit thresholds, loss thresholds, etc.)'
            },
            riskSettings: {
              type: 'object',
              description: 'Risk management settings (max daily loss, position size, etc.)'
            }
          }
        }
      },
      {
        name: 'check_bot_positions',
        description: 'Check open positions for a bot on the exchange. Use this when user asks about positions, open trades, current holdings, or what positions are open.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot to check positions for'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'close_bot_position',
        description: 'Close an open position for a bot on the exchange. Use this when user asks to close a position, exit a trade, or manually close a trade.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot whose position should be closed'
            },
            tradeId: {
              type: 'string',
              description: 'ID of the specific trade/position to close (optional, will close all open positions for bot if not provided)'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'get_bot_logs',
        description: 'Get detailed activity logs for a bot. Use this when user asks about bot logs, execution history, what the bot has been doing, or recent bot activity.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot to get logs for'
            },
            limit: {
              type: 'number',
              description: 'Number of logs to retrieve (default: 50, max: 200)'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'check_exchange_balance',
        description: 'Check the current balance on an exchange for a bot. Use this when user asks about balance, available funds, account status, or how much money is available.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'ID of the bot to check balance for'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'get_market_data',
        description: 'Get real-time market data (price, RSI, ADX) for a trading pair. Use this when user asks about current price, market conditions, or technical indicators.',
        parameters: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Trading pair symbol (e.g., BTCUSDT, ETHUSDT)'
            },
            exchange: {
              type: 'string',
              enum: ['bybit', 'okx', 'bitunix', 'mexc'],
              description: 'Exchange to get data from (default: bybit)'
            },
            tradingType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Trading type (default: futures)'
            }
          },
          required: ['symbol']
        }
      }
    ];

    // Helper function to estimate tokens (rough estimate: ~0.75 tokens per character for English)
    function estimateTokens(text: string): number {
      return Math.ceil(text.length * 0.75);
    }

    // Helper function to truncate text to fit within token limit
    function truncateText(text: string, maxTokens: number): string {
      const maxChars = Math.floor(maxTokens / 0.75);
      if (text.length <= maxChars) return text;
      return text.substring(0, maxChars - 100) + '... [truncated]';
    }

    // Limit conversation history to prevent token overflow
    // Keep only the most recent messages, truncating if necessary
    const MAX_CONVERSATION_HISTORY_MESSAGES = 5; // Reduced from 10
    const MAX_MESSAGE_LENGTH = 2000; // Max characters per message in history
    
    let limitedHistory = conversationHistory
      .slice(-MAX_CONVERSATION_HISTORY_MESSAGES)
      .map((msg: any) => {
        const content = msg.content || '';
        const truncatedContent = content.length > MAX_MESSAGE_LENGTH 
          ? content.substring(0, MAX_MESSAGE_LENGTH) + '... [truncated]'
          : content;
        return {
          role: msg.role,
          content: truncatedContent
        };
      });

    // Limit bots context - only include essential info for first 10 bots
    const MAX_BOTS_IN_CONTEXT = 10;
    let limitedBotsContext = botsContextText;
    if (botsContext.length > MAX_BOTS_IN_CONTEXT) {
      const limitedBots = botsContext.slice(0, MAX_BOTS_IN_CONTEXT);
      limitedBotsContext = `\n\n## USER'S CURRENT BOTS (${botsContext.length} total, showing first ${MAX_BOTS_IN_CONTEXT}):\n` +
        limitedBots.map((bot: any, idx: number) => {
          const strategy = typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy;
          // Simplify strategy representation
          const strategyStr = typeof strategy === 'object' ? JSON.stringify(strategy).substring(0, 200) : String(strategy);
          return `${idx + 1}. **${bot.name}** (ID: ${bot.id})
   - Exchange: ${bot.exchange}, Symbol: ${bot.symbol}, Timeframe: ${bot.timeframe || '1h'}
   - Leverage: ${bot.leverage || 1}x, Risk: ${bot.risk_level || 'medium'}
   - Trade Amount: ${bot.trade_amount || 100} USDT
   - Stop Loss: ${bot.stop_loss || 2.0}%, Take Profit: ${bot.take_profit || 4.0}%
   - Strategy: ${strategyStr.substring(0, 150)}...
   - Status: ${bot.status}, PnL: ${bot.pnl || 0} USDT, Win Rate: ${bot.win_rate || 0}%`;
        }).join('\n\n');
    }

    // Build system message with truncated knowledge base if needed
    const systemMessageBase = `You are an expert AI Trading Assistant for the Pablo AI Trading Platform. Your role is to help users understand bot settings, trading strategies, risk management, and platform features.

IMPORTANT GUIDELINES:
1. Be helpful, clear, and concise
2. Use examples when explaining complex concepts
3. If asked about a specific setting, explain what it does, recommended values, and how it affects trading
4. For trading questions, provide educational and accurate information
5. Always prioritize risk management in your advice
6. If you don't know something, admit it rather than guessing
7. Format your responses in a readable way with bullet points, code blocks, or numbered lists when appropriate
8. Never provide financial advice that could be considered as investment recommendations
9. When user asks to create or modify bots, use the available functions to perform the actions
10. Always suggest paper trading mode for new bots unless user explicitly requests live trading
11. When creating bots, use sensible defaults based on risk level (low risk = conservative, high risk = aggressive)
12. Reference user's existing bots when making recommendations to avoid duplicates or conflicts
13. When user asks to change settings, enable/disable notifications, or modify preferences, use the update_user_settings function
14. Always preserve existing settings when updating - only modify the specific fields the user requests
15. **CRITICAL - Backtesting**: When users ask about backtesting, guide them to navigate to the `/backtest` page. You CANNOT run backtests directly - you can only explain how to use the backtesting feature and what settings to test. Never try to execute code, call functions, or reference variables related to backtesting that don't exist in the available functions. Simply explain the process and guide users to the backtest page.
16. **Navigation Guidance**: When users need to access features like backtesting, provide clear instructions on how to navigate to those pages (e.g., "Navigate to the Backtest page at /backtest") but do not try to navigate for them programmatically.`;

    // Estimate tokens for the full system message
    const MAX_CONTEXT_TOKENS = 120000; // Leave some buffer below 128K limit
    const MAX_FUNCTIONS_TOKENS = 1000; // Reserve for function definitions
    const MAX_MESSAGES_TOKENS = MAX_CONTEXT_TOKENS - MAX_FUNCTIONS_TOKENS;
    
    // Build initial system message
    let systemMessage = `${systemMessageBase}\n\n${knowledgeBase}\n${limitedBotsContext}`;
    
    // Estimate tokens for all messages
    let estimatedTokens = estimateTokens(systemMessage);
    for (const msg of limitedHistory) {
      estimatedTokens += estimateTokens(JSON.stringify(msg));
    }
    estimatedTokens += estimateTokens(message + attachmentContext);
    estimatedTokens += MAX_FUNCTIONS_TOKENS; // Add function tokens estimate

    // If we're over the limit, truncate knowledge base
    if (estimatedTokens > MAX_CONTEXT_TOKENS) {
      const excessTokens = estimatedTokens - MAX_CONTEXT_TOKENS;
      const excessChars = Math.floor(excessTokens / 0.75);
      const currentKnowledgeBaseLength = knowledgeBase.length;
      const targetKnowledgeBaseLength = Math.max(5000, currentKnowledgeBaseLength - excessChars - 1000); // Keep at least 5K chars
      
      if (targetKnowledgeBaseLength < currentKnowledgeBaseLength) {
        console.warn(`⚠️ Token limit approaching. Truncating knowledge base from ${currentKnowledgeBaseLength} to ${targetKnowledgeBaseLength} chars`);
        const truncatedKnowledgeBase = knowledgeBase.substring(0, targetKnowledgeBaseLength) + '\n\n[Knowledge base truncated due to token limits. Core information retained.]';
        systemMessage = `${systemMessageBase}\n\n${truncatedKnowledgeBase}\n${limitedBotsContext}`;
      }
    }

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: systemMessage
      },
      ...limitedHistory,
      {
        role: 'user',
        content: message + attachmentContext
      }
    ];

    // Final token check - log warning if still high
    const finalEstimatedTokens = estimateTokens(JSON.stringify(messages)) + MAX_FUNCTIONS_TOKENS;
    if (finalEstimatedTokens > 100000) {
      console.warn(`⚠️ High token count detected: ~${Math.round(finalEstimatedTokens/1000)}K tokens. Model limit: 128K`);
    }

    // Call AI API with function calling support
    let aiResponse = '';
    let finalResponse = '';
    let actions: any[] = [];

    // DeepSeek may not support function calling, so only use it for OpenAI
    const supportsFunctionCalling = !useDeepSeek;

    // First AI call - may request function calls (only for OpenAI)
    let response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(supportsFunctionCalling ? {
          tools: functions.map(f => ({ type: 'function', function: f })),
          tool_choice: 'auto',
        } : {}),
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API error:', response.status, errorData);
      
      // Provide helpful error message for token limit errors
      if (errorData.error?.message?.includes('maximum context length') || errorData.error?.message?.includes('tokens')) {
        const errorMsg = errorData.error.message || 'Token limit exceeded';
        console.error(`❌ Token limit error. Estimated tokens: ~${Math.round(finalEstimatedTokens/1000)}K`);
        throw new Error(`AI API error: ${response.status} - ${errorMsg}. The conversation or context is too long. Please try a shorter message or start a new conversation.`);
      }
      
      throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    let data = await response.json();
    const aiMessage = data.choices[0]?.message;
    aiResponse = aiMessage?.content || '';
    const toolCalls = supportsFunctionCalling ? (aiMessage?.tool_calls || []) : [];
    
    console.log('🔧 [AI Assistant] AI response:', aiResponse?.substring(0, 200));
    console.log('🔧 [AI Assistant] Tool calls requested:', toolCalls.length);
    if (toolCalls.length === 0 && supportsFunctionCalling) {
      console.warn('⚠️ [AI Assistant] No tool calls made by AI despite function calling being enabled');
      console.warn('⚠️ [AI Assistant] This may mean the AI did not recognize the request as requiring a function call');
      console.warn('⚠️ [AI Assistant] Check if user message contains bot creation keywords');
    }

    // Execute function calls if any (only for OpenAI)
    if (supportsFunctionCalling && toolCalls.length > 0) {
      console.log(`🔧 [AI Assistant] AI requested ${toolCalls.length} function call(s):`, toolCalls.map(tc => tc.function.name).join(', '));
      
      const toolResults: any[] = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        console.log(`📞 Executing function: ${functionName}`, functionArgs);
        
        try {
          let result: any;
          
          if (functionName === 'create_bot') {
            result = await executeCreateBot(supabaseServiceClient, user.id, functionArgs);
            actions.push({ type: 'create_bot', result });
          } else if (functionName === 'update_bot') {
            result = await executeUpdateBot(supabaseServiceClient, user.id, functionArgs);
            actions.push({ type: 'update_bot', result });
          } else if (functionName === 'get_bot_performance') {
            result = await executeGetBotPerformance(supabaseServiceClient, user.id, functionArgs.botId);
            actions.push({ type: 'get_bot_performance', result });
          } else if (functionName === 'update_user_settings') {
            result = await executeUpdateUserSettings(supabaseServiceClient, user.id, functionArgs);
            actions.push({ type: 'update_user_settings', result });
          } else if (functionName === 'check_bot_positions') {
            result = await executeCheckBotPositions(supabaseServiceClient, user.id, functionArgs.botId);
            actions.push({ type: 'check_bot_positions', result });
          } else if (functionName === 'close_bot_position') {
            result = await executeCloseBotPosition(supabaseServiceClient, user.id, functionArgs);
            actions.push({ type: 'close_bot_position', result });
          } else if (functionName === 'get_bot_logs') {
            result = await executeGetBotLogs(supabaseServiceClient, user.id, functionArgs.botId, functionArgs.limit);
            actions.push({ type: 'get_bot_logs', result });
          } else if (functionName === 'check_exchange_balance') {
            result = await executeCheckExchangeBalance(supabaseServiceClient, user.id, functionArgs.botId);
            actions.push({ type: 'check_exchange_balance', result });
          } else if (functionName === 'get_market_data') {
            result = await executeGetMarketData(functionArgs.symbol, functionArgs.exchange, functionArgs.tradingType);
            actions.push({ type: 'get_market_data', result });
          } else {
            result = { success: false, error: `Unknown function: ${functionName}` };
          }
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(result)
          });
        } catch (error: any) {
          console.error(`❌ Error executing ${functionName}:`, error);
          console.error(`❌ Error stack:`, error.stack);
          const errorResult = { 
            success: false,
            error: error.message || 'Function execution failed',
            details: error.stack || error.toString()
          };
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(errorResult)
          });
          // Also add to actions for frontend display
          actions.push({ type: functionName, result: errorResult });
        }
      }
      
      // Second AI call with function results
      messages.push({
        role: 'assistant',
        content: aiResponse,
        tool_calls: toolCalls
      });
      
      messages.push(...toolResults);
      
      // Check token count before second API call and truncate if needed
      let secondCallEstimatedTokens = estimateTokens(JSON.stringify(messages));
      if (secondCallEstimatedTokens > MAX_CONTEXT_TOKENS) {
        console.warn(`⚠️ Second API call token count high: ~${Math.round(secondCallEstimatedTokens/1000)}K tokens. Truncating conversation history...`);
        
        // Keep system message and recent messages, remove older history
        const systemMsg = messages[0];
        const assistantMsg = messages[messages.length - toolResults.length - 1];
        const userMsg = messages[messages.length - toolResults.length - 2];
        
        // Keep only the most recent 3 history messages + current interaction
        const recentHistory = messages.slice(1, messages.length - toolResults.length - 2);
        const limitedRecentHistory = recentHistory.slice(-3);
        
        // Rebuild messages array with limited history
        const truncatedMessages = [
          systemMsg,
          ...limitedRecentHistory,
          userMsg,
          assistantMsg,
          ...toolResults
        ];
        
        const truncatedTokens = estimateTokens(JSON.stringify(truncatedMessages));
        if (truncatedTokens <= MAX_CONTEXT_TOKENS) {
          messages.length = 0;
          messages.push(...truncatedMessages);
          console.log(`✅ Truncated messages from ~${Math.round(secondCallEstimatedTokens/1000)}K to ~${Math.round(truncatedTokens/1000)}K tokens`);
        } else {
          // If still too large, truncate tool results
          console.warn(`⚠️ Still over limit after truncation. Limiting tool result sizes...`);
          const truncatedToolResults = toolResults.map((tr: any) => {
            const content = tr.content || '';
            const maxToolResultLength = 500; // Limit each tool result to 500 chars
            return {
              ...tr,
              content: content.length > maxToolResultLength 
                ? content.substring(0, maxToolResultLength) + '... [truncated]'
                : content
            };
          });
          
          messages.length = 0;
          messages.push(
            systemMsg,
            ...limitedRecentHistory,
            userMsg,
            assistantMsg,
            ...truncatedToolResults
          );
        }
      }
      
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Provide helpful error message for token limit errors
        if (errorData.error?.message?.includes('maximum context length') || errorData.error?.message?.includes('tokens')) {
          const errorMsg = errorData.error.message || 'Token limit exceeded';
          const currentTokens = estimateTokens(JSON.stringify(messages));
          console.error(`❌ Token limit error on second call. Estimated tokens: ~${Math.round(currentTokens/1000)}K`);
          throw new Error(`AI API error: ${response.status} - ${errorMsg}. The conversation context is too long. Please try starting a new conversation.`);
        }
        
        throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      data = await response.json();
      finalResponse = data.choices[0]?.message?.content || aiResponse;
    } else {
      finalResponse = aiResponse;
    }

    return new Response(
      JSON.stringify({ 
        response: finalResponse,
        provider: useDeepSeek ? 'DeepSeek' : 'OpenAI',
        model,
        actions: actions.length > 0 ? actions : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in ai-assistant function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to extract text content from various file types
async function extractTextFromFile(
  fileName: string,
  mimeType: string | undefined,
  fileBuffer: Uint8Array
): Promise<string | null> {
  try {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Text-based files
    if (
      mimeType?.includes('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/x-sh' ||
      ['txt', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'xml', 'md', 'markdown', 'log', 'sh', 'bat', 'ps1', 'sql'].includes(extension)
    ) {
      try {
        const decoder = new TextDecoder('utf-8');
        let text = decoder.decode(fileBuffer);
        
        // Try other encodings if UTF-8 fails
        if (!text || text.includes('\uFFFD')) {
          try {
            const decoderLatin1 = new TextDecoder('latin1');
            text = decoderLatin1.decode(fileBuffer);
          } catch (e) {
            // Fallback to UTF-8 even if it has replacement characters
          }
        }
        
        return text;
      } catch (e) {
        console.warn(`Failed to decode text file ${fileName}:`, e);
        return null;
      }
    }
    
    // CSV files - parse and format
    if (mimeType === 'text/csv' || extension === 'csv') {
      try {
        const decoder = new TextDecoder('utf-8');
        const csvText = decoder.decode(fileBuffer);
        // Return CSV as-is, AI can parse it
        return csvText;
      } catch (e) {
        return null;
      }
    }
    
    // PDF files - extract text using basic PDF parsing
    if (mimeType === 'application/pdf' || extension === 'pdf') {
      try {
        // Basic PDF text extraction (simplified - for production, consider using a PDF library)
        const pdfText = await extractTextFromPDF(fileBuffer);
        return pdfText;
      } catch (e) {
        console.warn(`Failed to extract text from PDF ${fileName}:`, e);
        return `[PDF file: ${fileName} - Text extraction attempted but may be incomplete. Please describe the PDF contents.]`;
      }
    }
    
    // Images - use OCR or describe
    if (
      mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)
    ) {
      // For images, we can't extract text directly without OCR
      // Return a description that prompts the user to describe the image
      return `[Image file: ${fileName} (${mimeType || 'image'}) - Please describe what you see in this image or what information it contains.]`;
    }
    
    // Microsoft Office documents
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    ) {
      return `[Word document: ${fileName} - DOCX parsing not available in edge function. Please convert to PDF or describe the contents.]`;
    }
    
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      extension === 'xlsx'
    ) {
      return `[Excel spreadsheet: ${fileName} - XLSX parsing not available in edge function. Please export as CSV or describe the contents.]`;
    }
    
    if (
      mimeType === 'application/vnd.ms-excel' ||
      extension === 'xls'
    ) {
      return `[Excel spreadsheet: ${fileName} - XLS parsing not available in edge function. Please export as CSV or describe the contents.]`;
    }
    
    // Code files
    if (
      ['py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'r', 'm', 'pl', 'lua'].includes(extension)
    ) {
      try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(fileBuffer);
      } catch (e) {
        return null;
      }
    }
    
    // Unknown file type - try to decode as text anyway
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(fileBuffer);
      // Check if it looks like valid text (not too many null bytes or control chars)
      const nullByteCount = (text.match(/\0/g) || []).length;
      const controlCharCount = (text.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
      
      if (nullByteCount < text.length * 0.1 && controlCharCount < text.length * 0.2) {
        return text;
      }
    } catch (e) {
      // Not text, that's okay
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting text from ${fileName}:`, error);
    return null;
  }
}

// Basic PDF text extraction (simplified version)
async function extractTextFromPDF(pdfBuffer: Uint8Array): Promise<string> {
  try {
    // Convert to string to search for text objects
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
    
    // Extract text between BT (Begin Text) and ET (End Text) markers
    const textMatches: string[] = [];
    const btPattern = /BT[\s\S]*?ET/g;
    let match;
    
    while ((match = btPattern.exec(pdfString)) !== null) {
      const textBlock = match[0];
      // Extract text content (simplified - looks for text strings)
      const textPattern = /\((.*?)\)/g;
      let textMatch;
      while ((textMatch = textPattern.exec(textBlock)) !== null) {
        const text = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\(.)/g, '$1'); // Remove escape sequences
        if (text.trim()) {
          textMatches.push(text);
        }
      }
    }
    
    if (textMatches.length > 0) {
      return textMatches.join('\n');
    }
    
    // Fallback: try to find readable text patterns
    const readableText = pdfString.match(/[A-Za-z0-9\s.,;:!?\-]{20,}/g);
    if (readableText && readableText.length > 0) {
      return readableText.slice(0, 50).join(' '); // Limit to first 50 matches
    }
    
    return '[PDF content detected but text extraction incomplete. Please describe the PDF contents.]';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '[PDF file - text extraction failed. Please describe the PDF contents.]';
  }
}

function buildKnowledgeBase(): string {
  return `
# PABLO AI TRADING PLATFORM - KNOWLEDGE BASE

## PLATFORM OVERVIEW
Pablo AI Trading is an automated cryptocurrency trading platform that allows users to create, configure, and manage trading bots for various exchanges (Bybit, OKX, Bitunix) and trading types (Spot, Futures).

## BOT CONFIGURATION SETTINGS

### BASIC SETTINGS
- **Bot Name**: Unique identifier for the bot
- **Exchange**: bybit, okx, bitunix, or mexc
- **Trading Type**: spot or futures
- **Symbol**: Trading pair (e.g., BTCUSDT, ETHUSDT)
- **Timeframe**: 1m, 3m, 5m, 15m, 30m, 45m, 1h, 2h, 3h, 4h, 5h, 6h, 7h, 8h, 9h, 10h, 12h, 1d, 1w, 1M
- **Leverage**: 1-100x (for futures only, higher leverage = higher risk)
- **Risk Level**: low, medium, or high (affects default parameters)
- **Trade Amount**: Base currency amount per trade (e.g., 100 USDT)
- **Stop Loss**: Percentage loss before closing position (e.g., 2.0 = 2%)
- **Take Profit**: Percentage gain before closing position (e.g., 4.0 = 4%)
- **Paper Trading**: Enable to test strategies without real money

### STRATEGY SETTINGS

#### RSI (Relative Strength Index)
- **RSI Threshold**: 0-100, default 30-70
  - Below 30: Oversold (potential buy signal)
  - Above 70: Overbought (potential sell signal)
  - RSI Period: Default 14 (number of candles to calculate)

#### ADX (Average Directional Index)
- **ADX Threshold**: Measures trend strength, default 25-30
  - Below 20: Weak trend (choppy market)
  - Above 25: Strong trend
  - ADX doesn't indicate direction, only strength

#### Bollinger Bands
- **BB Width Threshold**: Measures volatility
  - Narrow bands: Low volatility (consolidation)
  - Wide bands: High volatility (trending)
- **BB Period**: Default 20
- **BB Standard Deviation**: Default 2

#### EMA (Exponential Moving Average)
- **EMA Slope**: Rate of change of EMA
- **EMA Fast Period**: Default 12
- **EMA Slow Period**: Default 26

#### ATR (Average True Range)
- **ATR Percentage**: Volatility measure
- **ATR Period**: Default 14
- Used for dynamic stop-loss and position sizing

#### VWAP (Volume Weighted Average Price)
- **VWAP Distance**: Distance from VWAP line
- Used to identify overbought/oversold conditions

#### Momentum
- **Momentum Threshold**: Price change rate
- Positive: Uptrend momentum
- Negative: Downtrend momentum

### ADVANCED STRATEGY CONFIGURATION

#### Directional Bias
- **bias_mode**: 
  - 'long-only': Only open long positions
  - 'short-only': Only open short positions
  - 'both': Trade both directions
  - 'auto': Follow higher timeframe trend
- **htf_timeframe**: Higher timeframe for trend analysis (1h, 4h, 1d, etc.)
- **htf_trend_indicator**: Indicator to determine trend (EMA50, EMA200, SMA200, VWAP, etc.)
- **require_price_vs_trend**: 'above', 'below', or 'any' - Price position relative to trend
- **adx_min_htf**: Minimum ADX on higher timeframe (15-35, default 28)
- **require_adx_rising**: Require ADX to be increasing

#### Regime Filter
- **regime_mode**: 
  - 'trend': Only trade in trending markets
  - 'mean-reversion': Only trade mean-reversion setups
  - 'auto': Trade both
- **adx_trend_min**: Minimum ADX for trend regime (default 30)
- **adx_meanrev_max**: Maximum ADX for mean-reversion (default 12)

#### Session/Timing Filters
- **session_filter_enabled**: Enable trading only during specific hours
- **allowed_hours_utc**: Array of UTC hours (0-23) when trading is allowed
- **cooldown_bars**: Number of bars to wait between trades (prevents overtrading)

#### Volatility & Liquidity Gates
- **atr_percentile_min**: Minimum ATR percentile (0-100, default 40)
  - Higher = only trade in more volatile conditions
- **bb_width_min**: Minimum Bollinger Band width (default 0.018)
- **bb_width_max**: Maximum Bollinger Band width (default 0.022)
- **min_24h_volume_usd**: Minimum 24h volume in USD (default 2,000,000,000)
- **max_spread_bps**: Maximum spread in basis points (default 1.5)

#### Risk Management
- **risk_per_trade_pct**: Risk percentage per trade (default 0.4-0.75%)
- **daily_loss_limit_pct**: Maximum daily loss percentage (default 1.5-3.0%)
- **weekly_loss_limit_pct**: Maximum weekly loss percentage (default 4.0-6.0%)
- **max_trades_per_day**: Maximum trades per day (default 3-8)
- **max_concurrent**: Maximum concurrent positions (default 1-2)
- **max_consecutive_losses**: Auto-pause after N consecutive losses (default 2-5)

#### Stop Loss & Take Profit
- **sl_atr_mult**: Stop loss multiplier based on ATR (default 1.2-1.5)
- **tp1_r**: First take profit risk-reward ratio (default 1.5-2.0)
- **tp2_r**: Second take profit risk-reward ratio (default 3.0)
- **tp1_size**: Percentage of position to close at TP1 (default 0.5-0.7)
- **breakeven_at_r**: Move stop to breakeven at this R:R (default 0.5-0.8)
- **trail_after_tp1_atr**: Trailing stop ATR multiplier after TP1 (default 0.6-1.0)
- **time_stop_hours**: Close position after N hours (default 12-48, prevents funding fees)

#### Advanced Exit Features
- **enable_dynamic_trailing**: Enable dynamic trailing stops
- **smart_exit_enabled**: Exit if market retraces beyond threshold
- **smart_exit_retracement_pct**: Retracement percentage to trigger exit (default 0.4-2.0%)
- **enable_trailing_take_profit**: Lock in profits as equity reaches new highs
- **trailing_take_profit_atr**: ATR multiplier for trailing TP

#### ML/AI Settings
- **use_ml_prediction**: Enable ML-based predictions
- **ml_confidence_threshold**: Minimum confidence for ML signals (0.5-0.8)
- **ml_min_samples**: Minimum samples required for ML (default 50)

## TRADING CONCEPTS

### Risk Management
- **Position Sizing**: Never risk more than 1-2% of account per trade
- **Stop Loss**: Always use stop losses to limit downside
- **Take Profit**: Lock in profits at predetermined levels
- **Leverage**: Higher leverage = higher risk and potential reward
- **Diversification**: Don't put all capital in one bot or pair

### Technical Indicators Explained
- **RSI**: Momentum oscillator, identifies overbought/oversold
- **ADX**: Trend strength indicator (not direction)
- **Bollinger Bands**: Volatility bands around price
- **EMA/SMA**: Moving averages that smooth price data
- **ATR**: Volatility measure, useful for dynamic stops
- **VWAP**: Volume-weighted average price
- **MACD**: Trend-following momentum indicator

### Trading Strategies
- **Trend Following**: Trade in direction of trend (higher ADX)
- **Mean Reversion**: Trade against extremes (lower ADX, oversold/overbought)
- **Breakout**: Trade when price breaks key levels
- **Scalping**: Quick trades with tight stops (high frequency)
- **Swing Trading**: Hold positions for days/weeks

### Common Mistakes to Avoid
1. Overtrading (too many trades, no cooldown)
2. Ignoring risk management (no stop loss, too much leverage)
3. Trading in choppy markets (low ADX, no clear trend)
4. Not using paper trading to test strategies
5. Emotional trading (fear, greed, FOMO)
6. Not diversifying (all capital in one pair/bot)

## PLATFORM FEATURES

### Backtesting
- **Built-in Backtesting Feature**: The platform includes a comprehensive backtesting tool accessible at `/backtest`
- **Purpose**: Test trading strategies and find optimal bot settings before creating live bots
- **How to Guide Users**:
  When users ask about backtesting, explain that they need to:
  1. Navigate to the Backtest page by going to `/backtest` in the platform
  2. Select trading pairs they want to test
  3. Configure strategy settings (RSI, ADX, Bollinger Bands, etc.)
  4. Set date range for historical data
  5. Click "Start Backtest" to run the test
  6. Review results: PnL, win rate, number of trades, drawdowns
  7. Compare different pairs and settings to find best performers
  8. Use optimal settings when creating their bot
- **IMPORTANT**: You cannot run backtests directly. You can only guide users on how to use the backtesting feature. Do not try to execute backtests, call backtest functions, or reference backtest variables that don't exist.
- **Best Practices for Backtesting** (to share with users):
  - Test multiple pairs to find best performers
  - Test different timeframes (15m, 1h, 4h, 1d)
  - Test various strategy configurations
  - Use realistic date ranges (at least 30 days)
  - Compare results across different market conditions
  - Look for consistent performance, not just high returns
- **After Backtesting**: Users can use the results to create bots with proven settings. They can navigate to `/create-bot` and apply the settings that performed best in backtesting, or use the "Create Bot from Backtest" button on the backtest results page.

### Bot Management
- Create, edit, pause, resume, and delete bots
- Clone existing bots with same settings
- View bot performance (PnL, win rate, trades)
- Paper trading mode for testing

### Trade Management
- View all trades (open and closed)
- Manual trade signals (override bot decisions)
- Trade history and analytics

### Settings & Configuration
- API keys for exchanges (Bybit, OKX, Bitunix)
- AI API keys (OpenAI, DeepSeek) for recommendations
- Telegram notifications
- Email notifications
- Risk management settings

### Analytics & Reporting
- Performance metrics (PnL, win rate, Sharpe ratio)
- Drawdown analysis
- Trade history
- Bot activity logs

## BEST PRACTICES

1. **Use Backtesting First**: Before creating a bot, use the backtesting feature (`/backtest`) to test strategies and find best performing pairs
2. **Start with Paper Trading**: Test strategies before using real money
3. **Use Conservative Settings**: Lower leverage, tighter stops initially
4. **Monitor Performance**: Regularly review bot performance and adjust
5. **Risk Management First**: Always prioritize capital preservation
6. **Understand Settings**: Know what each parameter does before changing
7. **Start Small**: Begin with small position sizes
8. **Diversify**: Use multiple bots/pairs to spread risk
9. **Keep Learning**: Continuously educate yourself on trading concepts
10. **Test Multiple Pairs**: Use backtesting to compare different trading pairs and find the best performers

## SUPPORT & HELP

- Use this AI Assistant for questions about settings and strategies
- Check the Academy section for educational content
- Review bot performance regularly
- Adjust settings based on market conditions
- Contact support through the Contact page if needed
`;
}

// Execute bot creation
async function executeCreateBot(supabaseClient: any, userId: string, params: any) {
  try {
    console.log('🔧 [executeCreateBot] Starting bot creation for user:', userId);
    console.log('🔧 [executeCreateBot] Parameters:', JSON.stringify(params, null, 2));

    // Validate required fields
    if (!params.name) {
      return { success: false, error: 'Bot name is required' };
    }
    if (!params.symbol) {
      return { success: false, error: 'Trading symbol is required (e.g., BTCUSDT)' };
    }

    // Check subscription limits
    console.log('🔧 [executeCreateBot] Checking subscription limits...');
    const { data: limitCheck, error: rpcError } = await supabaseClient
      .rpc('can_user_create_bot', { p_user_id: userId });
    
    if (rpcError) {
      console.error('❌ [executeCreateBot] RPC error:', rpcError);
      // Don't fail on RPC error - try to continue (might be missing function)
      console.warn('⚠️ [executeCreateBot] RPC check failed, continuing with bot creation...');
    }
    
    if (limitCheck) {
      console.log('🔧 [executeCreateBot] Limit check result:', limitCheck);
      
      // Handle both boolean and object responses
      if (typeof limitCheck === 'boolean') {
        if (!limitCheck) {
          return { 
            success: false, 
            error: 'Bot creation limit reached. Please upgrade your subscription plan.' 
          };
        }
      } else if (typeof limitCheck === 'object' && limitCheck.allowed !== true) {
        return { 
          success: false, 
          error: limitCheck.reason || 'Bot creation limit reached' 
        };
      }
    }

    // Set defaults based on risk level
    const riskLevel = params.riskLevel || 'medium';
    const defaults = {
      low: { stopLoss: 1.5, takeProfit: 3.0, tradeAmount: 50, leverage: 1 },
      medium: { stopLoss: 2.5, takeProfit: 5.0, tradeAmount: 100, leverage: 2 },
      high: { stopLoss: 4.0, takeProfit: 8.0, tradeAmount: 200, leverage: 5 }
    };
    
    const riskDefaults = defaults[riskLevel as keyof typeof defaults] || defaults.medium;

    // Build default strategy if not provided
    let strategy = params.strategy;
    if (!strategy) {
      // Default to RSI strategy with sensible parameters
      strategy = {
        type: 'rsi',
        enabled: true,
        rsi_period: 14,
        rsi_oversold: 30,
        rsi_overbought: 70
      };
    }

    // Ensure strategy is properly formatted
    if (typeof strategy === 'string') {
      try {
        strategy = JSON.parse(strategy);
      } catch (e) {
        console.warn('⚠️ [executeCreateBot] Failed to parse strategy string, using default');
        strategy = {
          type: 'rsi',
          enabled: true,
          rsi_period: 14,
          rsi_oversold: 30,
          rsi_overbought: 70
        };
      }
    }

    // Prepare bot data
    const botData: any = {
      user_id: userId,
      name: params.name,
      exchange: params.exchange || 'bybit',
      trading_type: params.tradingType || 'spot',
      symbol: params.symbol.toUpperCase(), // Ensure uppercase
      timeframe: params.timeframe || '1h',
      leverage: params.leverage || (params.tradingType === 'futures' ? riskDefaults.leverage : 1),
      risk_level: riskLevel,
      trade_amount: params.tradeAmount || riskDefaults.tradeAmount,
      stop_loss: params.stopLoss || riskDefaults.stopLoss,
      take_profit: params.takeProfit || riskDefaults.takeProfit,
      strategy: JSON.stringify(strategy),
      strategy_config: params.strategyConfig ? JSON.stringify(params.strategyConfig) : null,
      paper_trading: params.paperTrading !== undefined ? params.paperTrading : true, // Default to paper trading for safety
      status: 'stopped', // Start stopped, user can start manually
      created_at: new Date().toISOString()
    };

    // Add symbols array
    botData.symbols = JSON.stringify([params.symbol.toUpperCase()]);

    console.log('🔧 [executeCreateBot] Inserting bot data:', JSON.stringify(botData, null, 2));

    const { data: bot, error } = await supabaseClient
      .from('trading_bots')
      .insert(botData)
      .select()
      .single();

    if (error) {
      console.error('❌ [executeCreateBot] Bot creation error:', error);
      console.error('❌ [executeCreateBot] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Failed to create bot';
      if (error.code === '23505') {
        errorMessage = 'A bot with this name already exists. Please choose a different name.';
      } else if (error.code === '23503') {
        errorMessage = 'Invalid user or reference error. Please try again.';
      } else if (error.code === '42501') {
        errorMessage = 'Permission denied. Please check your account permissions.';
      }
      
      return { success: false, error: errorMessage, details: error.details || error.hint };
    }

    console.log('✅ [executeCreateBot] Bot created successfully:', bot.id);

    return {
      success: true,
      bot: {
        id: bot.id,
        name: bot.name,
        exchange: bot.exchange,
        symbol: bot.symbol,
        status: bot.status,
        paperTrading: bot.paper_trading
      }
    };
  } catch (error: any) {
    console.error('❌ [executeCreateBot] Exception in bot creation:', error);
    console.error('❌ [executeCreateBot] Stack:', error.stack);
    return { 
      success: false, 
      error: error.message || 'Failed to create bot',
      details: error.stack 
    };
  }
}

// Execute bot update
async function executeUpdateBot(supabaseClient: any, userId: string, params: any) {
  try {
    const { botId, ...updates } = params;

    // Verify bot belongs to user
    const { data: existingBot, error: fetchError } = await supabaseClient
      .from('trading_bots')
      .select('id, user_id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingBot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    // Transform updates to database format
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.stopLoss !== undefined) dbUpdates.stop_loss = updates.stopLoss;
    if (updates.takeProfit !== undefined) dbUpdates.take_profit = updates.takeProfit;
    if (updates.tradeAmount !== undefined) dbUpdates.trade_amount = updates.tradeAmount;
    if (updates.leverage !== undefined) dbUpdates.leverage = updates.leverage;
    if (updates.riskLevel) dbUpdates.risk_level = updates.riskLevel;
    if (updates.strategy) dbUpdates.strategy = JSON.stringify(updates.strategy);
    if (updates.strategyConfig !== undefined) {
      dbUpdates.strategy_config = JSON.stringify(updates.strategyConfig);
    }
    if (updates.paperTrading !== undefined) dbUpdates.paper_trading = updates.paperTrading;

    if (Object.keys(dbUpdates).length === 0) {
      return { success: false, error: 'No valid updates provided' };
    }

    const { data: bot, error } = await supabaseClient
      .from('trading_bots')
      .update(dbUpdates)
      .eq('id', botId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Bot update error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      bot: {
        id: bot.id,
        name: bot.name,
        updates: Object.keys(dbUpdates)
      }
    };
  } catch (error: any) {
    console.error('Error in executeUpdateBot:', error);
    return { success: false, error: error.message || 'Failed to update bot' };
  }
}

// Get bot performance
async function executeGetBotPerformance(supabaseClient: any, userId: string, botId: string) {
  try {
    const { data: bot, error } = await supabaseClient
      .from('trading_bots')
      .select('id, name, pnl, pnl_percentage, total_trades, win_rate, status, created_at, last_trade_at')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (error || !bot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    return {
      success: true,
      performance: {
        name: bot.name,
        pnl: bot.pnl || 0,
        pnlPercentage: bot.pnl_percentage || 0,
        totalTrades: bot.total_trades || 0,
        winRate: bot.win_rate || 0,
        status: bot.status,
        createdAt: bot.created_at,
        lastTradeAt: bot.last_trade_at
      }
    };
  } catch (error: any) {
    console.error('Error in executeGetBotPerformance:', error);
    return { success: false, error: error.message || 'Failed to get bot performance' };
  }
}

// Update user settings
async function executeUpdateUserSettings(supabaseClient: any, userId: string, params: any) {
  try {
    // Get current settings
    const { data: currentSettings, error: fetchError } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return { success: false, error: 'Failed to fetch current settings' };
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (params.notificationPreferences) {
      if (currentSettings) {
        updates.notification_preferences = {
          ...currentSettings.notification_preferences,
          ...params.notificationPreferences
        };
      } else {
        updates.notification_preferences = params.notificationPreferences;
      }
    }

    if (params.alertSettings) {
      if (currentSettings) {
        updates.alert_settings = {
          ...currentSettings.alert_settings,
          ...params.alertSettings
        };
      } else {
        updates.alert_settings = params.alertSettings;
      }
    }

    if (params.riskSettings) {
      if (currentSettings) {
        updates.risk_settings = {
          ...currentSettings.risk_settings,
          ...params.riskSettings
        };
      } else {
        updates.risk_settings = params.riskSettings;
      }
    }

    // Create or update settings
    let result;
    if (currentSettings) {
      const { data, error } = await supabaseClient
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseClient
        .from('user_settings')
        .insert({
          user_id: userId,
          ...updates
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return {
      success: true,
      message: 'User settings updated successfully',
      updatedFields: Object.keys(updates).filter(k => k !== 'updated_at')
    };
  } catch (error: any) {
    console.error('Error in executeUpdateUserSettings:', error);
    return { success: false, error: error.message || 'Failed to update user settings' };
  }
}

// Check bot positions on exchange
async function executeCheckBotPositions(supabaseClient: any, userId: string, botId: string) {
  try {
    // Verify bot belongs to user
    const { data: bot, error: botError } = await supabaseClient
      .from('trading_bots')
      .select('id, name, exchange, trading_type, symbol, user_id, paper_trading')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    // For paper trading, check paper_trading_positions table
    if (bot.paper_trading) {
      const { data: positions, error: posError } = await supabaseClient
        .from('paper_trading_positions')
        .select('*')
        .eq('bot_id', botId)
        .eq('user_id', userId)
        .eq('status', 'open');

      if (posError) {
        return { success: false, error: posError.message || 'Failed to fetch paper positions' };
      }

      return {
        success: true,
        positions: positions || [],
        count: positions?.length || 0,
        type: 'paper'
      };
    }

    // For real trading, check trades table for open positions
    const { data: openTrades, error: tradesError } = await supabaseClient
      .from('trades')
      .select('*')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .in('status', ['open', 'pending', 'filled'])
      .order('created_at', { ascending: false });

    if (tradesError) {
      return { success: false, error: tradesError.message || 'Failed to fetch positions' };
    }

    return {
      success: true,
      positions: openTrades || [],
      count: openTrades?.length || 0,
      type: 'real'
    };
  } catch (error: any) {
    console.error('Error in executeCheckBotPositions:', error);
    return { success: false, error: error.message || 'Failed to check bot positions' };
  }
}

// Close bot position
async function executeCloseBotPosition(supabaseClient: any, userId: string, params: any) {
  try {
    const { botId, tradeId } = params;

    // Verify bot belongs to user
    const { data: bot, error: botError } = await supabaseClient
      .from('trading_bots')
      .select('id, name, exchange, trading_type, symbol, user_id, paper_trading')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    // If tradeId is provided, close that specific trade
    if (tradeId) {
      const { data: trade, error: tradeError } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('bot_id', botId)
        .eq('user_id', userId)
        .single();

      if (tradeError || !trade) {
        return { success: false, error: 'Trade not found or access denied' };
      }

      // Call risk-management function to close position
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const riskManagementUrl = `${supabaseUrl}/functions/v1/risk-management`;

      const closeResponse = await fetch(riskManagementUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        },
        body: JSON.stringify({
          action: 'close-position',
          tradeId: tradeId,
          reason: 'Closed via AI Assistant'
        })
      });

      if (!closeResponse.ok) {
        const errorData = await closeResponse.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to close position' };
      }

      const closeData = await closeResponse.json();
      return {
        success: true,
        message: 'Position closed successfully',
        tradeId: tradeId,
        details: closeData
      };
    }

    // If no tradeId, close all open positions for the bot
    const { data: openTrades, error: tradesError } = await supabaseClient
      .from('trades')
      .select('id')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .in('status', ['open', 'pending', 'filled']);

    if (tradesError) {
      return { success: false, error: tradesError.message || 'Failed to fetch open trades' };
    }

    if (!openTrades || openTrades.length === 0) {
      return { success: true, message: 'No open positions to close', closed: 0 };
    }

    // Close all open positions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const riskManagementUrl = `${supabaseUrl}/functions/v1/risk-management`;

    const closeResults = [];
    for (const trade of openTrades) {
      try {
        const closeResponse = await fetch(riskManagementUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          },
          body: JSON.stringify({
            action: 'close-position',
            tradeId: trade.id,
            reason: 'Closed via AI Assistant (bulk close)'
          })
        });

        if (closeResponse.ok) {
          closeResults.push({ tradeId: trade.id, success: true });
        } else {
          closeResults.push({ tradeId: trade.id, success: false });
        }
      } catch (err) {
        closeResults.push({ tradeId: trade.id, success: false, error: err.message });
      }
    }

    const successCount = closeResults.filter(r => r.success).length;
    return {
      success: successCount > 0,
      message: `Closed ${successCount} of ${openTrades.length} positions`,
      closed: successCount,
      total: openTrades.length,
      results: closeResults
    };
  } catch (error: any) {
    console.error('Error in executeCloseBotPosition:', error);
    return { success: false, error: error.message || 'Failed to close position' };
  }
}

// Get bot logs
async function executeGetBotLogs(supabaseClient: any, userId: string, botId: string, limit: number = 50) {
  try {
    // Verify bot belongs to user
    const { data: bot, error: botError } = await supabaseClient
      .from('trading_bots')
      .select('id, name, user_id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    // Fetch bot activity logs
    const maxLimit = Math.min(limit || 50, 200); // Cap at 200
    const { data: logs, error: logsError } = await supabaseClient
      .from('bot_activity_logs')
      .select('*')
      .eq('bot_id', botId)
      .order('timestamp', { ascending: false })
      .limit(maxLimit);

    if (logsError) {
      return { success: false, error: logsError.message || 'Failed to fetch bot logs' };
    }

    return {
      success: true,
      logs: logs || [],
      count: logs?.length || 0,
      botName: bot.name
    };
  } catch (error: any) {
    console.error('Error in executeGetBotLogs:', error);
    return { success: false, error: error.message || 'Failed to get bot logs' };
  }
}

// Check exchange balance
async function executeCheckExchangeBalance(supabaseClient: any, userId: string, botId: string) {
  try {
    // Verify bot belongs to user
    const { data: bot, error: botError } = await supabaseClient
      .from('trading_bots')
      .select('id, name, exchange, user_id, paper_trading')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return { success: false, error: 'Bot not found or access denied' };
    }

    // For paper trading, check paper account balance
    if (bot.paper_trading) {
      const { data: account, error: accountError } = await supabaseClient
        .from('paper_trading_accounts')
        .select('balance, equity')
        .eq('user_id', userId)
        .single();

      if (accountError) {
        return { success: false, error: accountError.message || 'Failed to fetch paper account balance' };
      }

      return {
        success: true,
        balance: parseFloat(account.balance || 0),
        equity: parseFloat(account.equity || account.balance || 0),
        type: 'paper',
        exchange: bot.exchange
      };
    }

    // For real trading, we need to call bot-executor to get balance from exchange
    // First, get API keys
    const { data: apiKeys, error: apiError } = await supabaseClient
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('exchange', bot.exchange)
      .single();

    if (apiError || !apiKeys) {
      return { 
        success: false, 
        error: `API keys not configured for ${bot.exchange}. Please configure API keys in settings.` 
      };
    }

    // Call bot-executor to check balance (we'll need to implement this endpoint or use existing logic)
    // For now, return a message that balance check requires API access
    return {
      success: true,
      message: 'Balance check requires direct exchange API access',
      exchange: bot.exchange,
      apiKeysConfigured: true,
      note: 'Real-time balance can be checked via the exchange directly or through the bot-executor function'
    };
  } catch (error: any) {
    console.error('Error in executeCheckExchangeBalance:', error);
    return { success: false, error: error.message || 'Failed to check exchange balance' };
  }
}

// Get market data
async function executeGetMarketData(symbol: string, exchange: string = 'bybit', tradingType: string = 'futures') {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const botExecutorUrl = `${supabaseUrl}/functions/v1/bot-executor?action=market-data&symbol=${symbol}&exchange=${exchange}&tradingType=${tradingType}`;

    const response = await fetch(botExecutorUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to fetch market data' };
    }

    const data = await response.json();
    return {
      success: true,
      marketData: {
        symbol: data.symbol || symbol,
        exchange: data.exchange || exchange,
        tradingType: data.tradingType || tradingType,
        price: data.price,
        rsi: data.rsi,
        adx: data.adx,
        timestamp: data.timestamp
      }
    };
  } catch (error: any) {
    console.error('Error in executeGetMarketData:', error);
    return { success: false, error: error.message || 'Failed to get market data' };
  }
}

