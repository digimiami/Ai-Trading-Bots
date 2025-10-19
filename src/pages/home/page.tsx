
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import StatsGrid from './components/StatsGrid';
import ActiveBots from './components/ActiveBots';
import MarketOverview from './components/MarketOverview';
import { useAuth } from '../../hooks/useAuth';
import { useBots } from '../../hooks/useBots';
import { useMarketData } from '../../hooks/useMarketData';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bots, loading: botsLoading } = useBots();
  const { marketData, loading: marketLoading } = useMarketData();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const isFirstVisit = !localStorage.getItem('welcome_shown');
    if (isFirstVisit && user) {
      setShowWelcome(true);
      localStorage.setItem('welcome_shown', 'true');
    }
  }, [user]);

  const activeBots = bots.filter(bot => bot.status === 'active');
  const totalPnL = bots.reduce((sum, bot) => sum + (bot.totalPnL || 0), 0);

  const handleCreateFirstBot = () => {
    setShowWelcome(false);
    navigate('/create-bot');
  };

  const handleGetStarted = () => {
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Pablo" 
        subtitle="AI Trading Platform"
        rightAction={
          <button
            onClick={() => navigate('/help')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="ri-notification-line text-xl text-gray-600"></i>
          </button>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Welcome Message for New Users */}
        {showWelcome && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="ri-robot-line text-2xl text-blue-600"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Welcome to Pablo! 🎉
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Ready to start automated trading? Create your first AI trading bot and let it work 24/7 for you.
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="primary"
                    onClick={handleCreateFirstBot}
                    className="text-sm"
                  >
                    Create First Bot
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowWelcome(false)}
                    className="text-sm"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setShowWelcome(false)}
                className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <StatsGrid />

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/create-bot')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-add-line mr-2"></i>
              Create Bot
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/bots')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-robot-line mr-2"></i>
              Manage Bots
            </Button>
          </div>
        </Card>

        {/* Active Bots */}
        <ActiveBots />

        {/* Market Overview */}
        <MarketOverview />

        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button
              variant="secondary"
              onClick={() => navigate('/trades')}
              className="text-sm"
            >
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {[
              {
                type: 'trade',
                message: 'BTC Scalper opened LONG position',
                time: '2 minutes ago',
                icon: 'ri-arrow-up-line',
                color: 'green'
              },
              {
                type: 'profit',
                message: 'ETH Momentum closed with +$45.20 profit',
                time: '15 minutes ago',
                icon: 'ri-money-dollar-circle-line',
                color: 'green'
              },
              {
                type: 'alert',
                message: 'SOL Trader hit stop loss at -2.5%',
                time: '1 hour ago',
                icon: 'ri-alert-line',
                color: 'red'
              },
              {
                type: 'bot',
                message: 'New bot "DOGE Swing" created',
                time: '2 hours ago',
                icon: 'ri-robot-line',
                color: 'blue'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center`}>
                  <i className={`${activity.icon} text-${activity.color}-600`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">+$156.30</div>
              <div className="text-sm text-gray-600">Total P&L</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">12</div>
              <div className="text-sm text-gray-600">Trades Executed</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">75%</div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{activeBots.length}</div>
              <div className="text-sm text-gray-600">Active Bots</div>
            </div>
          </div>
        </Card>

        {/* Educational Content */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Tips</h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-lightbulb-line text-blue-600 mt-1"></i>
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Risk Management</h4>
                  <p className="text-sm text-blue-700">
                    Never risk more than 2-3% of your capital on a single trade. Use stop losses to protect your investments.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-bar-chart-line text-green-600 mt-1"></i>
                <div>
                  <h4 className="font-medium text-green-900 mb-1">Diversification</h4>
                  <p className="text-sm text-green-700">
                    Spread your trades across different cryptocurrencies and strategies to reduce overall risk.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
