import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Wallet, Send, Download, Copy, Check, AlertCircle } from 'lucide-react';

interface WalletData {
  wallets: any[];
  balances: any[];
  totalBalances: Record<string, number>;
  recentTransactions: any[];
}

export default function WalletPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Buy BTC form
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyCurrency, setBuyCurrency] = useState<'USD' | 'BTC'>('USD');
  const [buying, setBuying] = useState(false);
  
  // Send BTC form
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sending, setSending] = useState(false);
  
  // Copy to clipboard
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/crypto-wallet`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load wallet data');
      }

      const data = await response.json();
      setWalletData(data);
    } catch (err) {
      console.error('Error loading wallet data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyBTC = async () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setBuying(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/crypto-wallet/buy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(buyAmount),
            currency: buyCurrency,
            paymentMethod: 'coinbase',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate purchase');
      }

      const data = await response.json();
      
      // If payment URL is provided, redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert('Purchase initiated! Please check your email for payment instructions.');
        setShowBuyForm(false);
        setBuyAmount('');
        loadWalletData(); // Refresh wallet data
      }
    } catch (err) {
      console.error('Error buying BTC:', err);
      setError(err instanceof Error ? err.message : 'Failed to buy BTC');
    } finally {
      setBuying(false);
    }
  };

  const handleSendBTC = async () => {
    if (!sendAddress || !sendAmount || parseFloat(sendAmount) <= 0) {
      setError('Please enter a valid address and amount');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/crypto-wallet/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toAddress: sendAddress,
            amount: parseFloat(sendAmount),
            currency: 'BTC',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send BTC');
      }

      const data = await response.json();
      alert(`Transaction submitted! Hash: ${data.transaction.transaction_hash}`);
      setShowSendForm(false);
      setSendAddress('');
      setSendAmount('');
      loadWalletData(); // Refresh wallet data
    } catch (err) {
      console.error('Error sending BTC:', err);
      setError(err instanceof Error ? err.message : 'Failed to send BTC');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatBTC = (amount: number) => {
    return amount.toFixed(8);
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getBTCWallet = () => {
    return walletData?.wallets?.find((w: any) => w.currency === 'BTC');
  };

  const getBTCBalance = () => {
    return walletData?.totalBalances?.BTC || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <div className="pt-16 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading wallet...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-2">
              <Header 
                title="Crypto Wallet" 
                subtitle="Buy, send, and manage your Bitcoin"
              />
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 whitespace-nowrap mt-1">
                Coming Soon
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Balance Card */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Balance</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowBuyForm(true)}
                  className="flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Buy BTC
                </Button>
                <Button
                  onClick={() => setShowSendForm(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send BTC
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Bitcoin (BTC)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBTC(getBTCBalance())} BTC
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-orange-500" />
              </div>

              {getBTCWallet() && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white break-all">
                      {getBTCWallet()?.address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(getBTCWallet()?.address || '', 'address')}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      {copiedAddress === 'address' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent Transactions
            </h2>
            
            {walletData?.recentTransactions && walletData.recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {walletData.recentTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {tx.transaction_type}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : tx.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tx.to_address && (
                          <span>To: {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-8)}</span>
                        )}
                        {tx.transaction_hash && (
                          <span className="ml-2">
                            Hash: {tx.transaction_hash.slice(0, 10)}...
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${
                          tx.transaction_type === 'buy' || tx.transaction_type === 'receive'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {tx.transaction_type === 'buy' || tx.transaction_type === 'receive' ? '+' : '-'}
                        {formatBTC(parseFloat(tx.amount))} {tx.currency}
                      </p>
                      {tx.fiat_amount && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {formatUSD(tx.fiat_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No transactions yet
              </p>
            )}
          </Card>

          {/* Buy BTC Modal */}
          {showBuyForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-md w-full">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Buy Bitcoin
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={buyCurrency}
                      onChange={(e) => setBuyCurrency(e.target.value as 'USD' | 'BTC')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="BTC">BTC</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleBuyBTC}
                      disabled={buying || !buyAmount}
                      className="flex-1"
                    >
                      {buying ? 'Processing...' : 'Buy BTC'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowBuyForm(false);
                        setBuyAmount('');
                        setError(null);
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Send BTC Modal */}
          {showSendForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-md w-full">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Send Bitcoin
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value)}
                      placeholder="Enter Bitcoin address"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Amount (BTC)
                    </label>
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00000000"
                      step="0.00000001"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Available: {formatBTC(getBTCBalance())} BTC
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendBTC}
                      disabled={sending || !sendAddress || !sendAmount}
                      className="flex-1"
                    >
                      {sending ? 'Sending...' : 'Send BTC'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSendForm(false);
                        setSendAddress('');
                        setSendAmount('');
                        setError(null);
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

