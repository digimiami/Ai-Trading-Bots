import { useState, useEffect } from 'react';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { BotActivityLog, BotActivity } from '../../hooks/useBotActivity';

interface BotActivityLogsProps {
  activity: BotActivity;
  onClearLogs: (botId: string) => void;
  onSimulateActivity: (botId: string) => void;
}

export default function BotActivityLogs({ activity, onClearLogs, onSimulateActivity }: BotActivityLogsProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [timeSinceActivity, setTimeSinceActivity] = useState<string>('');

  // Update time since activity every second for real-time display
  useEffect(() => {
    const updateTime = () => {
      if (activity.lastActivity) {
        const timeDiff = Date.now() - new Date(activity.lastActivity).getTime();
        const seconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          setTimeSinceActivity(`${hours}h ${minutes % 60}m ago`);
        } else if (minutes > 0) {
          setTimeSinceActivity(`${minutes}m ${seconds % 60}s ago`);
        } else {
          setTimeSinceActivity(`${seconds}s ago`);
        }
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [activity.lastActivity]);

  const getLevelColor = (level: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return 'ri-play-circle-fill text-green-500';
      case 'paused': return 'ri-pause-circle-fill text-yellow-500';
      case 'stopped': return 'ri-stop-circle-fill text-red-500';
      default: return 'ri-question-mark-circle-fill text-gray-500';
    }
  };

  const getExecutionStateInfo = (state?: string) => {
    switch (state) {
      case 'executing':
        return {
          icon: 'ri-loader-4-line animate-spin',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          label: 'Executing',
          badge: 'Executing Trade'
        };
      case 'analyzing':
        return {
          icon: 'ri-bar-chart-line',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'Analyzing',
          badge: 'Analyzing Market'
        };
      case 'waiting':
        return {
          icon: 'ri-time-line',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          label: 'Waiting',
          badge: 'Waiting for Signal'
        };
      case 'error':
        return {
          icon: 'ri-error-warning-line',
          color: 'bg-red-100 text-red-800 border-red-200',
          label: 'Error',
          badge: 'Error Detected'
        };
      case 'idle':
        return {
          icon: 'ri-pause-line',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: 'Idle',
          badge: 'Not Running'
        };
      default:
        return {
          icon: 'ri-question-line',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: 'Unknown',
          badge: 'Unknown State'
        };
    }
  };

  const filteredLogs = activity.logs.filter(log => 
    filter === 'all' || log.level === filter
  );

  // Extract performance metrics from activity logs
  const performanceLog = activity.logs.find(log => 
    log.message?.includes('Performance Update') || 
    log.details?.winTrades !== undefined
  );
  
  const performanceMetrics = performanceLog?.details || null;
  const winTrades = performanceMetrics?.winTrades || 0;
  const lossTrades = performanceMetrics?.lossTrades || 0;
  const drawdown = performanceMetrics?.drawdown || 0;
  const drawdownPercentage = performanceMetrics?.drawdownPercentage || 0;
  const winRate = performanceMetrics?.winRate || 0;
  const totalTrades = performanceMetrics?.totalTrades || 0;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          <i className={`${getStatusIcon(activity.status)} text-xl`}></i>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{activity.botName}</h3>
              {activity.executionState && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getExecutionStateInfo(activity.executionState).color}`}>
                  <i className={`${getExecutionStateInfo(activity.executionState).icon} mr-1`}></i>
                  {getExecutionStateInfo(activity.executionState).badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {activity.currentAction || 'No recent activity'}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {timeSinceActivity && (
                <span>
                  <i className="ri-time-line mr-1"></i>
                  {timeSinceActivity}
                </span>
              )}
              {activity.lastExecutionTime && (
                <span>
                  <i className="ri-exchange-line mr-1"></i>
                  Last trade: {new Date(activity.lastExecutionTime).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            activity.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {activity.status}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            <i className={`ri-${expanded ? 'arrow-up' : 'arrow-down'}-line`}></i>
          </Button>
        </div>
      </div>

      {/* Performance Metrics Section */}
      {performanceMetrics && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center">
              <i className="ri-line-chart-line mr-2 text-blue-600"></i>
              Performance Metrics
            </h4>
            {performanceLog && (
              <span className="text-xs text-gray-500">
                Updated: {formatTime(performanceLog.timestamp)}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Win Trades */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Win Trades</span>
                <i className="ri-arrow-up-line text-green-600"></i>
              </div>
              <div className="text-xl font-bold text-green-600">{winTrades}</div>
              <div className="text-xs text-gray-500">
                {totalTrades > 0 ? `${((winTrades / totalTrades) * 100).toFixed(1)}%` : '0%'} of total
              </div>
            </div>

            {/* Loss Trades */}
            <div className="bg-white rounded-lg p-3 border border-red-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Loss Trades</span>
                <i className="ri-arrow-down-line text-red-600"></i>
              </div>
              <div className="text-xl font-bold text-red-600">{lossTrades}</div>
              <div className="text-xs text-gray-500">
                {totalTrades > 0 ? `${((lossTrades / totalTrades) * 100).toFixed(1)}%` : '0%'} of total
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Win Rate</span>
                <i className="ri-percent-line text-blue-600"></i>
              </div>
              <div className="text-xl font-bold text-blue-600">{winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">
                {totalTrades} total trades
              </div>
            </div>

            {/* Drawdown */}
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Drawdown</span>
                <i className="ri-line-chart-line text-orange-600"></i>
              </div>
              <div className="text-xl font-bold text-orange-600">
                ${drawdown.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">
                {drawdownPercentage.toFixed(1)}% of peak
              </div>
            </div>
          </div>

          {/* Additional Performance Details */}
          {performanceMetrics.peakPnL !== undefined && (
            <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Peak P&L:</span>
                <span className="font-medium text-green-600">
                  ${(performanceMetrics.peakPnL || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current P&L:</span>
                <span className={`font-medium ${
                  (performanceMetrics.currentPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${(performanceMetrics.currentPnL || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{activity.logs.length}</div>
          <div className="text-xs text-gray-500">Total Logs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{activity.successCount}</div>
          <div className="text-xs text-gray-500">Success</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-600">{activity.logs.filter(l => l.level === 'warning').length}</div>
          <div className="text-xs text-gray-500">Warnings</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{activity.errorCount}</div>
          <div className="text-xs text-gray-500">Errors</div>
        </div>
      </div>

      {/* Current Status - Real-time Activity Indicator */}
      <div className="mb-4 p-3 rounded-lg border-2" style={{
        backgroundColor: activity.executionState === 'executing' ? '#f3e8ff' :
                         activity.executionState === 'analyzing' ? '#eff6ff' :
                         activity.executionState === 'waiting' ? '#fefce8' :
                         activity.executionState === 'error' ? '#fef2f2' :
                         '#f9fafb',
        borderColor: activity.executionState === 'executing' ? '#c084fc' :
                     activity.executionState === 'analyzing' ? '#60a5fa' :
                     activity.executionState === 'waiting' ? '#eab308' :
                     activity.executionState === 'error' ? '#f87171' :
                     '#e5e7eb'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {activity.executionState && (
              <i className={`${getExecutionStateInfo(activity.executionState).icon} text-lg ${
                activity.executionState === 'executing' ? 'text-purple-600' :
                activity.executionState === 'analyzing' ? 'text-blue-600' :
                activity.executionState === 'waiting' ? 'text-yellow-600' :
                activity.executionState === 'error' ? 'text-red-600' :
                'text-gray-600'
              }`}></i>
            )}
            <div>
              <span className={`text-sm font-medium ${
                activity.executionState === 'executing' ? 'text-purple-800' :
                activity.executionState === 'analyzing' ? 'text-blue-800' :
                activity.executionState === 'waiting' ? 'text-yellow-800' :
                activity.executionState === 'error' ? 'text-red-800' :
                'text-gray-800'
              }`}>
                {activity.executionState ? getExecutionStateInfo(activity.executionState).label : 'Status'}:
              </span>
              <span className={`ml-2 text-sm ${
                activity.executionState === 'executing' ? 'text-purple-700' :
                activity.executionState === 'analyzing' ? 'text-blue-700' :
                activity.executionState === 'waiting' ? 'text-yellow-700' :
                activity.executionState === 'error' ? 'text-red-700' :
                'text-gray-700'
              }`}>
                {activity.currentAction || 'No activity'}
              </span>
            </div>
          </div>
          {activity.waitingFor && (
            <div className="text-xs text-gray-600">
              <i className="ri-hourglass-line mr-1"></i>
              {activity.waitingFor}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Logs */}
      {expanded && (
        <div className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex space-x-2">
            {['all', 'info', 'warning', 'error', 'success'].map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  filter === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          {/* Logs List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="ri-file-list-line text-2xl mb-2"></i>
                <p>No logs found</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getLevelColor(log.level)}`}>
                    <i className={`${getCategoryIcon(log.category)} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{log.message}</p>
                    {log.details && (
                      <details className="text-xs text-gray-600">
                        <summary className="cursor-pointer hover:text-gray-800">Details</summary>
                        <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSimulateActivity(activity.botId)}
            >
              <i className="ri-play-line mr-1"></i>
              Simulate Activity
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onClearLogs(activity.botId)}
            >
              <i className="ri-delete-bin-line mr-1"></i>
              Clear Logs
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
