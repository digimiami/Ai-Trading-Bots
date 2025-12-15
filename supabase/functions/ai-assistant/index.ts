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
        attachmentContext += `- **${att.name}** (${att.type})\n`;
        // For text-based files, try to extract content from base64 data
        if (att.type?.includes('text/') || att.name?.endsWith('.txt') || att.name?.endsWith('.csv')) {
          try {
            const base64Data = att.data.split(',')[1]; // Remove data URL prefix
            const textContent = atob(base64Data);
            // Limit to first 2000 chars to avoid token limits
            const preview = textContent.length > 2000 ? textContent.substring(0, 2000) + '...' : textContent;
            attachmentContext += `  Content preview: ${preview}\n`;
          } catch (e) {
            attachmentContext += `  (Could not extract text content)\n`;
          }
        } else {
          attachmentContext += `  (Binary file - please describe the contents in your message)\n`;
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
        description: 'Create a new trading bot with specified configuration. Use this when user asks to create, add, or set up a new bot.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Bot name (e.g., "BTCUSDT RSI Low Risk")'
            },
            exchange: {
              type: 'string',
              enum: ['bybit', 'okx', 'bitunix'],
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
      }
    ];

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: `You are an expert AI Trading Assistant for the Pablo AI Trading Platform. Your role is to help users understand bot settings, trading strategies, risk management, and platform features.

${knowledgeBase}
${botsContextText}

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
14. Always preserve existing settings when updating - only modify the specific fields the user requests`
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message + attachmentContext
      }
    ];

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
      throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    let data = await response.json();
    const aiMessage = data.choices[0]?.message;
    aiResponse = aiMessage?.content || '';
    const toolCalls = supportsFunctionCalling ? (aiMessage?.tool_calls || []) : [];

    // Execute function calls if any (only for OpenAI)
    if (supportsFunctionCalling && toolCalls.length > 0) {
      console.log(`🔧 AI requested ${toolCalls.length} function call(s)`);
      
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
          } else {
            result = { error: `Unknown function: ${functionName}` };
          }
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(result)
          });
        } catch (error: any) {
          console.error(`❌ Error executing ${functionName}:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify({ error: error.message || 'Function execution failed' })
          });
        }
      }
      
      // Second AI call with function results
      messages.push({
        role: 'assistant',
        content: aiResponse,
        tool_calls: toolCalls
      });
      
      messages.push(...toolResults);
      
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

function buildKnowledgeBase(): string {
  return `
# PABLO AI TRADING PLATFORM - KNOWLEDGE BASE

## PLATFORM OVERVIEW
Pablo AI Trading is an automated cryptocurrency trading platform that allows users to create, configure, and manage trading bots for various exchanges (Bybit, OKX, Bitunix) and trading types (Spot, Futures).

## BOT CONFIGURATION SETTINGS

### BASIC SETTINGS
- **Bot Name**: Unique identifier for the bot
- **Exchange**: bybit, okx, or bitunix
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

1. **Start with Paper Trading**: Test strategies before using real money
2. **Use Conservative Settings**: Lower leverage, tighter stops initially
3. **Monitor Performance**: Regularly review bot performance and adjust
4. **Risk Management First**: Always prioritize capital preservation
5. **Understand Settings**: Know what each parameter does before changing
6. **Start Small**: Begin with small position sizes
7. **Diversify**: Use multiple bots/pairs to spread risk
8. **Keep Learning**: Continuously educate yourself on trading concepts

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
    // Check subscription limits
    const { data: limitCheck } = await supabaseClient
      .rpc('can_user_create_bot', { p_user_id: userId });
    
    if (limitCheck && typeof limitCheck === 'object' && limitCheck.allowed !== true) {
      return { 
        success: false, 
        error: limitCheck.reason || 'Bot creation limit reached' 
      };
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

    // Prepare bot data
    const botData: any = {
      user_id: userId,
      name: params.name,
      exchange: params.exchange || 'bybit',
      trading_type: params.tradingType || 'spot',
      symbol: params.symbol,
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
    botData.symbols = JSON.stringify([params.symbol]);

    const { data: bot, error } = await supabaseClient
      .from('trading_bots')
      .insert(botData)
      .select()
      .single();

    if (error) {
      console.error('Bot creation error:', error);
      return { success: false, error: error.message };
    }

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
    console.error('Error in executeCreateBot:', error);
    return { success: false, error: error.message || 'Failed to create bot' };
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

