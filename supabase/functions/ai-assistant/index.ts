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

    const { message, conversationHistory = [], apiKey: userApiKey, provider: userProvider } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Build comprehensive knowledge base prompt
    const knowledgeBase = buildKnowledgeBase();

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: `You are an expert AI Trading Assistant for the Pablo AI Trading Platform. Your role is to help users understand bot settings, trading strategies, risk management, and platform features.

${knowledgeBase}

IMPORTANT GUIDELINES:
1. Be helpful, clear, and concise
2. Use examples when explaining complex concepts
3. If asked about a specific setting, explain what it does, recommended values, and how it affects trading
4. For trading questions, provide educational and accurate information
5. Always prioritize risk management in your advice
6. If you don't know something, admit it rather than guessing
7. Format your responses in a readable way with bullet points, code blocks, or numbered lists when appropriate
8. Never provide financial advice that could be considered as investment recommendations`
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call AI API
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
      console.error('AI API error:', response.status, errorData);
      throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        provider: useDeepSeek ? 'DeepSeek' : 'OpenAI',
        model 
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

