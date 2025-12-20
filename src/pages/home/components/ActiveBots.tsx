
import { TradingBot } from '../../../types/trading';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import { useNavigate } from 'react-router-dom';

interface ActiveBotsProps {
  bots: TradingBot[];
}

export default function ActiveBots({ bots = [] }: ActiveBotsProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'paused':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'stopped':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getExchangeIcon = (exchange: string) => {
    return exchange === 'bybit' ? 'ri-currency-line' : 'ri-exchange-line';
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  // Ensure bots is an array before using slice
  const safeBots = Array.isArray(bots) ? bots : [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Bots</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/create-bot')}
        >
          <i className="ri-add-line mr-1"></i>
          New Bot
        </Button>
      </div>

      <div className="space-y-3">
        {safeBots.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-robot-line text-2xl text-gray-400 dark:text-gray-500"></i>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">No active bots yet</p>
            <Button
              variant="primary"
              onClick={() => navigate('/create-bot')}
              className="text-sm"
            >
              Create Your First Bot
            </Button>
          </div>
        ) : (
          safeBots.slice(0, 5).map((bot) => (
            <div
              key={bot.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-blue-200 dark:border-blue-700 shadow-md shadow-blue-500/15 dark:shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 dark:hover:shadow-blue-500/15 transition-shadow"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <i
                    className={`${getExchangeIcon(bot.exchange)} text-blue-600 dark:text-blue-400`}
                  ></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{bot.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {bot.symbols && bot.symbols.length > 1 
                      ? `${bot.symbols.join(', ')} (${bot.symbols.length} pairs)` 
                      : bot.symbol} • {bot.exchange.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      bot.status
                    )}`}
                  >
                    {bot.status}
                  </span>
                </div>
                <p
                  className={`text-sm font-medium mt-1 ${getPnlColor(bot.pnl || 0)}`}
                >
                  {(bot.pnl || 0) >= 0 ? '+' : ''}
                  {(bot.pnl || 0).toFixed(2)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
