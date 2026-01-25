import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import { supabase, getAuthTokenFast } from '../../lib/supabase';

type WinnerRow = {
  symbol: string;
  trades: number;
  win_rate: number;
  pnl: number;
  pnl_percentage: number;
  gross_profit: number;
  gross_loss: number;
  long_trades: number;
  short_trades: number;
  long_wins: number;
  long_losses: number;
  short_wins: number;
  short_losses: number;
  long_pnl: number;
  short_pnl: number;
};

type WinnersConfig = {
  exchange: string;
  tradingType: string;
  timeframe: string;
  lookbackDays: number;
  maxPairs: number;
  minTrades: number;
  tradeAmount: number;
  stopLoss: number;
  takeProfit: number;
  leverage: number;
  riskLevel: string;
  startDate: string;
  endDate: string;
  symbols: string[];
};

type WinnersResponse = {
  winners: WinnerRow[];
  config: WinnersConfig;
  strategy: Record<string, unknown>;
  strategyConfig: Record<string, unknown>;
};

export default function WinnersPage() {
  const navigate = useNavigate();
  const [lookbackDays, setLookbackDays] = useState(14);
  const [maxPairs, setMaxPairs] = useState(4);
  const [minTrades, setMinTrades] = useState(2);
  const [timeframe, setTimeframe] = useState('15m');
  const [tradeAmount, setTradeAmount] = useState(70);
  const [stopLoss, setStopLoss] = useState(1.5);
  const [takeProfit, setTakeProfit] = useState(3.0);
  const [leverage, setLeverage] = useState(5);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WinnersResponse | null>(null);

  const [createBotSymbol, setCreateBotSymbol] = useState<WinnerRow | null>(null);
  const [botName, setBotName] = useState('');

  const handleFindWinners = async () => {
    setIsRunning(true);
    setError(null);
    setData(null);
    try {
      console.log('🔍 Calling winners-backtest with:', {
        timeframe,
        lookbackDays,
        maxPairs,
        minTrades,
        tradeAmount,
        stopLoss,
        takeProfit,
        leverage,
      });
      
      // Use custom fetch with longer timeout (90 seconds) for backtest
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || ''
      const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || ''
      const authToken = await getAuthTokenFast()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90 * 1000) // 90 second timeout
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/winners-backtest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exchange: 'bybit',
            tradingType: 'futures',
            timeframe,
            lookbackDays,
            maxPairs,
            minTrades,
            tradeAmount,
            stopLoss,
            takeProfit,
            leverage,
            riskLevel: 'medium',
          }),
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          let errorJson: any = {}
          try { errorJson = JSON.parse(errorText) } catch {}
          const errorMsg = errorJson?.error || errorText || `Request failed with status ${response.status}`
          console.error('❌ HTTP error:', response.status, errorMsg)
          throw new Error(errorMsg)
        }
        
        const responseText = await response.text()
        console.log('📥 Response received, length:', responseText.length)
        
        let res: any
        try {
          res = JSON.parse(responseText)
        } catch (parseErr) {
          console.error('❌ JSON parse error:', parseErr, 'Response:', responseText.substring(0, 200))
          throw new Error('Invalid JSON response from server')
        }
        
        console.log('📥 Response parsed:', { 
          hasData: !!res, 
          dataKeys: res ? Object.keys(res) : [],
          hasWinners: !!res?.winners,
          winnersCount: res?.winners?.length || 0
        })
        
        if (res?.error) {
          console.error('❌ Response contains error:', res.error)
          throw new Error(res.error)
        }
        
        if (!res) {
          console.error('❌ No response data received')
          throw new Error('No data received from backtest')
        }
        
        if (!res.winners || !Array.isArray(res.winners)) {
          console.error('❌ Invalid response format:', res)
          throw new Error('Invalid response format: missing winners array')
        }
        
        console.log('✅ Setting winners data:', { 
          winnersCount: res.winners.length,
          config: res.config 
        })
        
        setData(res as WinnersResponse)
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr?.name === 'AbortError') {
          console.error('❌ Request timed out after 90 seconds')
          throw new Error('Request timed out. The backtest is taking longer than expected. Please try again with fewer pairs or a shorter lookback period.')
        }
        throw fetchErr
      }
    } catch (e: unknown) {
      console.error('❌ Error in handleFindWinners:', e)
      setError(e instanceof Error ? e.message : 'Find Winners failed')
    } finally {
      setIsRunning(false);
    }
  };

  const handleCreateBot = (winner: WinnerRow) => {
    setCreateBotSymbol(winner);
    setBotName(`Winner ${winner.symbol}`);
  };

  const confirmCreateBot = () => {
    if (!createBotSymbol || !data || !botName.trim()) return;
    const config = data.config;
    const backtestConfig = {
      exchange: config.exchange,
      tradingType: config.tradingType,
      symbols: [createBotSymbol.symbol],
      timeframe: config.timeframe,
      leverage: config.leverage,
      riskLevel: config.riskLevel,
      tradeAmount: config.tradeAmount,
      stopLoss: config.stopLoss,
      takeProfit: config.takeProfit,
    };
    const backtestResults = {
      win_rate: createBotSymbol.win_rate,
      total_pnl: createBotSymbol.pnl,
      net_profit: createBotSymbol.pnl,
    };
    navigate('/create-bot', {
      state: {
        fromBacktest: true,
        backtestResults,
        botName: botName.trim(),
        backtestConfig,
        backtestStrategy: data.strategy,
        backtestAdvancedConfig: data.strategyConfig,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Winners" subtitle="Find winning pairs via backtest, then create a bot" />
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6" padding="lg">
            <h2 className="text-xl font-bold mb-4">Find Winners</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Run a backtest across popular pairs. Results are ranked by PnL. Use &quot;Create Bot&quot; to start a bot for a winning pair.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label htmlFor="winners-lookback" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lookback (days)</label>
                <input
                  id="winners-lookback"
                  type="number"
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Math.max(7, Math.min(21, parseInt(e.target.value) || 14)))}
                  min={7}
                  max={21}
                  aria-label="Lookback days"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-maxpairs" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max pairs</label>
                <input
                  id="winners-maxpairs"
                  type="number"
                  value={maxPairs}
                  onChange={(e) => setMaxPairs(Math.max(1, Math.min(8, parseInt(e.target.value) || 4)))}
                  min={1}
                  max={8}
                  aria-label="Max pairs"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-mintrades" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min trades</label>
                <input
                  id="winners-mintrades"
                  type="number"
                  value={minTrades}
                  onChange={(e) => setMinTrades(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  aria-label="Min trades"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-timeframe" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeframe</label>
                <select
                  id="winners-timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  aria-label="Timeframe"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
              <div>
                <label htmlFor="winners-tradeamount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade amount ($)</label>
                <input
                  id="winners-tradeamount"
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(parseFloat(e.target.value) || 70)}
                  min={10}
                  aria-label="Trade amount USDT"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-stoploss" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stop loss (%)</label>
                <input
                  id="winners-stoploss"
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value) || 1.5)}
                  min={0.5}
                  step={0.5}
                  aria-label="Stop loss percent"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-takeprofit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Take profit (%)</label>
                <input
                  id="winners-takeprofit"
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 3)}
                  min={1}
                  step={0.5}
                  aria-label="Take profit percent"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="winners-leverage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leverage</label>
                <input
                  id="winners-leverage"
                  type="number"
                  value={leverage}
                  onChange={(e) => setLeverage(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                  min={1}
                  max={100}
                  aria-label="Leverage"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={handleFindWinners}
              loading={isRunning}
              disabled={isRunning}
              className="w-full sm:w-auto"
            >
              {isRunning ? 'Finding winners…' : (
                <>
                  <i className="ri-search-line mr-2" />
                  Find Winners
                </>
              )}
            </Button>
          </Card>

          {data && (
            <Card className="p-6" padding="lg">
              <h3 className="text-lg font-semibold mb-4">Winners (ranked by PnL)</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {data.config.startDate?.slice(0, 10)} → {data.config.endDate?.slice(0, 10)} · {data.config.timeframe} · Bybit futures
              </p>
              {data.winners.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No pairs passed the min-trades filter. Try lowering &quot;Min trades&quot; or increasing &quot;Lookback&quot;.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium">Pair</th>
                        <th className="text-right py-2 font-medium">Trades</th>
                        <th className="text-right py-2 font-medium">Win %</th>
                        <th className="text-right py-2 font-medium">PnL</th>
                        <th className="text-right py-2 font-medium">PnL %</th>
                        <th className="text-right py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.winners.map((w) => (
                        <tr key={w.symbol} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 font-medium">{w.symbol}</td>
                          <td className="text-right">{w.trades}</td>
                          <td className="text-right">{w.win_rate.toFixed(1)}%</td>
                          <td className={`text-right font-medium ${w.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${w.pnl.toFixed(2)}
                          </td>
                          <td className={`text-right ${w.pnl_percentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {w.pnl_percentage.toFixed(2)}%
                          </td>
                          <td className="text-right">
                            <Button type="button" variant="secondary" size="sm" onClick={() => handleCreateBot(w)}>
                              Create Bot
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {createBotSymbol && data && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md p-6">
                <h3 className="text-lg font-semibold mb-4">Create Bot from Winner</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create a live bot for <strong>{createBotSymbol.symbol}</strong> using the same strategy.
                </p>
                <div className="mb-4">
                  <label htmlFor="winners-botname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bot name</label>
                  <input
                    id="winners-botname"
                    type="text"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="e.g. Winner BTCUSDT"
                    aria-label="Bot name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">Win rate</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{createBotSymbol.win_rate.toFixed(1)}%</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">PnL</div>
                    <div className={`text-lg font-bold ${createBotSymbol.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ${createBotSymbol.pnl.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => { setCreateBotSymbol(null); setBotName(''); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" onClick={confirmCreateBot} disabled={!botName.trim()} className="flex-1">
                    Create Bot
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
