import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { useAuth } from '../../hooks/useAuth';
import { useBots } from '../../hooks/useBots';
import { openAIService } from '../../services/openai';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchBots } = useBots();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if AI API is configured
    const checkApiConfig = () => {
      const isOpenAIAvailable = openAIService.isProviderAvailable('openai');
      const isDeepSeekAvailable = openAIService.isProviderAvailable('deepseek');
      setApiConfigured(isOpenAIAvailable || isDeepSeekAvailable);
    };

    checkApiConfig();
    
    // Add welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your AI Trading Assistant. I can help you with:

• **Bot Configuration**: Explain any setting, strategy, or parameter
• **Trading Strategies**: Understand RSI, ADX, Bollinger Bands, and more
• **Risk Management**: Help configure stop-loss, take-profit, and position sizing
• **Platform Features**: Guide you through creating bots, managing trades, and more
• **Trading Questions**: Answer questions about cryptocurrency trading, technical analysis, and market behavior
• **Create & Edit Bots**: I can create new bots or modify existing ones based on your requests!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"

What would you like to know?`,
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!apiConfigured) {
      setError('Please configure your OpenAI or DeepSeek API key in Settings → AI API Configuration first.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';
      const cleanUrl = supabaseUrl.replace('/rest/v1', '');
      const functionUrl = `${cleanUrl}/functions/v1/ai-assistant`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get user's API keys from localStorage (if configured in Settings)
      const openaiKey = localStorage.getItem('ai_openai_api_key') || '';
      const deepseekKey = localStorage.getItem('ai_deepseek_api_key') || '';
      const providerPreference = localStorage.getItem('ai_provider_preference') || '';
      
      // Determine which provider and key to use
      let apiKey = '';
      let provider = '';
      
      if (providerPreference === 'deepseek' && deepseekKey) {
        apiKey = deepseekKey;
        provider = 'deepseek';
      } else if (providerPreference === 'openai' && openaiKey) {
        apiKey = openaiKey;
        provider = 'openai';
      } else if (deepseekKey) {
        apiKey = deepseekKey;
        provider = 'deepseek';
      } else if (openaiKey) {
        apiKey = openaiKey;
        provider = 'openai';
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          })),
          ...(apiKey && provider ? { apiKey, provider } : {}) // Include user's API key if available
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Handle bot actions if any
      if (data.actions && data.actions.length > 0) {
        setPendingActions(data.actions);
        
        // Show action summary in message
        const actionSummary = data.actions.map((action: any) => {
          if (action.type === 'create_bot' && action.result?.success) {
            return `✅ Created bot: "${action.result.bot?.name}" (${action.result.bot?.symbol})`;
          } else if (action.type === 'update_bot' && action.result?.success) {
            return `✅ Updated bot: "${action.result.bot?.name}"`;
          } else if (action.type === 'get_bot_performance' && action.result?.success) {
            return `📊 Bot Performance: ${action.result.performance?.name} - PnL: ${action.result.performance?.pnl} USDT (${action.result.performance?.pnlPercentage}%)`;
          } else if (action.result?.error) {
            return `❌ ${action.type} failed: ${action.result.error}`;
          }
          return null;
        }).filter(Boolean).join('\n');
        
        // Refresh bot list
        try {
          await fetchBots();
        } catch (err) {
          console.warn('Failed to refresh bots:', err);
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `${data.response || 'I apologize, but I could not generate a response.'}\n\n${actionSummary ? `\n**Actions Completed:**\n${actionSummary}` : ''}`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Clear pending actions after showing
        setTimeout(() => setPendingActions([]), 5000);
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'I apologize, but I could not generate a response.',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to get AI response. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${err.message || 'Failed to get AI response. Please check your API configuration in Settings.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your AI Trading Assistant. I can help you with:

• **Bot Configuration**: Explain any setting, strategy, or parameter
• **Trading Strategies**: Understand RSI, ADX, Bollinger Bands, and more
• **Risk Management**: Help configure stop-loss, take-profit, and position sizing
• **Platform Features**: Guide you through creating bots, managing trades, and more
• **Trading Questions**: Answer questions about cryptocurrency trading, technical analysis, and market behavior
• **Create & Edit Bots**: I can create new bots or modify existing ones based on your requests!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"

What would you like to know?`,
      timestamp: new Date()
    }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        title="AI Assistant" 
        subtitle="Get help with bot settings and trading questions"
        showBack
      />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {!apiConfigured && (
          <Card className="p-4 mb-4 bg-yellow-50 border-yellow-200 border-2">
            <div className="flex items-start">
              <i className="ri-alert-line text-yellow-600 text-xl mr-3 mt-1"></i>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">AI API Not Configured</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  Please configure your OpenAI or DeepSeek API key in Settings to use the AI Assistant.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  Go to Settings
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 250px)' }}>
          {/* Action Notifications */}
          {pendingActions.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <i className="ri-checkbox-circle-line text-green-600 dark:text-green-400"></i>
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    {pendingActions.length} action(s) completed
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigate('/bots');
                    setPendingActions([]);
                  }}
                >
                  View Bots
                </Button>
              </div>
            </div>
          )}
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            {error && (
              <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="flex space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about bot settings, trading strategies, or platform features..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-white"
                rows={3}
                disabled={loading || !apiConfigured}
              />
              <div className="flex flex-col space-y-2">
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={loading || !input.trim() || !apiConfigured}
                  className="h-full"
                >
                  {loading ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-send-plane-fill"></i>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearChat}
                  disabled={loading}
                  size="sm"
                  title="Clear Chat"
                >
                  <i className="ri-delete-bin-line"></i>
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

