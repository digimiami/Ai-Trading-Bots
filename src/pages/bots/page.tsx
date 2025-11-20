
// @ts-nocheck
import { useEffect, useState } from 'react';
import { Header } from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { ManualTradeSignal, TradingBot } from '../../types/trading';
import { useNavigate } from 'react-router-dom';
import { useBots } from '../../hooks/useBots';
import { useBotActivity } from '../../hooks/useBotActivity';
import { useBotExecutor } from '../../hooks/useBotExecutor';
import { useBotTradeLimits } from '../../hooks/useBotTradeLimits';
import { supabase } from '../../lib/supabase';

export default function BotsPage() {
  const navigate = useNavigate();
  const { bots, loading, startBot, stopBot, pauseBot, updateBot, deleteBot, createBot } = useBots();
  const { activities, addLog } = useBotActivity(bots);
  const { isExecuting, lastExecution, timeSync, executeBot, executeAllBots } = useBotExecutor();
  const [filter, setFilter] = useState<'all' | 'running' | 'paused' | 'stopped' | 'live'>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'webhook'>('overview');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [togglingAiMl, setTogglingAiMl] = useState<string | null>(null);
  const [editingLimitBotId, setEditingLimitBotId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<number | null>(null);
  const [editingTradeAmountBotId, setEditingTradeAmountBotId] = useState<string | null>(null);
  const [editingTradeAmountValue, setEditingTradeAmountValue] = useState<number | null>(null);
  const [webhookExpandedBot, setWebhookExpandedBot] = useState<string | null>(null);
  const [webhookSignals, setWebhookSignals] = useState<Record<string, ManualTradeSignal[]>>({});
  const [webhookSignalsLoading, setWebhookSignalsLoading] = useState<Record<string, boolean>>({});
  const [webhookSecretVisible, setWebhookSecretVisible] = useState<Record<string, boolean>>({});
  const [webhookActionLoading, setWebhookActionLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const isWebhookView = viewMode === 'webhook';
  
  // Get trade limits for all bots
  const botIds = bots.map(b => b.id);
  const { limits, getLimit, refresh: refreshLimits } = useBotTradeLimits(botIds);

  const webhookEndpoint = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/tradingview-webhook`;

  const generateWebhookSecret = () => {
    try {
      const array = new Uint8Array(18);
      if (window?.crypto?.getRandomValues) {
        window.crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
      }
    } catch (error) {
      console.warn('Falling back to Math.random for webhook secret generation:', error);
    }
    return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  };

  const handleCopy = async (value: string, description: string) => {
    if (!value) {
      alert('Nothing to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      alert(`✅ ${description} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy value:', error);
      alert('Unable to copy to clipboard. Please copy manually.');
    }
  };

  const loadWebhookSignals = async (botId: string) => {
    setWebhookSignalsLoading(prev => ({ ...prev, [botId]: true }));
    try {
      const { data, error } = await supabase
        .from('manual_trade_signals')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setWebhookSignals(prev => ({ ...prev, [botId]: data || [] }));
    } catch (error: any) {
      console.error('Failed to load webhook signals:', error);
      alert(`Failed to load webhook signals: ${error?.message || 'Unknown error'}`);
    } finally {
      setWebhookSignalsLoading(prev => ({ ...prev, [botId]: false }));
    }
  };

  const handleToggleWebhookPanel = async (botId: string) => {
    if (isWebhookView) {
      return;
    }
    const isOpen = webhookExpandedBot === botId;
    const nextState = isOpen ? null : botId;
    setWebhookExpandedBot(nextState);
    if (!isOpen) {
      await loadWebhookSignals(botId);
    }
  };

  const handleRegenerateWebhookSecret = async (bot: TradingBot) => {
    if (!confirm('Regenerate webhook secret? All existing TradingView alerts must be updated to use the new value.')) {
      return;
    }
    const newSecret = generateWebhookSecret();
    setWebhookActionLoading(prev => ({ ...prev, [bot.id]: true }));
    try {
      await updateBot(bot.id, { webhookSecret: newSecret });
      setWebhookSecretVisible(prev => ({ ...prev, [bot.id]: true }));
      alert('✅ Webhook secret regenerated. Update your TradingView alert settings.');
    } catch (error: any) {
      console.error('Failed to regenerate webhook secret:', error);
      alert(`Failed to regenerate webhook secret: ${error?.message || 'Unknown error'}`);
    } finally {
      setWebhookActionLoading(prev => ({ ...prev, [bot.id]: false }));
    }
  };

  const handleToggleWebhookImmediate = async (bot: TradingBot) => {
    const nextValue = !(bot.webhookTriggerImmediate ?? true);
    setWebhookActionLoading(prev => ({ ...prev, [bot.id]: true }));
    try {
      await updateBot(bot.id, { webhookTriggerImmediate: nextValue });
      alert(`✅ Immediate execution ${nextValue ? 'enabled' : 'disabled'} for TradingView webhook signals.`);
    } catch (error: any) {
      console.error('Failed to update webhook execution preference:', error);
      alert(`Failed to update webhook execution preference: ${error?.message || 'Unknown error'}`);
    } finally {
      setWebhookActionLoading(prev => ({ ...prev, [bot.id]: false }));
    }
  };

  useEffect(() => {
    if (!isWebhookView) {
      return;
    }
    bots.forEach((bot) => {
      if (!webhookSignals[bot.id] && !webhookSignalsLoading[bot.id]) {
        loadWebhookSignals(bot.id);
      }
    });
  }, [isWebhookView, bots, webhookSignals, webhookSignalsLoading]);

  /**
   * Builds the comprehensive TradingView webhook payload format for a bot.
   * This format includes all TradingView strategy variables that will be automatically
   * replaced by TradingView when the alert fires.
   * 
   * Note: When testing webhooks manually, replace template variables with actual values
   * (e.g., use 'buy' instead of '{{strategy.order.action}}').
   */
  const buildSamplePayload = (bot: TradingBot): string => {
    return JSON.stringify({
      secret: bot.webhookSecret || bot.webhook_secret || 'YOUR_TRADINGVIEW_WEBHOOK_SECRET',
      botId: bot.id,
      action: '{{strategy.order.action}}', // TradingView will replace with: 'buy', 'sell', 'long', 'short'
      marketPosition: '{{strategy.market_position}}', // Current market position: 'long', 'short', 'flat'
      prevMarketPosition: '{{strategy.prev_market_position}}', // Previous market position
      marketPositionSize: '{{strategy.market_position_size}}', // Current position size
      prevMarketPositionSize: '{{strategy.prev_market_position_size}}', // Previous position size
      instrument: '{{ticker}}', // Trading pair symbol (e.g., BTCUSDT)
      timestamp: '{{timenow}}', // Alert timestamp
      maxLag: '300', // Maximum lag in seconds
      investmentType: 'base', // Investment type: 'base' or 'quote'
      amount: '{{strategy.order.contracts}}', // Number of contracts/size
      mode: bot.paperTrading ? 'paper' : 'real', // Trading mode
      reason: 'TradingView alert signal'
    }, null, 2);
  };

  const formatDateTime = (timestamp?: string | null) => {
    if (!timestamp) return '—';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getSignalStatusBadgeClasses = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredBots = bots.filter(bot => {
    // Apply status filter
    let matchesFilter = true;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'live') matchesFilter = !bot.paperTrading;
    else matchesFilter = bot.status === filter;

    // Apply search filter
    if (!matchesFilter) return false;
    
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const botName = (bot.name || '').toLowerCase();
    const botSymbol = (bot.symbol || '').toLowerCase();
    const botExchange = (bot.exchange || '').toLowerCase();
    const botStatus = (bot.status || '').toLowerCase();
    
    return (
      botName.includes(query) ||
      botSymbol.includes(query) ||
      botExchange.includes(query) ||
      botStatus.includes(query)
    );
  });

  const resetPaperTradingPerformance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ No session available when attempting to reset paper trading performance.');
        return;
      }

      const functionUrl = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/paper-trading`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset_performance' })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || `Failed to reset paper trading performance (status ${response.status})`);
      }

      console.log('✅ Paper trading performance reset successfully via Reset All');
    } catch (error) {
      console.error('Failed to reset paper trading performance:', error);
    }
  };

  const getBotActivity = (botId: string) => {
    return activities.find(activity => activity.botId === botId);
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'success': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'market': return 'ri-line-chart-line';
      case 'trade': return 'ri-exchange-line';
      case 'strategy': return 'ri-brain-line';
      case 'system': return 'ri-settings-line';
      case 'error': return 'ri-error-warning-line';
      default: return 'ri-information-line';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleBotAction = async (botId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      console.log(`🔄 Attempting to ${action} bot ${botId} from origin: ${window.location.origin}`);
      
      if (action === 'start') {
        await startBot(botId);
        try {
          await addLog(botId, {
            level: 'success',
            category: 'system',
            message: 'Bot started successfully',
            details: { action: 'start', timestamp: new Date().toISOString() }
          });
        } catch (logError) {
          console.warn('⚠️ Failed to record start log:', logError);
        }
        alert(`✅ Bot started successfully!`);
      } else if (action === 'stop') {
        await stopBot(botId);
        try {
          await addLog(botId, {
            level: 'info',
            category: 'system',
            message: 'Bot stopped by user',
            details: { action: 'stop', timestamp: new Date().toISOString() }
          });
        } catch (logError) {
          console.warn('⚠️ Failed to record stop log:', logError);
        }
        alert(`✅ Bot stopped successfully!`);
      } else if (action === 'pause') {
        await pauseBot(botId);
        try {
          await addLog(botId, {
            level: 'warning',
            category: 'system',
            message: 'Bot paused by user',
            details: { action: 'pause', timestamp: new Date().toISOString() }
          });
        } catch (logError) {
          console.warn('⚠️ Failed to record pause log:', logError);
        }
        alert(`✅ Bot paused successfully!`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to ${action} bot:`, error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      console.error('Error details:', {
        message: errorMessage,
        stack: error?.stack,
        origin: window.location.origin,
        url: window.location.href
      });
      
      // Show user-friendly error message
      alert(`❌ Failed to ${action} bot: ${errorMessage}\n\nPlease check the browser console (F12) for more details.`);
      
      await addLog(botId, {
        level: 'error',
        category: 'error',
        message: `Failed to ${action} bot: ${errorMessage}`,
        details: { action, error: errorMessage, origin: window.location.origin }
      });
    }
  };

  const handleStartAll = async () => {
    setBulkLoading(true);
    try {
      const stoppedBots = filteredBots.filter(bot => bot.status === 'stopped' || bot.status === 'paused');
      await Promise.all(stoppedBots.map(bot => startBot(bot.id)));
    } catch (error) {
      console.error('Failed to start all bots:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleStopAll = async () => {
    setBulkLoading(true);
    try {
      const runningBots = filteredBots.filter(bot => bot.status === 'running' || bot.status === 'paused');
      await Promise.all(runningBots.map(bot => stopBot(bot.id)));
    } catch (error) {
      console.error('Failed to stop all bots:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all bot statistics? This will set PnL, trades count, and win rate to zero.')) {
      return;
    }
    setBulkLoading(true);
    try {
      await Promise.all(filteredBots.map(bot =>
        updateBot(bot.id, {
          total_trades: 0,
          win_rate: 0,
          pnl: 0,
          pnl_percentage: 0,
          last_trade_at: null
        })
      ));
      await resetPaperTradingPerformance();
      console.log('All bot statistics reset successfully');
    } catch (error) {
      console.error('Failed to reset all bots:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all bots? This action cannot be undone.')) {
      return;
    }
    setBulkLoading(true);
    try {
      await Promise.all(filteredBots.map(bot => deleteBot(bot.id)));
      console.log('All bots deleted successfully');
    } catch (error) {
      console.error('Failed to delete all bots:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePauseAll = async () => {
    if (!confirm('Are you sure you want to pause all running bots?')) {
      return;
    }
    setBulkLoading(true);
    try {
      const runningBots = filteredBots.filter(bot => bot.status === 'running');
      await Promise.all(runningBots.map(bot => pauseBot(bot.id)));
      alert(`✅ Paused ${runningBots.length} bot(s) successfully`);
    } catch (error) {
      console.error('Failed to pause all bots:', error);
      alert('❌ Failed to pause all bots. Please check console for details.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleActivateAllPaper = async () => {
    if (!confirm('Switch all bots to Paper Trading mode? This will set all bots to paper trading (simulation mode).')) {
      return;
    }
    setBulkLoading(true);
    try {
      const botsToUpdate = filteredBots.filter(bot => !bot.paperTrading);
      await Promise.all(botsToUpdate.map(bot => updateBot(bot.id, { paperTrading: true } as any)));
      alert(`✅ Switched ${botsToUpdate.length} bot(s) to Paper Trading mode`);
    } catch (error) {
      console.error('Failed to activate all paper trading:', error);
      alert('❌ Failed to switch bots to paper trading. Please check console for details.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePauseAllReal = async () => {
    if (!confirm('Pause all bots in Real Trading mode? This will pause all bots that are using real funds.')) {
      return;
    }
    setBulkLoading(true);
    try {
      const realTradingBots = filteredBots.filter(bot => !bot.paperTrading && bot.status === 'running');
      await Promise.all(realTradingBots.map(bot => pauseBot(bot.id)));
      alert(`✅ Paused ${realTradingBots.length} real trading bot(s) successfully`);
    } catch (error) {
      console.error('Failed to pause all real trading bots:', error);
      alert('❌ Failed to pause real trading bots. Please check console for details.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleActivateAllReal = async () => {
    if (!confirm('🚨 Switch all bots to REAL Trading mode? This will use LIVE FUNDS on your exchange. Are you absolutely sure?')) {
      return;
    }
    const doubleConfirm = confirm('⚠️ FINAL CONFIRMATION: This will enable REAL trading with LIVE FUNDS for all bots. Continue?');
    if (!doubleConfirm) {
      return;
    }
    setBulkLoading(true);
    try {
      const botsToUpdate = filteredBots.filter(bot => bot.paperTrading);
      await Promise.all(botsToUpdate.map(bot => updateBot(bot.id, { paperTrading: false } as any)));
      alert(`🚨 Switched ${botsToUpdate.length} bot(s) to REAL Trading mode. Trades will use live funds!`);
    } catch (error) {
      console.error('Failed to activate all real trading:', error);
      alert('❌ Failed to switch bots to real trading. Please check console for details.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Individual bot actions
  const handleResetBot = async (botId: string, botName: string) => {
    if (!confirm(`Are you sure you want to reset "${botName}" statistics? This will set PnL, trades count, and win rate to zero.`)) {
      return;
    }
    try {
      await updateBot(botId, {
        total_trades: 0,
        win_rate: 0,
        pnl: 0,
        pnl_percentage: 0,
        last_trade_at: null
      });
      console.log(`Bot "${botName}" statistics reset successfully`);
    } catch (error) {
      console.error(`Failed to reset bot "${botName}":`, error);
    }
  };

  const handleDeleteBot = async (botId: string, botName: string) => {
    if (!confirm(`Are you sure you want to delete "${botName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteBot(botId);
      console.log(`Bot "${botName}" deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete bot "${botName}":`, error);
    }
  };

  const handleCloneBot = async (bot: TradingBot) => {
    try {
      // Generate a unique name for the cloned bot
      const baseName = bot.name.replace(/\s*\(Copy(?: \d+)?\)\s*$/, ''); // Remove existing (Copy) suffix
      let newName = `${baseName} (Copy)`;
      
      // Check if a bot with this name already exists
      let copyNumber = 1;
      while (bots.some(b => b.name === newName)) {
        copyNumber++;
        newName = `${baseName} (Copy ${copyNumber})`;
      }

      // Parse strategy and strategyConfig if they're strings
      let strategy = bot.strategy || {};
      if (typeof strategy === 'string') {
        try {
          strategy = JSON.parse(strategy);
        } catch (e) {
          console.warn('Failed to parse strategy, using empty object:', e);
          strategy = {};
        }
      }

      let strategyConfig = bot.strategyConfig || bot.strategy_config || {};
      if (typeof strategyConfig === 'string') {
        try {
          strategyConfig = JSON.parse(strategyConfig);
        } catch (e) {
          console.warn('Failed to parse strategyConfig, using empty object:', e);
          strategyConfig = {};
        }
      }

      // Prepare bot data for cloning
      const clonedBotData: any = {
        name: newName,
        exchange: bot.exchange,
        tradingType: bot.tradingType || bot.trading_type || 'spot',
        symbol: bot.symbol,
        timeframe: bot.timeframe || '1h',
        leverage: bot.leverage || 1,
        riskLevel: bot.riskLevel || bot.risk_level || 'medium',
        tradeAmount: bot.tradeAmount || bot.trade_amount || 100,
        stopLoss: bot.stopLoss || bot.stop_loss || 2.0,
        takeProfit: bot.takeProfit || bot.take_profit || 4.0,
        strategy: strategy,
        strategyConfig: strategyConfig,
        paperTrading: bot.paperTrading || bot.paper_trading || false,
        status: 'stopped', // Cloned bots start as stopped
        pnl: 0,
        pnlPercentage: 0,
        totalTrades: 0,
        winRate: 0,
        lastTradeAt: null,
        aiMlEnabled: bot.aiMlEnabled || bot.ai_ml_enabled || false,
      };

      // Create the cloned bot
      const clonedBot = await createBot(clonedBotData);
      
      alert(`✅ Bot "${newName}" cloned successfully!`);
      
      // Add a log entry for the original bot
      await addLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `Bot cloned as "${newName}"`,
        details: { clonedBotId: clonedBot.id }
      });
    } catch (error: any) {
      console.error('Failed to clone bot:', error);
      alert(`❌ Failed to clone bot: ${error.message || 'Unknown error'}`);
    }
  };

  const handleEditBot = (botId: string) => {
    navigate(`/edit-bot/${botId}`);
  };

  const handleToggleAiMl = async (botId: string, currentStatus: boolean) => {
    // Prevent multiple simultaneous toggles for the same bot
    if (togglingAiMl === botId) {
      console.log('Already toggling AI/ML for this bot, please wait...');
      return;
    }

    try {
      setTogglingAiMl(botId);
      await updateBot(botId, { aiMlEnabled: !currentStatus });
      addLog(botId, {
        level: 'info',
        category: 'system',
        message: `AI/ML ${!currentStatus ? 'enabled' : 'disabled'} for bot`
      });
    } catch (error) {
      console.error('Failed to toggle AI/ML:', error);
      addLog(botId, {
        level: 'error',
        category: 'system',
        message: 'Failed to toggle AI/ML'
      });
    } finally {
      setTogglingAiMl(null);
    }
  };

  const handleTogglePaperTrading = async (bot: TradingBot) => {
    const isCurrentlyPaper = bot.paperTrading || false;
    const nextModeIsPaper = !isCurrentlyPaper;

    if (!nextModeIsPaper) {
      const prerequisites = [
        '✅ Real exchange API keys are connected and ACTIVE (non-testnet)',
        '✅ Wallets have sufficient available balance for this bot\'s trade size',
        '✅ Stop-loss, take-profit, and risk limits are reviewed for live execution',
        '✅ You understand trades will execute on your real exchange account'
      ].join('\n');

      const confirmed = window.confirm(
        `⚠️ Enable REAL trading for "${bot.name}"?\n\nBefore proceeding, make sure:\n\n${prerequisites}\n\nContinue to live trading mode?`
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      await updateBot(bot.id, { paperTrading: nextModeIsPaper } as any);

      await addLog(bot.id, {
        level: nextModeIsPaper ? 'info' : 'warning',
        category: 'system',
        message: nextModeIsPaper
          ? 'Bot switched to paper trading mode'
          : 'Bot switched to REAL trading mode',
        details: {
          paperTrading: nextModeIsPaper,
          switchedAt: new Date().toISOString()
        }
      });

      if (nextModeIsPaper) {
        alert(`✅ Bot switched to Paper Trading mode. Orders will only simulate fills for testing.`);
      } else {
        alert(
          `🚨 "${bot.name}" is now in REAL trading mode.\n\nTrades will execute on your connected exchange using live funds.`
        );
      }
    } catch (error: any) {
      console.error('Failed to toggle paper trading:', error);
      alert(`Failed to toggle trading mode: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Trading Bots"
        action={
          <div className="flex space-x-2">
            <Button
              variant="warning"
              size="sm"
              onClick={executeAllBots}
              disabled={isExecuting || filteredBots.filter(bot => bot.status === 'running').length === 0}
            >
              <i className="ri-play-circle-line mr-1"></i>
              Execute All
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleStartAll}
              disabled={bulkLoading || filteredBots.filter(bot => bot.status === 'stopped' || bot.status === 'paused').length === 0}
            >
              <i className="ri-play-line mr-1"></i>
              Start All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStopAll}
              disabled={bulkLoading || filteredBots.filter(bot => bot.status === 'running' || bot.status === 'paused').length === 0}
            >
              <i className="ri-stop-line mr-1"></i>
              Stop All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetAll}
              disabled={bulkLoading || filteredBots.length === 0}
            >
              <i className="ri-refresh-line mr-1"></i>
              Reset All
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAll}
              disabled={bulkLoading || filteredBots.length === 0}
            >
              <i className="ri-delete-bin-line mr-1"></i>
              Delete All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/create-bot')}
            >
              <i className="ri-add-line mr-1"></i>
              New Bot
            </Button>
          </div>
        }
      />
      
      <div className="pt-20 pb-4 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Bulk Actions - Paper/Real Trading */}
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-gray-700 mr-2">Bulk Actions:</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePauseAll}
                disabled={bulkLoading || filteredBots.filter(bot => bot.status === 'running').length === 0}
              >
                <i className="ri-pause-line mr-1"></i>
                Pause All
              </Button>
              <Button
                variant="info"
                size="sm"
                onClick={handleActivateAllPaper}
                disabled={bulkLoading || filteredBots.filter(bot => !bot.paperTrading).length === 0}
              >
                <i className="ri-edit-box-line mr-1"></i>
                Activate All Paper
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={handlePauseAllReal}
                disabled={bulkLoading || filteredBots.filter(bot => !bot.paperTrading && bot.status === 'running').length === 0}
              >
                <i className="ri-pause-circle-line mr-1"></i>
                Pause All Real
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleActivateAllReal}
                disabled={bulkLoading || filteredBots.filter(bot => bot.paperTrading).length === 0}
              >
                <i className="ri-money-dollar-circle-line mr-1"></i>
                Activate All Real
              </Button>
            </div>
          </Card>
        </div>
      </div>
      
      <div className="pb-20 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Execution Status */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isExecuting ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {isExecuting ? 'Executing...' : 'Ready'}
                  </span>
                </div>
                {lastExecution && (
                  <div className="text-xs text-gray-500">
                    Last execution: {new Date(lastExecution).toLocaleTimeString()}
                  </div>
                )}
                {timeSync && (
                  <div className="text-xs text-gray-500">
                    Time sync: {timeSync.offset > 0 ? '+' : ''}{timeSync.offset}ms
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Auto-execution every 5 minutes
              </div>
            </div>
          </Card>

          {/* Search Bar */}
          <Card className="p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ri-search-line text-gray-400"></i>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bots by name, symbol, exchange, or status..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line"></i>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-600">
                Found {filteredBots.length} bot{filteredBots.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </div>
            )}
          </Card>

          {/* Filter Tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'running', label: 'Running' },
              { id: 'paused', label: 'Paused' },
              { id: 'stopped', label: 'Stopped' },
              { id: 'live', label: 'Live Trading' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setFilter(option.id as typeof filter)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  filter === option.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex space-x-2 overflow-x-auto">
            {[
              { id: 'overview', label: 'Bot Overview' },
              { id: 'webhook', label: 'TradingView Webhooks' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as 'overview' | 'webhook')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  viewMode === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bot List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bots...</p>
              </div>
            ) : filteredBots.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-robot-line text-4xl text-gray-400 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bots found</h3>
                <p className="text-gray-500 mb-4">Create your first trading bot to get started</p>
                <Button onClick={() => navigate('/create-bot')}>
                  <i className="ri-add-line mr-2"></i>
                  Create Bot
                </Button>
              </div>
            ) : (
              filteredBots.map((bot) => (
              <Card key={bot.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className={`${bot.exchange === 'bybit' ? 'ri-currency-line' : 'ri-exchange-line'} text-blue-600 text-xl`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                      <p className="text-sm text-gray-500">
                        {bot.symbols && bot.symbols.length > 1 
                          ? `${bot.symbols.join(', ')} (${bot.symbols.length} pairs)` 
                          : bot.symbol} • {bot.exchange.toUpperCase()}
                      </p>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bot.status)}`}>
                          {bot.status}
                        </span>
                        <span className={`text-xs font-medium ${getRiskColor(bot.riskLevel)}`}>
                          {bot.riskLevel} risk
                        </span>
                        {(() => {
                          const limit = getLimit(bot.id);
                          if (limit && limit.isLimitReached) {
                            return (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
                                <i className="ri-alert-line"></i>
                                Limit Reached
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
                    </p>
                    <p className={`text-sm ${(bot.pnlPercentage ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(bot.pnlPercentage ?? 0) >= 0 ? '+' : ''}{(bot.pnlPercentage ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Trade Limit Status */}
                {!isWebhookView && (() => {
                  const limit = getLimit(bot.id);
                  if (limit) {
                    return (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Daily Trades:</span>
                            <span className={`text-sm font-semibold ${
                              limit.isLimitReached ? 'text-red-600' : 
                              limit.tradesToday / limit.maxTradesPerDay > 0.8 ? 'text-yellow-600' : 
                              'text-green-600'
                            }`}>
                              {limit.tradesToday} / {limit.maxTradesPerDay}
                            </span>
                            {limit.isLimitReached && (
                              <span className="text-xs text-red-600">(Limit Reached)</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (editingLimitBotId === bot.id) {
                                setEditingLimitBotId(null);
                                setEditingLimitValue(null);
                              } else {
                                setEditingLimitBotId(bot.id);
                                setEditingLimitValue(limit.maxTradesPerDay);
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            title="Edit max trades per day"
                          >
                            <i className="ri-edit-line"></i>
                            Edit Limit
                          </button>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              limit.isLimitReached ? 'bg-red-500' : 
                              limit.tradesToday / limit.maxTradesPerDay > 0.8 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ 
                              width: `${Math.min(100, (limit.tradesToday / limit.maxTradesPerDay) * 100)}%` 
                            }}
                          ></div>
                        </div>

                        {/* Inline Editor */}
                        {editingLimitBotId === bot.id && (
                          <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <label className="text-xs font-medium text-gray-700">
                                Max Trades Per Day:
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                value={editingLimitValue || limit.maxTradesPerDay}
                                onChange={(e) => setEditingLimitValue(parseInt(e.target.value) || 1)}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (editingLimitValue && editingLimitValue > 0) {
                                    try {
                                      // Get current strategyConfig from bot or use default
                                      let currentConfig: any = {};
                                      
                                      // Try to parse strategyConfig if it exists
                                      if (bot.strategyConfig) {
                                        if (typeof bot.strategyConfig === 'string') {
                                          try {
                                            currentConfig = JSON.parse(bot.strategyConfig);
                                          } catch (e) {
                                            console.warn('Failed to parse strategyConfig:', e);
                                            currentConfig = {};
                                          }
                                        } else {
                                          currentConfig = { ...bot.strategyConfig };
                                        }
                                      }
                                      
                                      // Update max_trades_per_day
                                      // Ensure required fields have defaults if missing
                                      const updatedConfig = {
                                        bias_mode: currentConfig.bias_mode || 'auto',
                                        regime_mode: currentConfig.regime_mode || 'auto',
                                        htf_timeframe: currentConfig.htf_timeframe || '4h',
                                        ...currentConfig,
                                        max_trades_per_day: editingLimitValue
                                      };
                                      
                                      console.log('Updating strategyConfig:', updatedConfig);
                                      
                                      // Update bot with merged strategyConfig
                                      await updateBot(bot.id, {
                                        strategyConfig: updatedConfig
                                      } as any);
                                      
                                      setEditingLimitBotId(null);
                                      setEditingLimitValue(null);
                                      
                                      // Refresh limits after a short delay to allow DB to update
                                      setTimeout(async () => {
                                        await refreshLimits();
                                        // Also refresh bot list
                                        window.location.reload(); // Simple way to refresh bot data
                                      }, 500);
                                      
                                      alert(`✅ Max trades per day updated to ${editingLimitValue}`);
                                    } catch (error: any) {
                                      console.error('Error updating limit:', error);
                                      const errorMsg = error?.message || 'Failed to update limit. Please try again.';
                                      alert(`Failed to update limit: ${errorMsg}`);
                                    }
                                  }
                                }}
                                className="text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingLimitBotId(null);
                                  setEditingLimitValue(null);
                                }}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Trade Amount */}
                {!isWebhookView && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Trade Amount:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ${(bot.tradeAmount || 100).toFixed(2)} USD
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (editingTradeAmountBotId === bot.id) {
                          setEditingTradeAmountBotId(null);
                          setEditingTradeAmountValue(null);
                        } else {
                          setEditingTradeAmountBotId(bot.id);
                          setEditingTradeAmountValue(bot.tradeAmount || 100);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title="Edit trade amount"
                    >
                      <i className="ri-edit-line"></i>
                      Edit Amount
                    </button>
                  </div>
                  
                  {/* Estimated Order Value */}
                  <p className="text-xs text-gray-500 mb-2">
                    Est. Order Value: ${((bot.tradeAmount || 100) * bot.leverage * 1.5).toFixed(2)} USD
                    <span className="ml-2 text-gray-400">
                      (Amount × Leverage {bot.leverage}x × 1.5 buffer)
                    </span>
                  </p>

                  {/* Inline Editor */}
                  {editingTradeAmountBotId === bot.id && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs font-medium text-gray-700">
                          Trade Amount (USD):
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="10000"
                          step="10"
                          value={editingTradeAmountValue || bot.tradeAmount || 100}
                          onChange={(e) => setEditingTradeAmountValue(parseFloat(e.target.value) || 10)}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="mb-2">
                        <p className="text-xs text-gray-600">
                          New Est. Order Value: ${((editingTradeAmountValue || bot.tradeAmount || 100) * bot.leverage * 1.5).toFixed(2)} USD
                        </p>
                        {(editingTradeAmountValue || bot.tradeAmount || 100) > 100 && (
                          <p className="text-xs text-yellow-600 mt-1">
                            ⚠️ Higher amounts may require more balance
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (editingTradeAmountValue && editingTradeAmountValue >= 10 && editingTradeAmountValue <= 10000) {
                              try {
                                await updateBot(bot.id, {
                                  tradeAmount: editingTradeAmountValue
                                } as any);
                                
                                setEditingTradeAmountBotId(null);
                                setEditingTradeAmountValue(null);
                                
                                // Refresh bot list after a short delay
                                setTimeout(() => {
                                  window.location.reload();
                                }, 500);
                                
                                alert(`✅ Trade amount updated to $${editingTradeAmountValue.toFixed(2)}`);
                              } catch (error: any) {
                                console.error('Error updating trade amount:', error);
                                const errorMsg = error?.message || 'Failed to update trade amount. Please try again.';
                                alert(`Failed to update trade amount: ${errorMsg}`);
                              }
                            } else {
                              alert('Please enter a valid trade amount between $10 and $10,000');
                            }
                          }}
                          className="text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingTradeAmountBotId(null);
                            setEditingTradeAmountValue(null);
                          }}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Bot Stats */}
                {!isWebhookView && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trades</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{bot.totalTrades ?? 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{(bot.winRate ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Win/Loss</p>
                    {(() => {
                      const totalTrades = bot.totalTrades ?? 0;
                      const closedTrades = bot.closedTrades ?? totalTrades;
                      const wins = bot.winTrades ?? (closedTrades > 0 ? Math.round((closedTrades * (bot.winRate ?? 0)) / 100) : 0);
                      const losses = bot.lossTrades ?? Math.max(0, closedTrades - wins);
                      return (
                        <p className="font-semibold text-gray-900 dark:text-white">
                          <span className="text-green-600 dark:text-green-400">{wins}</span>
                          <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                          <span className="text-red-600 dark:text-red-400">{losses}</span>
                        </p>
                      );
                    })()}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Fees</p>
                    {(() => {
                      const rawFees = bot.totalFees ?? bot.total_fees ?? bot.fees ?? 0;
                      const feesValue = Number.isFinite(rawFees) ? rawFees : 0;
                      const signPrefix = feesValue > 0 ? '-' : '';
                      const displayValue = Math.abs(feesValue);
                      return (
                        <p className={`font-semibold ${displayValue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {signPrefix}${displayValue.toFixed(2)}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Drawdown</p>
                    {(() => {
                      const rawDrawdown = bot.drawdown ?? bot.maxDrawdown ?? 0;
                      const drawdownValue = Number.isFinite(rawDrawdown) ? Math.abs(rawDrawdown) : 0;
                      const rawDrawdownPct = bot.drawdownPercentage ?? bot.drawdown_percentage ?? 0;
                      const drawdownPct = Number.isFinite(rawDrawdownPct) ? Math.abs(rawDrawdownPct) : 0;
                      return (
                        <div>
                          <p className={`font-semibold ${drawdownValue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {drawdownValue > 0 ? '-' : ''}${drawdownValue.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{drawdownPct.toFixed(1)}%</p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">PnL</p>
                    {(() => {
                      const pnlValue = bot.realizedPnl !== undefined ? bot.realizedPnl : (bot.pnl ?? 0);
                      return (
                        <p className={`font-semibold ${pnlValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                )}

                {/* Bot Activity Logs */}
                {!isWebhookView && (() => {
                  const activity = getBotActivity(bot.id);
                  const recentLogs = activity?.logs.slice(0, 3) || [];
                  
                  return (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Recent Activity</h4>
                        <button
                          onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {expandedBot === bot.id ? 'Hide' : 'Show All'}
                        </button>
                      </div>
                      
                      {/* Activity Stats */}
                      {activity && (
                        <div className="flex space-x-4 mb-3 text-xs">
                          <span className="text-green-600">✓ {activity.successCount}</span>
                          <span className="text-yellow-600">⚠ {activity.logs.filter(l => l.level === 'warning').length}</span>
                          <span className="text-red-600">✗ {activity.errorCount}</span>
                          <span className="text-gray-500">📊 {activity.logs.length} total</span>
                        </div>
                      )}

                      {/* Recent Logs */}
                      <div className="space-y-2">
                        {recentLogs.length === 0 ? (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            <i className="ri-file-list-line text-lg mb-1"></i>
                            <p>No activity logs yet</p>
                          </div>
                        ) : (
                          recentLogs.map((log) => (
                            <div key={log.id} className="flex items-start space-x-2 p-2 bg-gray-50 rounded text-xs">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${getLogLevelColor(log.level)}`}>
                                <i className={`${getCategoryIcon(log.category)} text-xs`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${getLogLevelColor(log.level)}`}>
                                    {log.level}
                                  </span>
                                  <span className="text-gray-500">{formatTime(log.timestamp)}</span>
                                </div>
                                <p className="text-gray-700 mt-1 truncate">{log.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Expanded Logs */}
                      {expandedBot === bot.id && activity && activity.logs.length > 3 && (
                        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                          {activity.logs.slice(3).map((log) => (
                            <div key={log.id} className="flex items-start space-x-2 p-2 bg-gray-50 rounded text-xs">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${getLogLevelColor(log.level)}`}>
                                <i className={`${getCategoryIcon(log.category)} text-xs`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${getLogLevelColor(log.level)}`}>
                                    {log.level}
                                  </span>
                                  <span className="text-gray-500">{formatTime(log.timestamp)}</span>
                                </div>
                                <p className="text-gray-700 mt-1">{log.message}</p>
                                {log.details && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Details</summary>
                                    <pre className="mt-1 p-1 bg-white rounded border text-xs overflow-x-auto">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* TradingView Webhook Management */}
                {(() => {
                  const showWebhookPanel = isWebhookView || webhookExpandedBot === bot.id;
                  return (
                <div className={`pt-4 border-t border-gray-100 ${isWebhookView ? 'bg-blue-50 rounded-lg border-blue-100' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <i className="ri-link-m text-blue-500"></i>
                      <h4 className="text-sm font-medium text-gray-700">TradingView Webhook</h4>
                    </div>
                    {isWebhookView ? (
                      <span className="text-xs uppercase font-semibold text-blue-500 tracking-wide">
                        Webhook Dashboard
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleWebhookPanel(bot.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <i className={`ri-${webhookExpandedBot === bot.id ? 'arrow-up-s-line' : 'arrow-down-s-line'}`}></i>
                        {webhookExpandedBot === bot.id ? 'Hide' : 'Manage'}
                      </button>
                    )}
                  </div>

                  {showWebhookPanel && (
                    <div className={`mt-3 space-y-4 ${isWebhookView ? 'bg-white border border-blue-100' : 'bg-blue-50 border border-blue-100'} rounded-lg p-4`}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase font-semibold text-gray-500">Webhook Secret</p>
                          <div className="mt-1 font-mono text-sm bg-white border border-gray-200 rounded px-3 py-2 flex items-center justify-between">
                            <span className="truncate pr-3">
                              {webhookSecretVisible[bot.id] ? (bot.webhookSecret || 'Not set yet') : '••••••••••••••••'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setWebhookSecretVisible(prev => ({ ...prev, [bot.id]: !prev[bot.id] }))
                              }
                            >
                              <i className="ri-eye-line mr-1"></i>
                              {webhookSecretVisible[bot.id] ? 'Hide' : 'Reveal'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!bot.webhookSecret}
                              onClick={() => handleCopy(bot.webhookSecret || '', 'Webhook secret')}
                            >
                              <i className="ri-file-copy-line mr-1"></i>
                              Copy Secret
                            </Button>
                            <Button
                              variant="warning"
                              size="sm"
                              disabled={webhookActionLoading[bot.id]}
                              onClick={() => handleRegenerateWebhookSecret(bot)}
                            >
                              {webhookActionLoading[bot.id] ? (
                                <span className="flex items-center gap-1">
                                  <i className="ri-loader-4-line animate-spin"></i>
                                  Updating...
                                </span>
                              ) : (
                                <>
                                  <i className="ri-refresh-line mr-1"></i>
                                  Regenerate
                                </>
                              )}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Regenerating the secret invalidates existing TradingView alerts—remember to update them.
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase font-semibold text-gray-500">Webhook URL</p>
                          <div className="mt-1 font-mono text-sm bg-white border border-gray-200 rounded px-3 py-2 flex items-center justify-between">
                            <span className="truncate pr-3">{webhookEndpoint}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCopy(webhookEndpoint, 'Webhook URL')}
                            >
                              <i className="ri-file-copy-line mr-1"></i>
                              Copy URL
                            </Button>
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase font-semibold text-gray-500">Immediate Execution</span>
                              <button
                                onClick={() => handleToggleWebhookImmediate(bot)}
                                disabled={webhookActionLoading[bot.id]}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  webhookActionLoading[bot.id] ? 'opacity-50 cursor-not-allowed' : ''
                                } ${bot.webhookTriggerImmediate ? 'bg-blue-600' : 'bg-gray-300'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    bot.webhookTriggerImmediate ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              When enabled, the webhook calls bot-executor immediately after logging the signal.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-semibold text-gray-600 uppercase">TradingView Alert Payload</h5>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCopy(buildSamplePayload(bot), 'Alert payload JSON')}
                            >
                              <i className="ri-code-line mr-1"></i>
                              Copy JSON
                            </Button>
                          </div>
                        </div>
                        <pre className="bg-white border border-gray-200 rounded p-3 text-xs overflow-x-auto">
{buildSamplePayload(bot)}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-semibold text-gray-600 uppercase">Recent Webhook Signals</h5>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => loadWebhookSignals(bot.id)}
                              disabled={webhookSignalsLoading[bot.id]}
                            >
                              {webhookSignalsLoading[bot.id] ? (
                                <span className="flex items-center gap-1">
                                  <i className="ri-loader-4-line animate-spin"></i>
                                  Refreshing...
                                </span>
                              ) : (
                                <>
                                  <i className="ri-refresh-line mr-1"></i>
                                  Refresh
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {webhookSignalsLoading[bot.id] ? (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <i className="ri-loader-4-line animate-spin"></i>
                            Loading signals...
                          </div>
                        ) : webhookSignals[bot.id] && webhookSignals[bot.id].length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <thead className="bg-gray-100 text-gray-600 uppercase">
                                <tr>
                                  <th className="px-3 py-2 text-left">Created</th>
                                  <th className="px-3 py-2 text-left">Side</th>
                                  <th className="px-3 py-2 text-left">Mode</th>
                                  <th className="px-3 py-2 text-right">Size x</th>
                                  <th className="px-3 py-2 text-left">Reason</th>
                                  <th className="px-3 py-2 text-left">Status</th>
                                  <th className="px-3 py-2 text-left">Processed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {webhookSignals[bot.id].map(signal => (
                                  <tr key={signal.id} className="border-t border-gray-100">
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                      {formatDateTime(signal.created_at)}
                                    </td>
                                    <td className="px-3 py-2 uppercase font-semibold text-gray-700">
                                      {signal.side || '—'}
                                    </td>
                                    <td className="px-3 py-2 capitalize text-gray-700">{signal.mode}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {(signal.size_multiplier ?? 1).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {signal.reason || '—'}
                                      {signal.error && (
                                        <div className="text-red-600 mt-1">Error: {signal.error}</div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${getSignalStatusBadgeClasses(signal.status)}`}>
                                        {signal.status.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {signal.processed_at ? formatDateTime(signal.processed_at) : 'Pending'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <i className="ri-information-line"></i>
                            No webhook signals recorded yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* Bot Actions */}
                {!isWebhookView && (
                <div className="pt-4 border-t border-gray-100">
                  {/* Primary Actions Row */}
                  <div className="flex space-x-2 mb-2">
                    {bot.status === 'running' ? (
                      <>
                        <Button 
                          variant="warning" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => executeBot(bot.id)}
                          disabled={isExecuting}
                        >
                          <i className="ri-play-circle-line mr-1"></i>
                          Execute
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleBotAction(bot.id, 'pause')}
                        >
                          <i className="ri-pause-line mr-1"></i>
                          Pause
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="success" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleBotAction(bot.id, 'start')}
                      >
                        <i className="ri-play-line mr-1"></i>
                        Start
                      </Button>
                    )}
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => handleBotAction(bot.id, 'stop')}
                    >
                      <i className="ri-stop-line"></i>
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => navigate('/bot-activity')}
                    >
                      <i className="ri-file-list-line"></i>
                    </Button>
                  </div>
                  
                  {/* AI/ML Toggle */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <i className="ri-brain-line text-purple-600"></i>
                      <span className="text-sm font-medium text-gray-700">AI/ML System</span>
                    </div>
                    <button
                      onClick={() => handleToggleAiMl(bot.id, bot.aiMlEnabled || false)}
                      disabled={togglingAiMl === bot.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        togglingAiMl === bot.id ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        bot.aiMlEnabled ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bot.aiMlEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Paper Trading Toggle */}
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      bot.paperTrading
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200 shadow-inner'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                      <i className={`ri-${bot.paperTrading ? 'edit-box-line' : 'money-dollar-circle-line'} text-yellow-600`}></i>
                      <span className="text-sm font-medium text-gray-700">
                        {bot.paperTrading ? '📝 Paper Trading' : '💰 Real Trading'}
                      </span>
                      </div>
                      {!bot.paperTrading && (
                        <div className="flex items-center mt-1 text-xs font-semibold text-red-600 uppercase tracking-wide">
                          <span className="relative flex h-2.5 w-2.5 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                          Live Trading Active
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleTogglePaperTrading(bot)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        bot.paperTrading ? 'bg-yellow-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bot.paperTrading ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Management Actions Row */}
                  <div className="flex space-x-2">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditBot(bot.id)}
                    >
                      <i className="ri-edit-line mr-1"></i>
                      Edit
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleCloneBot(bot)}
                      title="Clone this bot with all settings"
                    >
                      <i className="ri-file-copy-line mr-1"></i>
                      Clone
                    </Button>
                    <Button 
                      variant="warning" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleResetBot(bot.id, bot.name)}
                    >
                      <i className="ri-refresh-line mr-1"></i>
                      Reset
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleDeleteBot(bot.id, bot.name)}
                    >
                      <i className="ri-delete-bin-line mr-1"></i>
                      Delete
                    </Button>
                  </div>
                </div>
                )}
              </Card>
              ))
            )}
          </div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
