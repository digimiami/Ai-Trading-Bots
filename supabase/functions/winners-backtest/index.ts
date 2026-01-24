import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sb-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Default candidate pairs for Find Winners (high-volume, commonly traded) */
const DEFAULT_CANDIDATE_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT',
  'LTCUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT', 'NEARUSDT', 'APTUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT', 'PEPEUSDT', 'WLDUSDT',
]

/** Default strategy used when not provided */
const DEFAULT_STRATEGY = {
  rsiThreshold: 70,
  adxThreshold: 25,
  bbWidthThreshold: 0.02,
  emaSlope: 0.5,
  atrPercentage: 2.5,
  vwapDistance: 1.2,
  momentumThreshold: 0.8,
  useMLPrediction: true,
  minSamplesForML: 100,
}

/** Default advanced config used when not provided */
const DEFAULT_STRATEGY_CONFIG = {
  bias_mode: 'auto',
  htf_timeframe: '4h',
  htf_trend_indicator: 'EMA200',
  ema_fast_period: 50,
  require_price_vs_trend: 'any',
  adx_min_htf: 23,
  require_adx_rising: true,
  regime_mode: 'auto',
  adx_trend_min: 25,
  adx_meanrev_max: 19,
  session_filter_enabled: false,
  allowed_hours_utc: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  cooldown_bars: 5,
  atr_period: 14,
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  max_trades_per_day: 8,
  max_concurrent: 2,
  max_consecutive_losses: 5,
  sl_atr_mult: 1.3,
  tp1_r: 1.0,
  tp2_r: 2.0,
  tp1_size: 0.5,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    try {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      })
    } catch (e) {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || ''
    if (!authHeader || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': anonKey },
    })
    if (!authRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const userJson = await authRes.json() as { id?: string }
    if (!userJson?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const {
      exchange = 'bybit',
      tradingType = 'futures',
      timeframe = '15m',
      lookbackDays = 14,
      maxPairs = 4,
      minTrades = 2,
      tradeAmount = 70,
      stopLoss = 1.5,
      takeProfit = 3.0,
      leverage = 5,
      riskLevel = 'medium',
      strategy: strategyOverride,
      strategyConfig: strategyConfigOverride,
    } = body

    if (exchange !== 'bybit') {
      return new Response(
        JSON.stringify({ error: 'Only Bybit is supported for Winners backtesting' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cappedMaxPairs = Math.min(Math.max(1, Math.floor(maxPairs)), 8)
    const cappedLookback = Math.min(Math.max(7, Math.floor(lookbackDays)), 21)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - cappedLookback)

    const symbols = (DEFAULT_CANDIDATE_SYMBOLS as string[]).slice(0, cappedMaxPairs)
    const strategy = strategyOverride && typeof strategyOverride === 'object' ? strategyOverride : DEFAULT_STRATEGY
    const strategyConfig = strategyConfigOverride && typeof strategyConfigOverride === 'object'
      ? { ...DEFAULT_STRATEGY_CONFIG, ...strategyConfigOverride }
      : DEFAULT_STRATEGY_CONFIG

    const backtestPayload = {
      name: `Winners ${symbols.join(', ')}`,
      symbols,
      exchange,
      tradingType,
      timeframe,
      leverage,
      riskLevel,
      tradeAmount,
      stopLoss,
      takeProfit,
      strategy,
      strategyConfig,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }

    const backtestUrl = `${supabaseUrl}/functions/v1/backtest-engine`
    let backtestRes: Response
    try {
      backtestRes = await fetch(backtestUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backtestPayload),
      })
    } catch (fetchErr: any) {
      console.error('Backtest engine fetch error:', fetchErr)
      return new Response(
        JSON.stringify({ error: 'Failed to call backtest engine' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!backtestRes.ok) {
      let errText = ''
      try {
        errText = await backtestRes.text()
      } catch (e) {
        errText = `Backtest engine returned ${backtestRes.status}`
      }
      let errJson: any = {}
      try { errJson = JSON.parse(errText) } catch { /* ignore */ }
      const msg = errJson?.error || errText || `Backtest engine returned ${backtestRes.status}`
      return new Response(
        JSON.stringify({ error: msg }),
        { status: backtestRes.status >= 500 ? 502 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let backtestData: any = {}
    try {
      backtestData = await backtestRes.json()
    } catch (parseErr: any) {
      console.error('Failed to parse backtest response:', parseErr)
      return new Response(
        JSON.stringify({ error: 'Invalid response from backtest engine' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const resultsPerPair = backtestData.results_per_pair || {}

    type WinnerRow = {
      symbol: string
      trades: number
      win_rate: number
      pnl: number
      pnl_percentage: number
      gross_profit: number
      gross_loss: number
      long_trades: number
      short_trades: number
      long_wins: number
      long_losses: number
      short_wins: number
      short_losses: number
      long_pnl: number
      short_pnl: number
    }

    const minTradesFilter = Math.max(0, Math.floor(minTrades))
    const rows: WinnerRow[] = []

    for (const symbol of symbols) {
      const r = resultsPerPair[symbol]
      if (!r || r.error) continue
      const trades = Number(r.trades) || 0
      if (trades < minTradesFilter) continue
      rows.push({
        symbol,
        trades,
        win_rate: Number(r.win_rate) || 0,
        pnl: Number(r.pnl) || 0,
        pnl_percentage: Number(r.pnl_percentage) || 0,
        gross_profit: Number(r.gross_profit) || 0,
        gross_loss: Number(r.gross_loss) || 0,
        long_trades: Number(r.long_trades) || 0,
        short_trades: Number(r.short_trades) || 0,
        long_wins: Number(r.long_wins) || 0,
        long_losses: Number(r.long_losses) || 0,
        short_wins: Number(r.short_wins) || 0,
        short_losses: Number(r.short_losses) || 0,
        long_pnl: Number(r.long_pnl) || 0,
        short_pnl: Number(r.short_pnl) || 0,
      })
    }

    rows.sort((a, b) => b.pnl - a.pnl)

    const config = {
      exchange,
      tradingType,
      timeframe,
      lookbackDays: cappedLookback,
      maxPairs: cappedMaxPairs,
      minTrades: minTradesFilter,
      tradeAmount,
      stopLoss,
      takeProfit,
      leverage,
      riskLevel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      symbols,
    }

    return new Response(
      JSON.stringify({
        winners: rows,
        config,
        strategy,
        strategyConfig,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('winners-backtest error:', e)
    return new Response(
      JSON.stringify({ error: e?.message || 'Winners backtest failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
