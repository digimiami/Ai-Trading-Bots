import { useState, useEffect } from 'react';
import { ExchangeBalance } from '../../../hooks/useExchangeBalance';
import Card from '../../../components/base/Card';
import { supabase } from '../../../lib/supabase';

interface ExchangeBalanceProps {
  balances: ExchangeBalance[];
}

export default function ExchangeBalanceDisplay({ balances }: ExchangeBalanceProps) {
  const [todayPnLByExchange, setTodayPnLByExchange] = useState<Record<string, number>>({});
  const [loadingPnL, setLoadingPnL] = useState(true);
  
  useEffect(() => {
    const fetchTodayPnL = async () => {
      try {
        setLoadingPnL(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        const todayEndStr = todayEnd.toISOString();

        // Fetch today's trades with PnL grouped by exchange
        // Query trades that were executed today OR created today (if executed_at is null)
        // First, get trades with executed_at today
        const { data: executedTrades, error: executedError } = await supabase
          .from('trades')
          .select('exchange, pnl')
          .gte('executed_at', todayStart)
          .lte('executed_at', todayEndStr)
          .in('status', ['filled', 'completed', 'closed', 'stopped', 'taken_profit']);
        
        // Then, get trades created today but without executed_at (fallback)
        const { data: createdTrades, error: createdError } = await supabase
          .from('trades')
          .select('exchange, pnl')
          .is('executed_at', null)
          .gte('created_at', todayStart)
          .lte('created_at', todayEndStr)
          .in('status', ['filled', 'completed', 'closed', 'stopped', 'taken_profit']);
        
        const error = executedError || createdError;
        const trades = [...(executedTrades || []), ...(createdTrades || [])];

        if (error) {
          console.error('Error fetching today PnL:', error);
          return;
        }

        // Calculate PnL by exchange
        const pnlByExchange: Record<string, number> = {};
        if (trades) {
          trades.forEach((trade: any) => {
            const exchange = (trade.exchange || '').toLowerCase();
            if (exchange) {
              const pnl = parseFloat(trade.pnl || 0);
              if (!isNaN(pnl)) {
                pnlByExchange[exchange] = (pnlByExchange[exchange] || 0) + pnl;
              }
            }
          });
        }

        setTodayPnLByExchange(pnlByExchange);
      } catch (error) {
        console.error('Error calculating today PnL:', error);
      } finally {
        setLoadingPnL(false);
      }
    };

    if (balances.length > 0) {
      fetchTodayPnL();
    }
  }, [balances]);
  
  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getExchangeIcon = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return 'ri-currency-line';
      case 'okx':
        return 'ri-exchange-line';
      case 'bitunix':
        return 'ri-exchange-line';
      case 'mexc':
        return 'ri-exchange-line';
      default:
        return 'ri-exchange-line';
    }
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'okx':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'bitunix':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'mexc':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'disconnected':
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return 'ri-check-line';
      case 'disconnected':
        return 'ri-close-line';
      case 'error':
        return 'ri-error-warning-line';
      default:
        return 'ri-question-line';
    }
  };

  if (!balances || balances.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exchange Balances</h3>
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <i className="ri-wallet-line text-4xl mb-2"></i>
          <p>No exchange connections found</p>
          <p className="text-sm">Connect your exchange API keys to view balances</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exchange Balances</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
          <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {balances.map((balance, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getExchangeColor(balance.exchange)}`}>
                  <i className={`${getExchangeIcon(balance.exchange)} text-lg`}></i>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{balance.exchange.toUpperCase()}</h4>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(balance.status)}`}>
                      <i className={`${getStatusIcon(balance.status)} text-xs`}></i>
                      <span>{balance.status}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Updated {new Date(balance.lastUpdated).toLocaleTimeString()}
                  </p>
                  {balance.error && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                      Error: {balance.error}
                    </p>
                  )}
                  {balance.note && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                      <i className="ri-information-line mr-1"></i>
                      {balance.note}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatBalance(balance.totalBalance)}
                </p>
                {(() => {
                  // For Bybit, show unrealized PnL if available, otherwise show today's realized PnL
                  const isBybit = balance.exchange.toLowerCase() === 'bybit';
                  const unrealizedPnL = balance.unrealizedPnL ?? 0;
                  const todayPnL = todayPnLByExchange[balance.exchange.toLowerCase()] || 0;
                  
                  if (isBybit && unrealizedPnL !== undefined && unrealizedPnL !== 0) {
                    // Show unrealized PnL for Bybit
                    return (
                      <p className={`text-sm font-medium ${unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        Unrealized PnL: {unrealizedPnL >= 0 ? '+' : ''}{formatBalance(unrealizedPnL)}
                      </p>
                    );
                  } else if (loadingPnL) {
                    return (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Today PnL: Loading...
                      </p>
                    );
                  } else {
                    // Show today's realized PnL for other exchanges or if unrealized is 0
                    return (
                      <p className={`text-sm font-medium ${todayPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        Today PnL: {todayPnL >= 0 ? '+' : ''}{formatBalance(todayPnL)}
                      </p>
                    );
                  }
                })()}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Available: {formatBalance(balance.availableBalance)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Locked: {formatBalance(balance.lockedBalance)}
                </p>
              </div>
            </div>
            
            {/* Top Assets */}
            {balance.assets && balance.assets.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {balance.assets.slice(0, 4).map((asset, assetIndex) => (
                  <div key={assetIndex} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{asset.asset}</span>
                    <span className="font-medium dark:text-white">{asset.total.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
