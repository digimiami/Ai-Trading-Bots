import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import NotificationBell from '../../components/feature/NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import { useBots } from '../../hooks/useBots';
import { useBotExecutor } from '../../hooks/useBotExecutor';

interface PabloReadyBot {
  id: string;
  name: string;
  description: string | null;
  exchange: string;
  symbol: string;
  trading_type: string;
  leverage: number;
  risk_level: string;
  strategy: any;
  strategy_config: any;
  trade_amount: number;
  stop_loss: number;
  take_profit: number;
  timeframe: string;
  enabled: boolean;
  featured: boolean;
  order_index: number;
}

export default function PabloReadyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createBot, startBot } = useBots();
  const { executeBot } = useBotExecutor();
  const [bots, setBots] = useState<PabloReadyBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingBot, setStartingBot] = useState<string | null>(null);
  const [botConfigs, setBotConfigs] = useState<Record<string, {
    paperTrading: boolean;
    tradeAmount: number;
    customPair?: string;
  }>>({});
  const [botPerformance, setBotPerformance] = useState<Record<string, {
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    wins: number;
    losses: number;
  }>>({});
  const [botLogs, setBotLogs] = useState<Record<string, any[]>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    // Initialize bot configs with defaults
    if (bots.length > 0) {
      const configs: Record<string, { paperTrading: boolean; tradeAmount: number; customPair?: string }> = {};
      bots.forEach(bot => {
        if (!botConfigs[bot.id]) {
          configs[bot.id] = {
            paperTrading: false,
            tradeAmount: bot.trade_amount || 100,
            customPair: bot.symbol === 'CUSTOM' ? '' : undefined
          };
        }
      });
      if (Object.keys(configs).length > 0) {
        setBotConfigs(prev => ({ ...prev, ...configs }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots]);

  const fetchBots = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('pablo_ready_bots')
        .select('*')
        .eq('enabled', true)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBots(data || []);
    } catch (err: any) {
      console.error('Error fetching Pablo Ready bots:', err);
      setError(err?.message || 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async (bot: PabloReadyBot) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      setStartingBot(bot.id);
      const config = botConfigs[bot.id] || { paperTrading: false, tradeAmount: bot.trade_amount || 100 };

      // Check if bot allows custom pair and validate input
      const allowsCustomPair = bot.strategy?.allows_custom_pair === true || bot.symbol === 'CUSTOM';
      const symbolToUse = allowsCustomPair 
        ? (config.customPair?.trim().toUpperCase() || bot.symbol)
        : bot.symbol;

      // Validate custom pair if provided
      if (allowsCustomPair && !config.customPair?.trim()) {
        alert('❌ Please enter a trading pair (e.g., BTCUSDT, ETHUSDT)');
        setStartingBot(null);
        return;
      }

      if (allowsCustomPair && config.customPair) {
        // Validate pair format
        const pairRegex = /^[A-Z0-9]{2,20}USDT$/;
        if (!pairRegex.test(config.customPair.trim().toUpperCase())) {
          alert('❌ Invalid pair format. Please use format like BTCUSDT, ETHUSDT, SOLUSDT');
          setStartingBot(null);
          return;
        }
      }

      // Create bot with Pablo Ready template
      const botData = {
        name: `${bot.name} - ${symbolToUse}`,
        exchange: bot.exchange as 'bybit' | 'okx',
        symbol: symbolToUse,
        tradingType: bot.trading_type as 'spot' | 'futures',
        leverage: bot.leverage,
        riskLevel: bot.risk_level as 'low' | 'medium' | 'high',
        tradeAmount: config.tradeAmount,
        stopLoss: bot.stop_loss,
        takeProfit: bot.take_profit,
        timeframe: bot.timeframe,
        strategy: bot.strategy,
        strategyConfig: bot.strategy_config,
        paperTrading: config.paperTrading,
        status: 'running' as const, // Start bot immediately as running
        pnl: 0,
        pnlPercentage: 0,
        totalTrades: 0,
        winRate: 0
      };

      const createdBot = await createBot(botData);
      
      // Bot is already set to 'running' status, but ensure it's started
      if (createdBot) {
        // If status wasn't set to running, start it explicitly
        if (createdBot.status !== 'running') {
          await startBot(createdBot.id);
        }
        
        // Trigger immediate execution to start trading right away
        try {
          console.log(`🚀 Triggering immediate execution for bot ${createdBot.id}...`);
          await executeBot(createdBot.id);
          console.log(`✅ Bot "${createdBot.name}" executed immediately`);
        } catch (execError) {
          console.warn('⚠️ Failed to trigger immediate execution (bot will start on next cron run):', execError);
          // Don't fail the whole operation - bot will still be picked up by cron
        }
        
        alert(`✅ Bot "${createdBot.name}" created and started successfully! It will begin trading immediately.`);
        navigate('/bots');
      }
    } catch (error: any) {
      console.error('Error starting bot:', error);
      alert(`❌ Failed to start bot: ${error?.message || error}`);
    } finally {
      setStartingBot(null);
    }
  };

  const updateBotConfig = (botId: string, field: 'paperTrading' | 'tradeAmount' | 'customPair', value: boolean | number | string) => {
    setBotConfigs(prev => ({
      ...prev,
      [botId]: {
        ...prev[botId],
        [field]: value
      }
    }));
  };

  // Fetch performance and logs for existing bots
  useEffect(() => {
    if (user && bots.length > 0) {
      const fetchAllData = async () => {
        try {
          const { data: userBots } = await supabase
            .from('trading_bots')
            .select('id, pnl, pnl_percentage, total_trades, win_rate, symbol, name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (userBots) {
            const performance: Record<string, {
              pnl: number;
              pnlPercentage: number;
              totalTrades: number;
              winRate: number;
              wins: number;
              losses: number;
            }> = {};

            const logsMap: Record<string, any[]> = {};

            bots.forEach(pabloBot => {
              // Find matching bot by symbol and name pattern
              const matchingBot = userBots.find(ub => 
                ub.symbol === pabloBot.symbol && 
                (ub.name.includes(pabloBot.name) || ub.name.includes(pabloBot.symbol))
              );
              
              if (matchingBot) {
                const winRate = matchingBot.win_rate || 0;
                const totalTrades = matchingBot.total_trades || 0;
                const wins = Math.round(totalTrades * (winRate / 100));
                const losses = totalTrades - wins;

                performance[pabloBot.id] = {
                  pnl: matchingBot.pnl || 0,
                  pnlPercentage: matchingBot.pnl_percentage || 0,
                  totalTrades,
                  winRate,
                  wins,
                  losses
                };

                // Fetch logs for this bot
                fetchBotLogs(pabloBot.id, matchingBot.id);
              }
            });

            setBotPerformance(prev => ({ ...prev, ...performance }));
          }
        } catch (error) {
          console.error('Error fetching bot data:', error);
        }
      };

      fetchAllData();
      
      // Refresh logs every 10 seconds
      const interval = setInterval(async () => {
        if (user && bots.length > 0) {
          try {
            const { data: userBots } = await supabase
              .from('trading_bots')
              .select('id, symbol, name')
              .eq('user_id', user.id);

            if (userBots) {
              bots.forEach(pabloBot => {
                const matchingBot = userBots.find(ub => 
                  ub.symbol === pabloBot.symbol && 
                  (ub.name.includes(pabloBot.name) || ub.name.includes(pabloBot.symbol))
                );
                if (matchingBot) {
                  fetchBotLogs(pabloBot.id, matchingBot.id);
                }
              });
            }
          } catch (error) {
            console.error('Error refreshing logs:', error);
          }
        }
      }, 10000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bots]);

  const fetchBotLogs = async (pabloBotId: string, userBotId: string) => {
    if (loadingLogs[pabloBotId]) return;
    
    try {
      setLoadingLogs(prev => ({ ...prev, [pabloBotId]: true }));
      
      const { data: logs, error } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .eq('bot_id', userBotId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;

      setBotLogs(prev => ({
        ...prev,
        [pabloBotId]: logs || []
      }));
    } catch (error) {
      console.error('Error fetching bot logs:', error);
    } finally {
      setLoadingLogs(prev => ({ ...prev, [pabloBotId]: false }));
    }
  };

  const toggleLogs = (botId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [botId]: !prev[botId]
    }));

    // Fetch logs when expanding if not already loaded
    if (!expandedLogs[botId] && !botLogs[botId]) {
      // Find matching user bot
      supabase
        .from('trading_bots')
        .select('id, symbol, name')
        .eq('user_id', user?.id)
        .then(({ data }) => {
          if (data) {
            const pabloBot = bots.find(b => b.id === botId);
            if (pabloBot) {
              const matchingBot = data.find(ub => 
                ub.symbol === pabloBot.symbol && 
                (ub.name.includes(pabloBot.name) || ub.name.includes(pabloBot.symbol))
              );
              if (matchingBot) {
                fetchBotLogs(botId, matchingBot.id);
              }
            }
          }
        });
    }
  };

  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getLogLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title="Pablo Ready" />
        <div className="pt-24 pb-20 px-4">
          <Card className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">Loading Pablo Ready bots...</p>
          </Card>
        </div>
        <Navigation />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title="Pablo Ready" />
        <div className="pt-24 pb-20 px-4">
          <Card className="p-6 border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-200">{error}</p>
            <Button className="mt-4" onClick={fetchBots} size="sm">
              Retry
            </Button>
          </Card>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <Header
        title="Pablo Ready"
        subtitle="Pre-configured trading bots ready to deploy. Choose a bot and start trading instantly."
        rightAction={
          <div className="flex space-x-2">
            <NotificationBell />
            <Button variant="secondary" size="sm" onClick={() => navigate('/bots')}>
              My Bots
            </Button>
          </div>
        }
      />

      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-6xl space-y-6">
          {bots.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <i className="ri-robot-line text-5xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Pablo Ready bots available
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Check back soon for new pre-configured bots.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bots.map((bot) => (
                <Card
                  key={bot.id}
                  className="group overflow-hidden border border-gray-200/70 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900/90"
                >
                  <div className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {bot.name}
                          </h3>
                          {bot.featured && (
                            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                              <i className="ri-star-fill mr-1"></i>
                              Featured
                            </span>
                          )}
                        </div>
                        {bot.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                            {bot.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bot Details */}
                    <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Exchange</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {bot.exchange}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Symbol</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {bot.symbol === 'CUSTOM' ? 'Custom (User Input)' : bot.symbol}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Type</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {bot.trading_type}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Leverage</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {bot.leverage}x
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Risk Level</span>
                          <span className={`font-medium capitalize ${
                            bot.risk_level === 'low' ? 'text-green-600 dark:text-green-400' :
                            bot.risk_level === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {bot.risk_level}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Timeframe</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {bot.timeframe}
                          </span>
                        </div>
                      </div>

                      {/* Strategy Features */}
                      {bot.strategy_config && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-wrap gap-2">
                            {bot.strategy_config.enable_tp === true && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                <i className="ri-target-line mr-1"></i>
                                Multi TP
                              </span>
                            )}
                            {bot.strategy_config.enable_trail_sl === true && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                                <i className="ri-line-chart-line mr-1"></i>
                                Trailing SL
                              </span>
                            )}
                            {bot.strategy_config.volume_multiplier && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                <i className="ri-bar-chart-line mr-1"></i>
                                Volume Filter
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Start Configuration */}
                    {user && (
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        {/* Paper/Real Toggle */}
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Trading Mode
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateBotConfig(bot.id, 'paperTrading', false)}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                !botConfigs[bot.id]?.paperTrading
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Real
                            </button>
                            <button
                              onClick={() => updateBotConfig(bot.id, 'paperTrading', true)}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                botConfigs[bot.id]?.paperTrading
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Paper
                            </button>
                          </div>
                        </div>

                        {/* Custom Pair Input (if bot allows it) */}
                        {(bot.strategy?.allows_custom_pair === true || bot.symbol === 'CUSTOM') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Trading Pair <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., BTCUSDT, ETHUSDT, SOLUSDT"
                              value={botConfigs[bot.id]?.customPair || ''}
                              onChange={(e) => updateBotConfig(bot.id, 'customPair', e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Enter the trading pair you want to follow (must end with USDT)
                            </p>
                          </div>
                        )}

                        {/* Trade Amount Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Trade Amount ($)
                          </label>
                          <input
                            type="number"
                            min="10"
                            step="10"
                            value={botConfigs[bot.id]?.tradeAmount || bot.trade_amount || 100}
                            onChange={(e) => updateBotConfig(bot.id, 'tradeAmount', parseFloat(e.target.value) || 100)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                          />
                        </div>

                        {/* Performance Metrics */}
                        {botPerformance[bot.id] && (
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">PnL</span>
                                <p className={`font-semibold ${
                                  botPerformance[bot.id].pnl >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  ${botPerformance[bot.id].pnl.toFixed(2)} ({botPerformance[bot.id].pnlPercentage.toFixed(2)}%)
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Win Rate</span>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {botPerformance[bot.id].winRate.toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Total Trades</span>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {botPerformance[bot.id].totalTrades}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Win/Loss</span>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  <span className="text-green-600 dark:text-green-400">{botPerformance[bot.id].wins}</span>
                                  <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                                  <span className="text-red-600 dark:text-red-400">{botPerformance[bot.id].losses}</span>
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Fees</span>
                                <p className="font-semibold text-red-600 dark:text-red-400">
                                  ${((botPerformance[bot.id].totalTrades * (bot.trade_amount || 100)) * 0.001).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Drawdown</span>
                                <p className="font-semibold text-red-600 dark:text-red-400">
                                  {botPerformance[bot.id].pnl < 0 ? `$${Math.abs(botPerformance[bot.id].pnl).toFixed(2)}` : '$0.00'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Win/Loss</span>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {botPerformance[bot.id].wins}/{botPerformance[bot.id].losses}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Start Button */}
                        <Button
                          onClick={() => handleQuickStart(bot)}
                          className="w-full"
                          size="sm"
                          disabled={startingBot === bot.id}
                        >
                          {startingBot === bot.id ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-2"></i>
                              Starting...
                            </>
                          ) : (
                            <>
                              <i className="ri-play-line mr-2"></i>
                              Start Bot
                            </>
                          )}
                        </Button>

                        {/* Bot Logs Section */}
                        {user && (
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <button
                              onClick={() => toggleLogs(bot.id)}
                              className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <span className="flex items-center gap-2">
                                <i className="ri-file-list-line"></i>
                                Activity Logs
                                {botLogs[bot.id] && botLogs[bot.id].length > 0 && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-xs">
                                    {botLogs[bot.id].length}
                                  </span>
                                )}
                              </span>
                              <i className={`ri-arrow-${expandedLogs[bot.id] ? 'up' : 'down'}-s-line`}></i>
                            </button>

                            {expandedLogs[bot.id] && (
                              <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                                {loadingLogs[bot.id] ? (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    <i className="ri-loader-4-line animate-spin text-lg mb-1"></i>
                                    <p>Loading logs...</p>
                                  </div>
                                ) : botLogs[bot.id] && botLogs[bot.id].length > 0 ? (
                                  botLogs[bot.id].map((log: any, idx: number) => (
                                    <div
                                      key={log.id || idx}
                                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs"
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getLogLevelColor(log.level)}`}>
                                          {log.level || 'info'}
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                                          {formatLogTime(log.timestamp)}
                                        </span>
                                      </div>
                                      <p className="text-gray-700 dark:text-gray-300 text-xs mt-1">
                                        {log.message}
                                      </p>
                                      {log.category && (
                                        <span className="text-gray-500 dark:text-gray-400 text-xs mt-1 block">
                                          Category: {log.category}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                                    <i className="ri-file-list-line text-lg mb-1"></i>
                                    <p>No logs yet. Bot will show activity here once it starts trading.</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sign In Prompt */}
                    {!user && (
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          onClick={() => navigate('/auth')}
                          className="w-full"
                          variant="secondary"
                          size="sm"
                        >
                          <i className="ri-login-box-line mr-2"></i>
                          Sign In to Use
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}

