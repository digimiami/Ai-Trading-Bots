
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
import { useSoundNotifications } from '../../hooks/useSoundNotifications';
import { supabase, getAuthTokenFast } from '../../lib/supabase';
import DropdownMenu, { DropdownMenuItem } from '../../components/ui/DropdownMenu';
import HelpTooltip from '../../components/ui/HelpTooltip';
import BotShareCard from '../../components/bot/BotShareCard';

export default function BotsPage() {
  const navigate = useNavigate();
  const { bots, loading, fetchBots, startBot, stopBot, pauseBot, updateBot, deleteBot, createBot, getBotById } = useBots();
  const { playTestSound } = useSoundNotifications();
  const { activities, addLog } = useBotActivity(bots);
  const { isExecuting, lastExecution, timeSync, executeBot, executeAllBots } = useBotExecutor();
  const [filter, setFilter] = useState<'all' | 'running' | 'paused' | 'stopped' | 'live' | 'paper'>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'webhook'>('overview');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [togglingAiMl, setTogglingAiMl] = useState<string | null>(null);
  const [editingLimitBotId, setEditingLimitBotId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<number | null>(null);
  const [editingTradeAmountBotId, setEditingTradeAmountBotId] = useState<string | null>(null);
  const [editingTradeAmountValue, setEditingTradeAmountValue] = useState<number | null>(null);
  const [editingCooldownBotId, setEditingCooldownBotId] = useState<string | null>(null);
  const [editingCooldownValue, setEditingCooldownValue] = useState<number | null>(null);
  const [webhookExpandedBot, setWebhookExpandedBot] = useState<string | null>(null);
  const [webhookSignals, setWebhookSignals] = useState<Record<string, ManualTradeSignal[]>>({});
  const [webhookSignalsLoading, setWebhookSignalsLoading] = useState<Record<string, boolean>>({});
  const [webhookSecretVisible, setWebhookSecretVisible] = useState<Record<string, boolean>>({});
  const [webhookActionLoading, setWebhookActionLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneBotId, setCloneBotId] = useState('');
  const [cloning, setCloning] = useState(false);
  const [sharingBotId, setSharingBotId] = useState<string | null>(null);
  const [expandedErrorBotId, setExpandedErrorBotId] = useState<string | null>(null);
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

  const getSentiment = (rsi?: number, adx?: number) => {
    if (rsi === undefined) return null;
    
    let label = "Neutral";
    let color = "text-gray-500";
    let bg = "bg-gray-100";
    let icon = "ri-side-bar-line";
    
    if (rsi > 70) {
      label = "Overbought (Bearish)";
      color = "text-red-700";
      bg = "bg-red-100";
      icon = "ri-arrow-down-circle-line";
    } else if (rsi < 30) {
      label = "Oversold (Bullish)";
      color = "text-green-700";
      bg = "bg-green-100";
      icon = "ri-arrow-up-circle-line";
    } else if (rsi > 60) {
      label = "Bullish Momentum";
      color = "text-green-600";
      bg = "bg-green-50";
      icon = "ri-funds-line";
    } else if (rsi < 40) {
      label = "Bearish Momentum";
      color = "text-red-600";
      bg = "bg-red-50";
      icon = "ri-funds-box-line";
    }
    
    let trend = "";
    if (adx !== undefined) {
      if (adx > 35) {
        trend = "Strong Trend";
      } else if (adx > 25) {
        trend = "Trending";
      } else if (adx < 20) {
        trend = "Ranging";
      }
    }
    
    return { label, color, bg, icon, trend };
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
    else if (filter === 'paper') matchesFilter = bot.paperTrading === true;
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

  // Get current cooldown_bars from bot's strategy_config
  const getCurrentCooldownBars = (bot: TradingBot): number => {
    let strategyConfig = bot.strategyConfig || bot.strategy_config || {};
    if (typeof strategyConfig === 'string') {
      try {
        strategyConfig = JSON.parse(strategyConfig);
      } catch (e) {
        return 8; // Default
      }
    }
    return strategyConfig?.cooldown_bars !== undefined && strategyConfig?.cooldown_bars !== null
      ? strategyConfig.cooldown_bars
      : 8; // Default: 8 bars if not specified
  };

  // Extract cooldown information from bot logs
  const getCooldownInfo = (bot: TradingBot) => {
    const activity = getBotActivity(bot.id);
    if (!activity || !activity.logs) return null;

    // Look for cooldown messages in recent logs
    const cooldownLog = activity.logs.find(log => 
      log.message && (
        log.message.includes('Cooldown active:') || 
        log.message.includes('cooldown active:')
      )
    );

    if (!cooldownLog) return null;

    // Parse cooldown message: "Cooldown active: X/Y bars passed since last trade"
    const message = cooldownLog.message;
    const match = message.match(/(\d+)\/(\d+)\s+bars/);
    if (!match) return null;

    const barsPassed = parseInt(match[1], 10);
    const requiredBars = parseInt(match[2], 10);
    const progress = Math.min(100, (barsPassed / requiredBars) * 100);

    return {
      barsPassed,
      requiredBars,
      progress,
      isActive: barsPassed < requiredBars
    };
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

  const handleExecute = async (botId: string) => {
    if (isExecuting) {
      return; // Prevent multiple simultaneous executions
    }

    try {
      // Get bot details from database to get user_id and status
      const { data: botData, error: botError } = await supabase
        .from('trading_bots')
        .select('id, user_id, name, symbol, exchange, trading_type, status, paper_trading')
        .eq('id', botId)
        .single();

      if (botError || !botData) {
        throw new Error(`Failed to fetch bot: ${botError?.message || 'Bot not found'}`);
      }

      if (botData.status !== 'running') {
        alert(`❌ Bot is not running. Current status: ${botData.status}`);
        return;
      }

      // Determine mode based on bot's paper trading setting
      const mode: 'real' | 'paper' = botData.paper_trading ? 'paper' : 'real';

      // Create manual trade signal with status 'pending'
      const { data: signalData, error: signalError } = await supabase
        .from('manual_trade_signals')
        .insert({
          bot_id: botId,
          user_id: botData.user_id,
          mode: mode,
          side: 'buy', // Default to buy - bot executor will use strategy if needed
          size_multiplier: 1.0,
          reason: `Manual execute from UI (${mode.toUpperCase()})`,
          status: 'pending'
        })
        .select()
        .single();

      if (signalError || !signalData) {
        throw new Error(`Failed to create trade signal: ${signalError?.message || 'Unknown error'}`);
      }

      console.log(`✅ Manual trade signal created: ${signalData.id}`);

      // Trigger bot executor to process the signal
      await executeBot(botId);
      
      // Refresh webhook signals if panel is open
      if (webhookExpandedBot === botId || isWebhookView) {
        await loadWebhookSignals(botId);
      }
    } catch (error: any) {
      console.error('Failed to execute bot:', error);
      alert(`❌ Failed to execute bot: ${error?.message || 'Unknown error'}`);
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

  const handleRefreshStats = async () => {
    setRefreshing(true);
    try {
      // Call the refresh-stats action to recalculate and update stats for all active bots
      let accessToken = await getAuthTokenFast();
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token ?? null;
      }
      if (!accessToken) {
        throw new Error('No active session');
      }
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=refresh-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh stats: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Bot statistics refreshed:', data);

      // Refresh bot data to show updated stats
      await fetchBots();
      
      // Also refresh trade limits if needed
      if (refreshLimits) {
        await refreshLimits();
      }
      
      alert(`Successfully refreshed statistics for ${data.updated || 0} bot(s)`);
    } catch (error) {
      console.error('Failed to refresh bot statistics:', error);
      alert('Failed to refresh bot statistics. Please try again.');
    } finally {
      setRefreshing(false);
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
      const botsToUpdate = filteredBots.filter(bot => {
        // Check both paperTrading and paper_trading properties
        const isPaper = bot.paperTrading || (bot as any).paper_trading || false;
        return !isPaper;
      });
      
      if (botsToUpdate.length === 0) {
        alert('ℹ️ All bots are already in Paper Trading mode.');
        setBulkLoading(false);
        return;
      }

      console.log(`🔄 Switching ${botsToUpdate.length} bot(s) to Paper Trading mode...`);
      
      const results = await Promise.allSettled(
        botsToUpdate.map(bot => updateBot(bot.id, { paperTrading: true } as any))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        console.error('Some bots failed to update:', results.filter(r => r.status === 'rejected'));
        alert(`⚠️ Updated ${successful} bot(s) to Paper Trading mode. ${failed} bot(s) failed. Check console for details.`);
      } else {
        alert(`✅ Successfully switched ${successful} bot(s) to Paper Trading mode`);
      }
    } catch (error: any) {
      console.error('Failed to activate all paper trading:', error);
      alert(`❌ Failed to switch bots to paper trading: ${error?.message || 'Unknown error'}. Please check console for details.`);
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
      const botsToUpdate = filteredBots.filter(bot => {
        // Check both paperTrading and paper_trading properties
        const isPaper = bot.paperTrading || (bot as any).paper_trading || false;
        return isPaper;
      });
      
      if (botsToUpdate.length === 0) {
        alert('ℹ️ All bots are already in Real Trading mode.');
        setBulkLoading(false);
        return;
      }

      console.log(`🔄 Switching ${botsToUpdate.length} bot(s) to Real Trading mode...`);
      
      const results = await Promise.allSettled(
        botsToUpdate.map(bot => updateBot(bot.id, { paperTrading: false } as any))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        console.error('Some bots failed to update:', results.filter(r => r.status === 'rejected'));
        alert(`⚠️ Updated ${successful} bot(s) to Real Trading mode. ${failed} bot(s) failed. Check console for details.`);
      } else {
        alert(`🚨 Successfully switched ${successful} bot(s) to REAL Trading mode. Trades will use live funds!`);
      }
    } catch (error: any) {
      console.error('Failed to activate all real trading:', error);
      alert(`❌ Failed to switch bots to real trading: ${error?.message || 'Unknown error'}. Please check console for details.`);
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

  const handleCloneBotById = async () => {
    if (!cloneBotId.trim()) {
      alert('Please enter a bot ID');
      return;
    }

    setCloning(true);
    try {
      // Fetch the bot by ID (can be from any user)
      const sourceBot = await getBotById(cloneBotId.trim());
      
      if (!sourceBot) {
        alert('❌ Bot not found. Please check the bot ID.');
        return;
      }

      // Clone the bot
      await handleCloneBot(sourceBot);
      
      // Reset form
      setCloneBotId('');
      setShowCloneModal(false);
    } catch (error: any) {
      console.error('Failed to clone bot by ID:', error);
      alert(`❌ Failed to clone bot: ${error.message || 'Unknown error'}`);
    } finally {
      setCloning(false);
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
        '✅ Real exchange API keys are connected and ACTIVE',
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
          <>
            {/* Desktop: Show all buttons */}
            <div className="hidden md:flex space-x-2">
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
                variant="info"
                size="sm"
                onClick={() => setShowCloneModal(true)}
                title="Clone a bot by ID from any user"
              >
                <i className="ri-file-copy-2-line mr-1"></i>
                Clone by ID
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

            {/* Mobile: Dropdown menu with all actions */}
            <div className="md:hidden">
              <DropdownMenu
                trigger={
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation">
                    <i className="ri-more-2-line text-xl text-gray-600 dark:text-gray-300"></i>
                  </button>
                }
                items={[
                  {
                    label: 'Execute All',
                    icon: 'ri-play-circle-line',
                    onClick: executeAllBots,
                    disabled: isExecuting || filteredBots.filter(bot => bot.status === 'running').length === 0,
                  },
                  {
                    label: 'Start All',
                    icon: 'ri-play-line',
                    onClick: handleStartAll,
                    disabled: bulkLoading || filteredBots.filter(bot => bot.status === 'stopped' || bot.status === 'paused').length === 0,
                  },
                  {
                    label: 'Stop All',
                    icon: 'ri-stop-line',
                    onClick: handleStopAll,
                    disabled: bulkLoading || filteredBots.filter(bot => bot.status === 'running' || bot.status === 'paused').length === 0,
                  },
                  {
                    label: 'Clone by ID',
                    icon: 'ri-file-copy-2-line',
                    onClick: () => setShowCloneModal(true),
                  },
                  {
                    label: 'Reset All',
                    icon: 'ri-refresh-line',
                    onClick: handleResetAll,
                    disabled: bulkLoading || filteredBots.length === 0,
                  },
                  {
                    label: 'Delete All',
                    icon: 'ri-delete-bin-line',
                    onClick: handleDeleteAll,
                    disabled: bulkLoading || filteredBots.length === 0,
                    danger: true,
                  },
                  { divider: true },
                  {
                    label: 'New Bot',
                    icon: 'ri-add-line',
                    onClick: () => navigate('/create-bot'),
                  },
                ] as DropdownMenuItem[]}
                align="right"
              />
            </div>
          </>
        }
      />
      
      <div className="pt-20 pb-20 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Bulk Actions - Paper/Real Trading */}
          <Card className="p-4">
            {/* Desktop: Show all buttons */}
            <div className="hidden md:flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-gray-700 mr-2">Bulk Actions:</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRefreshStats}
                disabled={refreshing || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`}></i>
                {refreshing ? 'Refreshing...' : 'Refresh All Stats'}
              </Button>
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
                variant="secondary"
                size="sm"
                onClick={handleActivateAllPaper}
                disabled={bulkLoading || filteredBots.filter(bot => !bot.paperTrading).length === 0}
                className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300"
              >
                <i className="ri-edit-box-line mr-1"></i>
                Activate All Paper
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePauseAllReal}
                disabled={bulkLoading || filteredBots.filter(bot => !bot.paperTrading && bot.status === 'running').length === 0}
                className="bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300"
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

            {/* Mobile: Dropdown menu with all bulk actions */}
            <div className="md:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Bulk Actions:</span>
                <DropdownMenu
                  trigger={
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation">
                      <i className="ri-menu-line text-xl text-gray-600 dark:text-gray-300"></i>
                    </button>
                  }
                  items={[
                    {
                      label: 'Refresh All Stats',
                      icon: 'ri-refresh-line',
                      onClick: handleRefreshStats,
                      disabled: refreshing || loading,
                    },
                    {
                      label: 'Pause All',
                      icon: 'ri-pause-line',
                      onClick: handlePauseAll,
                      disabled: bulkLoading || filteredBots.filter(bot => bot.status === 'running').length === 0,
                    },
                    {
                      label: 'Activate All Paper',
                      icon: 'ri-edit-box-line',
                      onClick: handleActivateAllPaper,
                      disabled: bulkLoading || filteredBots.filter(bot => !bot.paperTrading).length === 0,
                    },
                    {
                      label: 'Pause All Real',
                      icon: 'ri-pause-circle-line',
                      onClick: handlePauseAllReal,
                      disabled: bulkLoading || filteredBots.filter(bot => !bot.paperTrading && bot.status === 'running').length === 0,
                    },
                    {
                      label: 'Activate All Real',
                      icon: 'ri-money-dollar-circle-line',
                      onClick: handleActivateAllReal,
                      disabled: bulkLoading || filteredBots.filter(bot => bot.paperTrading).length === 0,
                      danger: true,
                    },
                  ] as DropdownMenuItem[]}
                  align="right"
                />
              </div>
            </div>
          </Card>
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
                Auto-execution every 1 minute
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
              { id: 'live', label: 'Live Trading' },
              { id: 'paper', label: 'Paper Trading' }
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
              <Card key={bot.id} className="space-y-4 border-2 border-blue-200 dark:border-blue-700 shadow-lg shadow-blue-500/20 dark:shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/30 dark:hover:shadow-blue-500/20 transition-shadow">
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
                            <span className="text-sm font-medium text-gray-700 flex items-center">
                              Daily Trades:
                              <HelpTooltip text="Maximum number of trades allowed per day for this bot. Once reached, the bot will pause until the next day. This prevents overtrading and helps manage risk." />
                            </span>
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
                              <label className="text-xs font-medium text-gray-700 flex items-center">
                                Max Trades Per Day:
                                <HelpTooltip text="Set the maximum number of trades this bot can execute per day. Once this limit is reached, the bot will automatically pause until the next day. Helps prevent overtrading and manage risk." />
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
                      <span className="text-sm font-medium text-gray-700 flex items-center">
                        Trade Amount:
                        <HelpTooltip text="Base amount in USD for each trade executed by this bot. This will be multiplied by leverage (for futures) and adjusted by risk level. You can edit this value to change the bot's position sizing." />
                      </span>
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

                {/* Bot Activity Status */}
                {!isWebhookView && (() => {
                  const activity = getBotActivity(bot.id);
                  const activityState = activity ? {
                    currentAction: activity.currentAction || 'No recent activity',
                    waitingFor: activity.waitingFor,
                    waitingDetails: activity.waitingDetails,
                    executionState: activity.executionState || 'idle',
                    hasError: activity.errorCount > 0
                  } : null;
                  
                  const cooldownInfo = getCooldownInfo(bot);
                  
                  return activityState ? (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Bot Status</h4>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        activityState.executionState === 'error' || activityState.hasError ? 'bg-red-50 border border-red-200' :
                        activityState.executionState === 'waiting' ? 'bg-yellow-50 border border-yellow-200' :
                        activityState.executionState === 'executing' ? 'bg-blue-50 border border-blue-200' :
                        activityState.executionState === 'analyzing' ? 'bg-purple-50 border border-purple-200' :
                        'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <i className={`mt-0.5 ${
                            activityState.executionState === 'error' || activityState.hasError ? 'ri-error-warning-line text-red-600' :
                            activityState.executionState === 'waiting' ? 'ri-time-line text-yellow-600' :
                            activityState.executionState === 'executing' ? 'ri-loader-4-line text-blue-600 animate-spin' :
                            activityState.executionState === 'analyzing' ? 'ri-search-line text-purple-600' :
                            'ri-information-line text-gray-600'
                          }`}></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {activityState.executionState === 'error' || activityState.hasError ? '⚠️ Error Occurred' :
                               activityState.executionState === 'waiting' ? '⏳ Waiting' :
                               activityState.executionState === 'executing' ? '🔄 Executing' :
                               activityState.executionState === 'analyzing' ? '🔍 Analyzing' :
                               'ℹ️ Idle'}
                            </p>
                            <p className="text-xs text-gray-700 mb-1">
                              {activityState.currentAction}
                            </p>
                            
                            {/* Market Conditions - Always show if available */}
                            {activityState.waitingDetails && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Market Analysis</span>
                                  {(() => {
                                    const sentiment = getSentiment(activityState.waitingDetails.currentRSI, activityState.waitingDetails.currentADX);
                                    return sentiment && (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${sentiment.bg} ${sentiment.color}`}>
                                        <i className={sentiment.icon}></i>
                                        {sentiment.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  {activityState.waitingDetails.currentRSI !== undefined && (
                                    <div className="flex flex-col">
                                      <div className="flex items-center justify-between">
                                        <span className="text-gray-500">RSI:</span>
                                        <span className={`font-mono font-bold ${
                                          activityState.waitingDetails.currentRSI > 70 ? 'text-red-600' :
                                          activityState.waitingDetails.currentRSI < 30 ? 'text-green-600' :
                                          'text-gray-900'
                                        }`}>
                                          {activityState.waitingDetails.currentRSI.toFixed(2)}
                                        </span>
                                      </div>
                                      {activityState.waitingDetails.requiredRSI && (
                                        <span className="text-[9px] text-gray-400 leading-tight">({activityState.waitingDetails.requiredRSI})</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {activityState.waitingDetails.currentADX !== undefined && (
                                    <div className="flex flex-col">
                                      <div className="flex items-center justify-between">
                                        <span className="text-gray-500">ADX:</span>
                                        <span className={`font-mono font-bold ${activityState.waitingDetails.currentADX > 25 ? 'text-blue-600' : 'text-gray-900'}`}>
                                          {activityState.waitingDetails.currentADX.toFixed(2)}
                                        </span>
                                      </div>
                                      {activityState.waitingDetails.requiredADX && (
                                        <span className="text-[9px] text-gray-400 leading-tight">(need {activityState.waitingDetails.requiredADX})</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {activityState.waitingDetails.currentPrice !== undefined && (
                                    <div className="flex items-center justify-between col-span-2 py-0.5 px-1.5 bg-gray-100 rounded">
                                      <span className="text-gray-500 font-medium">Price:</span>
                                      <span className="font-mono font-bold text-gray-900">
                                        ${activityState.waitingDetails.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {activityState.waitingDetails.confidence !== undefined && (
                                    <div className="col-span-2 mt-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-gray-500 font-medium">Signal Confidence:</span>
                                        <span className="text-[10px] font-bold text-blue-600">{(activityState.waitingDetails.confidence * 100).toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1">
                                        <div 
                                          className="bg-blue-600 h-1 rounded-full transition-all duration-500" 
                                          style={{ width: `${activityState.waitingDetails.confidence * 100}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {activityState.waitingDetails.reason && activityState.executionState === 'waiting' && (
                                  <p className="mt-2 text-[10px] text-gray-500 italic border-l-2 border-yellow-300 pl-2">
                                    {activityState.waitingDetails.reason}
                                  </p>
                                )}
                              </div>
                            )}

                            {activityState.waitingFor && activityState.executionState === 'waiting' && !activityState.waitingDetails && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-gray-600 italic">
                                  💡 {activityState.waitingFor}
                                </p>
                              </div>
                            )}
                            {activityState.hasError && activity.errorCount > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-red-600 font-medium">
                                    {activity.errorCount} error{activity.errorCount !== 1 ? 's' : ''} detected
                                  </p>
                                  <button
                                    onClick={() => setExpandedErrorBotId(expandedErrorBotId === bot.id ? null : bot.id)}
                                    className="text-xs text-red-600 hover:text-red-700 font-medium underline focus:outline-none"
                                  >
                                    {expandedErrorBotId === bot.id ? 'Show less' : 'Show more'}
                                  </button>
                                </div>
                                {expandedErrorBotId === bot.id && activity.logs && (
                                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                    {activity.logs
                                      .filter(log => log.level === 'error')
                                      .slice(0, 10) // Show max 10 errors
                                      .map((errorLog, idx) => (
                                        <div key={errorLog.id || idx} className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                                          <div className="flex items-start justify-between gap-2 mb-1">
                                            <span className="font-medium text-red-800">
                                              {errorLog.category ? errorLog.category.charAt(0).toUpperCase() + errorLog.category.slice(1) : 'Error'}
                                            </span>
                                            <span className="text-red-600 text-[10px] whitespace-nowrap">
                                              {new Date(errorLog.timestamp).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="text-red-700 mb-1">{errorLog.message}</p>
                                          {errorLog.details && (
                                            <details className="mt-1">
                                              <summary className="text-red-600 cursor-pointer hover:text-red-700 text-[10px]">
                                                View details
                                              </summary>
                                              <pre className="mt-1 text-[10px] text-red-600 bg-red-100 p-2 rounded overflow-x-auto">
                                                {typeof errorLog.details === 'string' 
                                                  ? errorLog.details 
                                                  : JSON.stringify(errorLog.details, null, 2)}
                                              </pre>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    {activity.logs.filter(log => log.level === 'error').length > 10 && (
                                      <p className="text-xs text-red-600 text-center italic">
                                        Showing 10 of {activity.logs.filter(log => log.level === 'error').length} errors
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Cooldown Section */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <i className="ri-time-line text-yellow-600 text-sm"></i>
                            <span className="text-xs font-medium text-gray-700">Cooldown Bars</span>
                            <HelpTooltip text="Number of bars (time periods) the bot must wait after a trade before trading again. Set to 0 to disable cooldown." />
                          </div>
                          <div className="flex items-center gap-2">
                            {editingCooldownBotId !== bot.id && (
                              <>
                                <span className="text-xs text-gray-600">
                                  {getCurrentCooldownBars(bot)} bar{getCurrentCooldownBars(bot) !== 1 ? 's' : ''}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingCooldownBotId(bot.id);
                                    setEditingCooldownValue(getCurrentCooldownBars(bot));
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  title="Edit cooldown"
                                >
                                  <i className="ri-edit-line"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Cooldown Progress Bar (only show when active) */}
                        {cooldownInfo && cooldownInfo.isActive && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-600">
                                Progress: {cooldownInfo.barsPassed}/{cooldownInfo.requiredBars} bars
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${cooldownInfo.progress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {cooldownInfo.requiredBars - cooldownInfo.barsPassed} bar{cooldownInfo.requiredBars - cooldownInfo.barsPassed !== 1 ? 's' : ''} remaining
                            </p>
                          </div>
                        )}

                        {/* Cooldown Editor */}
                        {editingCooldownBotId === bot.id && (
                          <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <label className="text-xs font-medium text-gray-700">
                                Cooldown Bars:
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="50"
                                value={editingCooldownValue ?? getCurrentCooldownBars(bot)}
                                onChange={(e) => setEditingCooldownValue(parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="text-xs text-gray-500">(0 = disabled)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (editingCooldownValue !== null && editingCooldownValue >= 0) {
                                    try {
                                      // Get current strategyConfig from bot
                                      let currentConfig: any = {};
                                      
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
                                      
                                      // Update cooldown_bars
                                      const updatedConfig = {
                                        ...currentConfig,
                                        cooldown_bars: editingCooldownValue
                                      };
                                      
                                      // Update bot with merged strategyConfig
                                      await updateBot(bot.id, {
                                        strategyConfig: updatedConfig
                                      } as any);
                                      
                                      setEditingCooldownBotId(null);
                                      setEditingCooldownValue(null);
                                      
                                      // Refresh bot list after a short delay
                                      setTimeout(async () => {
                                        await fetchBots();
                                      }, 500);
                                      
                                      alert(`✅ Cooldown bars updated to ${editingCooldownValue}`);
                                    } catch (error: any) {
                                      console.error('Error updating cooldown:', error);
                                      const errorMsg = error?.message || 'Failed to update cooldown. Please try again.';
                                      alert(`Failed to update cooldown: ${errorMsg}`);
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
                                  setEditingCooldownBotId(null);
                                  setEditingCooldownValue(null);
                                }}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null;
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
                          onClick={() => handleExecute(bot.id)}
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
                      onClick={() => setSharingBotId(bot.id)}
                      title="Share Bot Card"
                    >
                      <i className="ri-share-line"></i>
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
                  
                  {/* Sound Notifications Toggle */}
                  {!bot.paperTrading && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-200">
                      <div className="flex items-center space-x-2 flex-1">
                        <i className="ri-notification-3-line text-blue-600"></i>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700">🔔 Sound Notifications</span>
                          {bot.soundNotificationsEnabled && (
                            <p className="text-xs text-blue-600 mt-0.5">Enabled for real trades</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {bot.soundNotificationsEnabled && (
                          <button
                            onClick={() => {
                              try {
                                playTestSound();
                                console.log('🔔 Test sound played');
                              } catch (error) {
                                console.error('Failed to play test sound:', error);
                                alert('⚠️ Could not play test sound. Make sure your browser allows audio and try clicking anywhere on the page first (browser autoplay policy).');
                              }
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Test sound notification"
                          >
                            🔊 Test
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              const newValue = !bot.soundNotificationsEnabled;
                              await updateBot(bot.id, {
                                soundNotificationsEnabled: newValue
                              } as any);
                              if (newValue) {
                                // Play test sound when enabling
                                try {
                                  playTestSound();
                                } catch (e) {
                                  console.warn('Could not play test sound:', e);
                                }
                              }
                            } catch (error: any) {
                              console.error('Error toggling sound notifications:', error);
                              alert(`❌ Failed to update sound notifications: ${error?.message || 'Unknown error'}`);
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            bot.soundNotificationsEnabled 
                              ? 'bg-blue-600' 
                              : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              bot.soundNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                  
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

      {/* Clone Bot by ID Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Clone Bot by ID</h2>
              <button
                onClick={() => {
                  setShowCloneModal(false);
                  setCloneBotId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot ID
                </label>
                <input
                  type="text"
                  value={cloneBotId}
                  onChange={(e) => setCloneBotId(e.target.value)}
                  placeholder="Enter bot ID to clone..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !cloning) {
                      handleCloneBotById();
                    }
                  }}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter the bot ID from another user to clone their bot configuration.
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCloneBotById}
                  disabled={cloning || !cloneBotId.trim()}
                >
                  {cloning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cloning...
                    </>
                  ) : (
                    <>
                      <i className="ri-file-copy-2-line mr-1"></i>
                      Clone Bot
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCloneModal(false);
                    setCloneBotId('');
                  }}
                  disabled={cloning}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bot Share Card Modal */}
      {sharingBotId && (() => {
        const botToShare = bots.find(b => b.id === sharingBotId);
        if (!botToShare) return null;
        
        return (
          <BotShareCard
            bot={{
              id: botToShare.id,
              name: botToShare.name,
              symbol: botToShare.symbol,
              exchange: botToShare.exchange,
              pnl: botToShare.pnl,
              pnlPercentage: botToShare.pnlPercentage,
              winRate: botToShare.winRate,
              totalTrades: botToShare.totalTrades,
              status: botToShare.status,
            }}
            isOpen={true}
            onClose={() => setSharingBotId(null)}
          />
        );
      })()}

      <Navigation />
    </div>
  );
}
