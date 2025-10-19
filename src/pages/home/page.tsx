
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import StatsGrid from './components/StatsGrid';
import ActiveBots from './components/ActiveBots';
import MarketOverview from './components/MarketOverview';
import ExchangeBalance from './components/ExchangeBalance';
import Button from '../../components/base/Button';
import { useBots } from '../../hooks/useBots';
import { useMarketData } from '../../hooks/useMarketData';
import { useExchangeBalance } from '../../hooks/useExchangeBalance';

export default function Home() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const { bots, loading: botsLoading, fetchBots } = useBots();
  const { data: btcData, loading: marketLoading, refetch: refetchMarket } = useMarketData('BTCUSDT', 'bybit');
  const { balances, loading: balanceLoading, refetch: refetchBalances } = useExchangeBalance();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchBots(), refetchMarket(), refetchBalances()]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateBot = () => {
    navigate('/create-bot');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Pablo AI Trading"
        subtitle="Multi-Exchange Bot Platform"
        action={
          <Button 
            size="sm" 
            onClick={handleRefresh}
            loading={refreshing}
          >
            <i className="ri-refresh-line mr-1"></i>
            Refresh
          </Button>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Ready to Trade?</h2>
              <p className="text-blue-100 text-sm">Create your first AI trading bot</p>
            </div>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={handleCreateBot}
            >
              <i className="ri-add-line mr-1"></i>
              New Bot
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <StatsGrid />

        {/* Exchange Balances */}
        <ExchangeBalance balances={balances} />

        {/* Active Bots */}
        <ActiveBots bots={bots} />

        {/* Market Overview */}
        <MarketOverview marketData={btcData ? [btcData] : []} />

        {/* Exchange Status */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exchange Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <i className="ri-currency-line text-yellow-600"></i>
                </div>
                <span className="font-medium">Bybit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="ri-exchange-line text-blue-600"></i>
                </div>
                <span className="font-medium">OKX</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  );
}
