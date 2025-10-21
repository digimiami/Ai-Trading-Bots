import { useState } from 'react';
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

  const filteredLogs = activity.logs.filter(log => 
    filter === 'all' || log.level === filter
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <i className={`${getStatusIcon(activity.status)} text-xl`}></i>
          <div>
            <h3 className="font-semibold text-gray-900">{activity.botName}</h3>
            <p className="text-sm text-gray-500">
              {activity.currentAction || 'No recent activity'}
            </p>
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

      {/* Current Status */}
      {activity.waitingFor && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <i className="ri-time-line text-blue-600"></i>
            <span className="text-sm text-blue-800">
              Waiting for: {activity.waitingFor}
            </span>
          </div>
        </div>
      )}

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
