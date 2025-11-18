import { useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useBotActivity } from '../../hooks/useBotActivity';
import { useBots } from '../../hooks/useBots';
import BotActivityLogs from '../../components/bot/BotActivityLogs';
import BotReportViewer from '../../components/bot/BotReportViewer';
import ActivityReportGenerator from '../../components/activity/ActivityReportGenerator';

export default function BotActivityPage() {
  const { bots } = useBots();
  const { activities, loading, addLog, clearBotLogs, simulateBotActivity } = useBotActivity(bots);
  const [filter, setFilter] = useState<'all' | 'running' | 'paused' | 'stopped'>('all');

  const filteredActivities = activities.filter(activity => 
    filter === 'all' || activity.status === filter
  );

  const handleAddTestLog = async (botId: string) => {
    await addLog(botId, {
      level: 'info',
      category: 'system',
      message: 'Manual test log added',
      details: { timestamp: new Date().toISOString(), source: 'manual' }
    });
  };

  const handleSimulateError = async (botId: string) => {
    await addLog(botId, {
      level: 'error',
      category: 'error',
      message: 'Simulated error for testing',
      details: { error: 'Connection timeout', retry: true }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Bot Activity Logs"
        subtitle="Monitor bot operations and debug issues"
        rightAction={
          <div className="flex space-x-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <i className="ri-refresh-line mr-1"></i>
              Refresh
            </Button>
          </div>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Recent Activity Overview */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <i className="ri-pulse-line mr-2 text-blue-600 animate-pulse"></i>
              Recent Activity
            </h3>
            <span className="text-xs text-gray-500">
              Updates every 10s
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Executing Bots */}
            {activities.filter(a => a.executionState === 'executing').length > 0 && (
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-800">Executing</span>
                  <i className="ri-loader-4-line animate-spin text-purple-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'executing')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-purple-900">{activity.botName}</span>
                        <span className="text-purple-700 ml-2">• {activity.currentAction}</span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'executing').length > 3 && (
                    <div className="text-xs text-purple-600">
                      +{activities.filter(a => a.executionState === 'executing').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analyzing Bots */}
            {activities.filter(a => a.executionState === 'analyzing').length > 0 && (
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Analyzing Market</span>
                  <i className="ri-bar-chart-line text-blue-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'analyzing')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-blue-900">{activity.botName}</span>
                        <span className="text-blue-700 ml-2">• {activity.currentAction}</span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'analyzing').length > 3 && (
                    <div className="text-xs text-blue-600">
                      +{activities.filter(a => a.executionState === 'analyzing').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Waiting Bots */}
            {activities.filter(a => a.executionState === 'waiting').length > 0 && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800">Waiting</span>
                  <i className="ri-time-line text-yellow-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'waiting')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-yellow-900">{activity.botName}</span>
                        <span className="text-yellow-700 ml-2">
                          {activity.waitingFor ? `• Waiting: ${activity.waitingFor}` : `• ${activity.currentAction}`}
                        </span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'waiting').length > 3 && (
                    <div className="text-xs text-yellow-600">
                      +{activities.filter(a => a.executionState === 'waiting').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Row */}
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {activities.filter(a => a.executionState === 'executing').length}
              </div>
              <div className="text-xs text-gray-500">Executing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {activities.filter(a => a.executionState === 'analyzing').length}
              </div>
              <div className="text-xs text-gray-500">Analyzing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {activities.filter(a => a.executionState === 'waiting').length}
              </div>
              <div className="text-xs text-gray-500">Waiting</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {activities.filter(a => a.executionState === 'error').length}
              </div>
              <div className="text-xs text-gray-500">Errors</div>
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

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{activities.length}</div>
            <div className="text-sm text-gray-500">Total Bots</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {activities.filter(a => a.status === 'running').length}
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </Card>
          <Card className="p-4 text-center">
            <div className={`text-2xl font-bold ${bots.reduce((sum, b) => sum + (b.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${bots.reduce((sum, b) => sum + (b.pnl || 0), 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Total PnL</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {bots.reduce((sum, b) => sum + (b.totalTrades || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">Total Trades</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(() => {
                const botsWithTrades = bots.filter(b => (b.totalTrades || 0) > 0);
                const avgWinRate = botsWithTrades.length > 0
                  ? botsWithTrades.reduce((sum, b) => sum + (b.winRate || 0), 0) / botsWithTrades.length
                  : 0;
                return `${avgWinRate.toFixed(1)}%`;
              })()}
            </div>
            <div className="text-sm text-gray-500">Win Rate</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {bots.reduce((sum, b) => sum + (b.winTrades || 0), 0)}/{bots.reduce((sum, b) => sum + (b.lossTrades || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">Win/Loss</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              ${Math.abs(bots.reduce((sum, b) => {
                const botFees = (b as any).totalFees || (b as any).total_fees || (b as any).fees || 0;
                return sum + botFees;
              }, 0)).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Total Fees</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {(() => {
                let maxDrawdown = 0;
                let peakPnL = 0;
                let runningPnL = 0;
                const sortedBots = [...bots].sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                sortedBots.forEach(bot => {
                  const botPnL = bot.pnl || 0;
                  runningPnL += botPnL;
                  if (runningPnL > peakPnL) {
                    peakPnL = runningPnL;
                  }
                  const drawdown = peakPnL - runningPnL;
                  if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                  }
                });
                return `$${maxDrawdown.toFixed(2)}`;
              })()}
            </div>
            <div className="text-sm text-gray-500">Max Drawdown</div>
          </Card>
        </div>

        {/* Bot Activities */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading bot activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-robot-line text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bots found</h3>
              <p className="text-gray-500 mb-4">Create some bots to see their activity logs</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <BotActivityLogs
                key={activity.botId}
                activity={activity}
                onClearLogs={clearBotLogs}
                onSimulateActivity={simulateBotActivity}
              />
            ))
          )}
        </div>

        {/* Activity Report Generator */}
        <ActivityReportGenerator />

        {/* Bot Performance Report */}
        <BotReportViewer />

        {/* Debug Tools */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Tools</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Test Logging</h4>
              <p className="text-sm text-gray-500 mb-3">
                Add test logs to verify the logging system is working
              </p>
              <div className="space-x-2">
                {activities.slice(0, 3).map((activity) => (
                  <Button
                    key={activity.botId}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddTestLog(activity.botId)}
                  >
                    Test {activity.botName}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Error Simulation</h4>
              <p className="text-sm text-gray-500 mb-3">
                Simulate errors to test error handling and logging
              </p>
              <div className="space-x-2">
                {activities.slice(0, 3).map((activity) => (
                  <Button
                    key={activity.botId}
                    variant="danger"
                    size="sm"
                    onClick={() => handleSimulateError(activity.botId)}
                  >
                    Error {activity.botName}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
