import { useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useBotActivity } from '../../hooks/useBotActivity';
import { useBots } from '../../hooks/useBots';
import BotActivityLogs from '../../components/bot/BotActivityLogs';

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
        <div className="grid grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold text-yellow-600">
              {activities.reduce((sum, a) => sum + a.logs.filter(l => l.level === 'warning').length, 0)}
            </div>
            <div className="text-sm text-gray-500">Warnings</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {activities.reduce((sum, a) => sum + a.errorCount, 0)}
            </div>
            <div className="text-sm text-gray-500">Errors</div>
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
