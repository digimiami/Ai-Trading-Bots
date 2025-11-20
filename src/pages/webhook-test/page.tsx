import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { supabase } from '../../lib/supabase';
import { useBots } from '../../hooks/useBots';

const generateWebhookSecret = () => {
  try {
    const array = new Uint8Array(18);
    if (window?.crypto?.getRandomValues) {
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('Falling back to Math.random for webhook secret generation:', error);
  }
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
};

interface WebhookCall {
  id: string;
  bot_id: string | null;
  user_id: string;
  raw_payload: any;
  parsed_payload: any;
  secret_provided: string | null;
  secret_valid: boolean;
  bot_found: boolean;
  side: string | null;
  mode: string | null;
  status: 'received' | 'processed' | 'failed' | 'rejected';
  error_message: string | null;
  response_status: number | null;
  response_body: any;
  signal_id: string | null;
  trigger_executed: boolean;
  trigger_response: any;
  created_at: string;
  processed_at: string | null;
}

export default function WebhookTestPage() {
  const navigate = useNavigate();
  const { bots, updateBot } = useBots();
  const [selectedBot, setSelectedBot] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [testPayload, setTestPayload] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [webhookCalls, setWebhookCalls] = useState<WebhookCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (bots.length > 0 && !selectedBot) {
      setSelectedBot(bots[0].id);
    }
  }, [bots, selectedBot]);

  useEffect(() => {
    if (selectedBot) {
      const bot = bots.find(b => b.id === selectedBot);
      if (bot) {
        // Use the same method as supabase.ts to get the URL
        const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
        if (!supabaseUrl) {
          console.error('⚠️ Supabase URL not configured');
          setWebhookUrl('/functions/v1/tradingview-webhook');
        } else {
          setWebhookUrl(`${supabaseUrl}/functions/v1/tradingview-webhook`);
        }
        
        // Always update secret from bot data (in case it was updated)
        const botSecret = bot.webhook_secret || bot.webhookSecret || '';
        setWebhookSecret(botSecret);
        
        // Generate test payload (using TradingView strategy variables format)
        const payload = {
          secret: botSecret,
          botId: bot.id,
          action: 'buy', // {{strategy.order.action}} - Can be: 'buy', 'sell', 'long', 'short'
          marketPosition: 'long', // {{strategy.market_position}}
          prevMarketPosition: 'flat', // {{strategy.prev_market_position}}
          marketPositionSize: '1.0', // {{strategy.market_position_size}}
          prevMarketPositionSize: '0.0', // {{strategy.prev_market_position_size}}
          instrument: 'BTCUSDT', // {{ticker}}
          timestamp: new Date().toISOString(), // {{timenow}}
          maxLag: '300',
          investmentType: 'base',
          amount: '1.0', // {{strategy.order.contracts}}
          mode: 'paper',
          reason: 'Test webhook from testing interface'
        };
        setTestPayload(JSON.stringify(payload, null, 2));
      }
    }
  }, [selectedBot, bots]);

  useEffect(() => {
    fetchWebhookCalls();
  }, [selectedBot]);

  const fetchWebhookCalls = async () => {
    if (!selectedBot) return;
    
    setLoadingCalls(true);
    try {
      const { data, error } = await supabase
        .from('webhook_calls')
        .select('*')
        .eq('bot_id', selectedBot)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error fetching webhook calls:', error);
        // Check if table exists
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.error('⚠️ webhook_calls table does not exist. Please run the migration: 20250113_create_webhook_calls_table.sql');
        }
        setWebhookCalls([]);
        return;
      }
      console.log(`✅ Fetched ${data?.length || 0} webhook calls`);
      setWebhookCalls(data || []);
    } catch (error) {
      console.error('❌ Error fetching webhook calls:', error);
      setWebhookCalls([]);
    } finally {
      setLoadingCalls(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!selectedBot || !testPayload) {
      alert('Please select a bot and provide a test payload');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const payload = JSON.parse(testPayload);
      
      // Ensure we have a full URL
      let fullWebhookUrl = webhookUrl;
      if (!webhookUrl.startsWith('http')) {
        const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
        if (supabaseUrl) {
          fullWebhookUrl = `${supabaseUrl}${webhookUrl.startsWith('/') ? '' : '/'}${webhookUrl}`;
        } else {
          throw new Error('Supabase URL not configured. Please check your environment variables.');
        }
      }
      
      console.log('🚀 Sending webhook to:', fullWebhookUrl);
      console.log('📦 Payload:', payload);
      
      // Get authentication headers
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add apikey header (required by Supabase Edge Functions)
      if (anonKey) {
        headers['apikey'] = anonKey;
      }
      
      // Add Authorization header if user is authenticated
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      console.log('🔐 Headers:', Object.keys(headers).join(', '));
      
      const response = await fetch(fullWebhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText.substring(0, 500) }; // Limit raw text length
      }

      setTestResult({
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data: responseData,
        timestamp: new Date().toISOString()
      });

      // Refresh webhook calls after a short delay to allow DB write
      setTimeout(() => {
        fetchWebhookCalls();
      }, 2000);
    } catch (error) {
      console.error('❌ Webhook test error:', error);
      setTestResult({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'rejected': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Webhook Testing" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Test Interface */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Test Webhook</h2>
            
            <div className="space-y-4">
              {/* Bot Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Bot
                </label>
                <select
                  value={selectedBot}
                  onChange={(e) => setSelectedBot(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a bot...</option>
                  {bots.map(bot => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name} ({bot.symbols && bot.symbols.length > 1 
                        ? `${bot.symbols.join(', ')} (${bot.symbols.length} pairs)` 
                        : bot.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              {/* Webhook Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Secret
                </label>
                {!webhookSecret ? (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800 mb-2">
                      ⚠️ No webhook secret configured for this bot
                    </p>
                    <Button
                      onClick={async () => {
                        if (!selectedBot) return;
                        const newSecret = generateWebhookSecret();
                        try {
                          console.log('🔄 Generating webhook secret for bot:', selectedBot);
                          await updateBot(selectedBot, { webhookSecret: newSecret });
                          
                          // Update local state immediately (don't wait for bots list refresh)
                          setWebhookSecret(newSecret);
                          console.log('✅ Webhook secret state updated:', newSecret);
                          
                          // Update the payload with the new secret immediately (using comprehensive TradingView format)
                          const bot = bots.find(b => b.id === selectedBot);
                          if (bot) {
                            const payload = {
                              secret: newSecret,
                              botId: bot.id,
                              action: 'buy', // {{strategy.order.action}} - Can be: 'buy', 'sell', 'long', 'short'
                              marketPosition: 'long', // {{strategy.market_position}}
                              prevMarketPosition: 'flat', // {{strategy.prev_market_position}}
                              marketPositionSize: '1.0', // {{strategy.market_position_size}}
                              prevMarketPositionSize: '0.0', // {{strategy.prev_market_position_size}}
                              instrument: 'BTCUSDT', // {{ticker}}
                              timestamp: new Date().toISOString(), // {{timenow}}
                              maxLag: '300',
                              investmentType: 'base',
                              amount: '1.0', // {{strategy.order.contracts}}
                              mode: 'paper',
                              reason: 'Test webhook from testing interface'
                            };
                            setTestPayload(JSON.stringify(payload, null, 2));
                            console.log('✅ Test payload updated with new secret');
                          }
                          
                          // Small delay to ensure state updates are processed
                          setTimeout(() => {
                            console.log('✅ Webhook secret generated! Button should now be enabled.');
                          }, 100);
                          
                          alert('✅ Webhook secret generated! You can now test the webhook.');
                        } catch (error) {
                          console.error('❌ Error generating webhook secret:', error);
                          alert('❌ Failed to generate webhook secret. Please try again.');
                        }
                      }}
                      variant="primary"
                      size="sm"
                    >
                      <i className="ri-refresh-line mr-2"></i>
                      Generate Webhook Secret
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={webhookSecret}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      <i className={showSecret ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                    </Button>
                  </div>
                )}
              </div>

              {/* Test Payload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Payload (JSON)
                </label>
                <textarea
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"secret": "...", "botId": "...", "action": "{{strategy.order.action}}", "mode": "paper"}'
                />
              </div>

              {/* Test Button */}
              <Button
                onClick={handleTestWebhook}
                loading={isTesting}
                disabled={!webhookSecret || webhookSecret.trim() === '' || !selectedBot}
                className="w-full"
              >
                <i className="ri-send-plane-line mr-2"></i>
                Send Test Webhook
              </Button>
              {(!webhookSecret || webhookSecret.trim() === '') && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Please generate a webhook secret first
                </p>
              )}
              {webhookSecret && webhookSecret.trim() !== '' && selectedBot && (
                <p className="text-xs text-green-600 mt-1">
                  ✅ Ready to test! Secret is configured.
                </p>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg border-2 ${
                  testResult.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">
                      {testResult.ok ? '✅ Success' : '❌ Error'}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(testResult.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="mb-2">
                      <strong>Status:</strong> {testResult.status} {testResult.statusText}
                    </p>
                    <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                      {JSON.stringify(testResult.data || testResult.error, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Webhook Calls History */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Webhook Calls</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchWebhookCalls}
                loading={loadingCalls}
              >
                <i className="ri-refresh-line mr-2"></i>
                Refresh
              </Button>
            </div>

            {loadingCalls ? (
              <div className="text-center py-8">
                <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                <p className="mt-2 text-gray-500">Loading webhook calls...</p>
              </div>
            ) : webhookCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="ri-file-list-line text-3xl mb-2"></i>
                <p>No webhook calls recorded yet</p>
                <p className="text-sm mt-1">Send a test webhook to see it here</p>
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-left max-w-md mx-auto">
                  <p className="text-xs font-semibold text-orange-800 mb-2">⚠️ Troubleshooting:</p>
                  <ul className="text-xs text-orange-700 space-y-1 list-disc list-inside">
                    <li>Ensure the webhook_calls table migration has been run</li>
                    <li>Check that the webhook function is deployed</li>
                    <li>Open browser console (F12) to see detailed logs</li>
                    <li>Verify the webhook URL is correct (should start with https://)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Side</th>
                      <th className="px-4 py-2 text-left">Mode</th>
                      <th className="px-4 py-2 text-left">Response</th>
                      <th className="px-4 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookCalls.map(call => (
                      <tr key={call.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          {formatDateTime(call.created_at)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(call.status)}`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 uppercase font-semibold">
                          {call.side || '—'}
                        </td>
                        <td className="px-4 py-2 capitalize">
                          {call.mode || '—'}
                        </td>
                        <td className="px-4 py-2">
                          {call.response_status ? (
                            <span className={`font-semibold ${
                              call.response_status >= 200 && call.response_status < 300
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {call.response_status}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {call.error_message ? (
                            <span className="text-red-600 text-xs" title={call.error_message}>
                              {call.error_message.substring(0, 50)}...
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

