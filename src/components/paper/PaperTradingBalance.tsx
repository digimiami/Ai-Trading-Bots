import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../base/Card';
import Button from '../base/Button';

interface PaperLog {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  message: string;
  bot_name?: string;
  symbol?: string;
}

export default function PaperTradingBalance() {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [logs, setLogs] = useState<PaperLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  useEffect(() => {
    fetchBalance();
    fetchLogs();
    
    // Refresh logs every 10 seconds
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('paper_trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setBalance(data);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLogs([]);
        return;
      }

      // Get user's paper trading bots
      const { data: paperBots, error: botsError } = await supabase
        .from('trading_bots')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('paper_trading', true);

      if (botsError) {
        console.error('Error fetching paper bots:', botsError);
        setLogs([]);
        return;
      }

      if (!paperBots || paperBots.length === 0) {
        setLogs([]);
        return;
      }

      const botIds = paperBots.map(b => b.id);
      const botNameMap = new Map(paperBots.map(b => [b.id, b.name]));

      // Get recent logs for paper trading bots - get all logs, filter by message in JS
      const { data: logData, error: logsError } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .in('bot_id', botIds)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        setLogs([]);
        return;
      }

      if (logData && logData.length > 0) {
        // Filter for paper trading logs (messages containing [PAPER] or 📝)
        const paperLogs = logData.filter(log => {
          const message = log.message || '';
          return message.includes('[PAPER]') || 
                 message.includes('📝') || 
                 message.includes('PAPER') ||
                 log.details?.paper_trading === true;
        });

        const enrichedLogs = paperLogs.slice(0, 20).map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          level: log.level,
          category: log.category,
          message: log.message,
          bot_name: botNameMap.get(log.bot_id),
          symbol: log.details?.symbol || log.details?.paper_trading?.symbol || log.details?.paper_trading?.side
        }));
        
        setLogs(enrichedLogs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error fetching paper trading logs:', error);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };
  
  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    try {
      // Call edge function to add funds
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/paper-trading`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_funds',
          amount: amount
        })
      });
      
      if (response.ok) {
        await fetchBalance();
        setAddAmount('');
        alert(`✅ Added $${amount.toFixed(2)} to paper trading balance`);
        // Refresh logs to show the balance update
        setTimeout(() => fetchLogs(), 1000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add funds');
      }
    } catch (error: any) {
      alert('Error adding funds: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return 'ri-information-line text-blue-600';
      case 'warning': return 'ri-alert-line text-yellow-600';
      case 'error': return 'ri-error-warning-line text-red-600';
      case 'success': return 'ri-checkbox-circle-line text-green-600';
      default: return 'ri-information-line text-gray-600';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (!balance) {
    // Return null if no balance yet (will be created on first trade)
    return null;
  }
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">📝 Paper Trading Balance</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Available Balance:</span>
          <span className="text-xl font-bold text-green-600">
            ${parseFloat(balance.balance).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Initial Balance:</span>
          <span>${parseFloat(balance.initial_balance).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Deposited:</span>
          <span className="text-green-600">${parseFloat(balance.total_deposited || 0).toFixed(2)}</span>
        </div>
        <div className="border-t pt-3 mt-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="Amount to add"
              className="flex-1 px-3 py-2 border rounded-lg"
              min="1"
              step="0.01"
            />
            <Button
              onClick={handleAddFunds}
              loading={loading}
              variant="primary"
            >
              Add Funds
            </Button>
          </div>
        </div>

        {/* Paper Trading Logs */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Recent Activity</h4>
            <Button
              onClick={fetchLogs}
              variant="secondary"
              size="sm"
              loading={loadingLogs}
            >
              <i className="ri-refresh-line"></i>
            </Button>
          </div>
          
          {loadingLogs && logs.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p>Loading activity...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              <i className="ri-file-list-line text-2xl mb-2 block"></i>
              <p>No paper trading activity yet</p>
              <p className="text-xs mt-1">Activity will appear here when bots execute trades</p>
              <p className="text-xs mt-1 text-gray-400">Make sure you have paper trading bots running</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <i className={`${getLevelIcon(log.level)} mt-0.5 flex-shrink-0`}></i>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {log.bot_name && (
                          <span className="font-medium text-gray-900 text-xs">
                            {log.bot_name}
                          </span>
                        )}
                        {log.symbol && (
                          <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                            {log.symbol}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 break-words">
                        {log.message}
                      </p>
                      {log.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {log.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

