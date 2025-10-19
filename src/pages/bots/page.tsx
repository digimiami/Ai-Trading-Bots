
import { useState } from 'react';
import { Header } from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { TradingBot } from '../../types/trading';
import { useNavigate } from 'react-router-dom';
import { useBots } from '../../hooks/useBots';

export default function BotsPage() {
  const navigate = useNavigate();
  const { bots, loading, startBot, stopBot, updateBot } = useBots();
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'stopped'>('all');

  const filteredBots = bots.filter(bot => 
    filter === 'all' || bot.status === filter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
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
      } else if (action === 'stop') {
        await stopBot(botId);
      } else if (action === 'pause') {
        await updateBot(botId, { status: 'paused' });
      }
    } catch (error) {
      console.error('Failed to update bot:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Trading Bots"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/create-bot')}
          >
            <i className="ri-add-line mr-1"></i>
            New Bot
          </Button>
        }
      />
      
      <div className="pt-20 pb-20 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Filter Tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {['all', 'active', 'paused', 'stopped'].map((status) => (
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
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bot.status)}`}>
                          {bot.status}
                        </span>
                        <span className={`text-xs font-medium ${getRiskColor(bot.riskLevel)}`}>
                          {bot.riskLevel} risk
                        </span>
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

                {/* Bot Actions */}
                <div className="flex space-x-2 pt-4 border-t border-gray-100">
                  {bot.status === 'active' ? (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleBotAction(bot.id, 'pause')}
                    >
                      <i className="ri-pause-line mr-1"></i>
                      Pause
                    </Button>
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
                  >
                    <i className="ri-settings-line"></i>
                  </Button>
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
