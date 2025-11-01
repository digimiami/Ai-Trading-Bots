
import { useState } from 'react';
import { Header } from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { TradingBot } from '../../types/trading';
import { useNavigate } from 'react-router-dom';
import { useBots } from '../../hooks/useBots';
import { useBotActivity } from '../../hooks/useBotActivity';
import { useBotExecutor } from '../../hooks/useBotExecutor';
import { useBotTradeLimits } from '../../hooks/useBotTradeLimits';

export default function BotsPage() {
  const navigate = useNavigate();
  const { bots, loading, startBot, stopBot, updateBot, deleteBot } = useBots();
  const { activities, addLog } = useBotActivity(bots);
  const { isExecuting, lastExecution, timeSync, executeBot, executeAllBots } = useBotExecutor();
  const [filter, setFilter] = useState<'all' | 'running' | 'paused' | 'stopped'>('all');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [togglingAiMl, setTogglingAiMl] = useState<string | null>(null);
  const [editingLimitBotId, setEditingLimitBotId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<number | null>(null);
  
  // Get trade limits for all bots
  const botIds = bots.map(b => b.id);
  const { limits, getLimit, refresh: refreshLimits } = useBotTradeLimits(botIds);

  const filteredBots = bots.filter(bot => 
    filter === 'all' || bot.status === filter
  );

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
      if (action === 'start') {
        await startBot(botId);
        await addLog(botId, {
          level: 'success',
          category: 'system',
          message: 'Bot started successfully',
          details: { action: 'start', timestamp: new Date().toISOString() }
        });
      } else if (action === 'stop') {
        await stopBot(botId);
        await addLog(botId, {
          level: 'info',
          category: 'system',
          message: 'Bot stopped by user',
          details: { action: 'stop', timestamp: new Date().toISOString() }
        });
      } else if (action === 'pause') {
        await updateBot(botId, { status: 'paused' });
        await addLog(botId, {
          level: 'warning',
          category: 'system',
          message: 'Bot paused by user',
          details: { action: 'pause', timestamp: new Date().toISOString() }
        });
      }
    } catch (error) {
      console.error('Failed to update bot:', error);
      await addLog(botId, {
        level: 'error',
        category: 'error',
        message: `Failed to ${action} bot: ${error}`,
        details: { action, error: error instanceof Error ? error.message : String(error) }
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
      
      <div className="pt-20 pb-20 px-4">
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

          {/* Filter Tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {['all', 'running', 'paused', 'stopped'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
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
                      <p className="text-sm text-gray-500">{bot.symbol} • {bot.exchange.toUpperCase()}</p>
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
                    <p className={`text-lg font-bold ${bot.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}
                    </p>
                    <p className={`text-sm ${bot.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {bot.pnlPercentage >= 0 ? '+' : ''}{bot.pnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Trade Limit Status */}
                {(() => {
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
                                max="100"
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
                                      // Update bot's strategyConfig
                                      const currentConfig = bot.strategyConfig || {};
                                      const updatedConfig = {
                                        ...currentConfig,
                                        max_trades_per_day: editingLimitValue
                                      };
                                      
                                      await updateBot(bot.id, {
                                        strategyConfig: updatedConfig
                                      } as any);
                                      
                                      setEditingLimitBotId(null);
                                      setEditingLimitValue(null);
                                      await refreshLimits();
                                      alert(`✅ Max trades per day updated to ${editingLimitValue}`);
                                    } catch (error) {
                                      console.error('Error updating limit:', error);
                                      alert('Failed to update limit. Please try again.');
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

                {/* Bot Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Trades</p>
                    <p className="font-semibold text-gray-900">{bot.totalTrades}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Win Rate</p>
                    <p className="font-semibold text-gray-900">{bot.winRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Leverage</p>
                    <p className="font-semibold text-gray-900">{bot.leverage}x</p>
                  </div>
                </div>

                {/* Bot Activity Logs */}
                {(() => {
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

                {/* Bot Actions */}
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
