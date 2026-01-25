import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { useAuth } from '../../hooks/useAuth';
import { useBots } from '../../hooks/useBots';
import { openAIService } from '../../services/openai';
import { supabase } from '../../lib/supabase';

// TypeScript declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmbedded = searchParams.get('embed') === '1';
  const { user } = useAuth();
  const { fetchBots } = useBots();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false);
  const [documentAnalysisEnabled, setDocumentAnalysisEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Load chat history from database
  const loadChatHistory = async () => {
    if (!user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').replace('/rest/v1', '');
      const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-assistant?action=load-history`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        let errBody: { error?: string; details?: string } = {};
        try {
          errBody = await response.json();
        } catch {
          errBody = { error: 'Unknown error' };
        }
        console.error('Failed to load chat history:', response.status, errBody?.error, errBody?.details);
        // Fall through to welcome message below
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
• **Edit User Settings**: I can update your notification preferences, alert settings, and risk management settings!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"
- "Enable email notifications for trade executed"
- "Set my daily loss limit to 500 USDT"

What would you like to know?`,
          timestamp: new Date()
        }]);
        return;
      }

      const { history } = await response.json();
      
      if (history && history.length > 0) {
        // Convert database format to Message format
        const loadedMessages: Message[] = history.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          attachments: msg.attachments ? (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments) : undefined
        }));
        
        setMessages(loadedMessages);
      } else {
        // No history, show welcome message
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
• **Edit User Settings**: I can update your notification preferences, alert settings, and risk management settings!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"
- "Enable email notifications for trade executed"
- "Set my daily loss limit to 500 USDT"

What would you like to know?`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // On error, show welcome message
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
• **Edit User Settings**: I can update your notification preferences, alert settings, and risk management settings!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"
- "Enable email notifications for trade executed"
- "Set my daily loss limit to 500 USDT"

What would you like to know?`,
        timestamp: new Date()
      }]);
    }
  };

  useEffect(() => {
    // Load AI Assistant settings from localStorage
    try {
      const saved = localStorage.getItem('ai_assistant_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setVoiceChatEnabled(settings.voiceChatEnabled || false);
        setDocumentAnalysisEnabled(settings.documentAnalysisEnabled !== false); // Default to true
      }
    } catch (e) {
      console.error('Error loading AI Assistant settings:', e);
    }

    // Check if AI API is configured
    const checkApiConfig = () => {
      const isOpenAIAvailable = openAIService.isProviderAvailable('openai');
      const isDeepSeekAvailable = openAIService.isProviderAvailable('deepseek');
      setApiConfigured(isOpenAIAvailable || isDeepSeekAvailable);
    };

    checkApiConfig();
    
    // Load chat history from database
    loadChatHistory();
  }, [user]);

  // Initialize Speech Recognition (Web Speech API)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setTranscript(prev => prev + finalTranscript);
            setInput(prev => (prev + finalTranscript).trim());
          } else {
            setTranscript(prev => {
              const base = prev;
              const current = base + interimTranscript;
              setInput(current.trim());
              return base;
            });
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          if (event.error === 'no-speech') {
            setError('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            setError('Microphone permission denied. Please enable microphone access.');
          } else {
            setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          setTranscript(''); // Clear interim transcript display
        };

        recognitionRef.current = recognition;
      }

      // Initialize Speech Synthesis
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !documentAnalysisEnabled) return;

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      file
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isRecording) {
      // Stop recording
      recognitionRef.current.stop();
      setIsRecording(false);
      // Don't clear transcript here - let onend handler process it
    } else {
      // Start recording
      setTranscript('');
      setInput(''); // Clear input to start fresh
      setError(null);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err: any) {
        console.error('Error starting speech recognition:', err);
        setError('Failed to start recording. Please try again.');
        setIsRecording(false);
      }
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    synthRef.current.speak(utterance);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    if (!apiConfigured) {
      setError('Please configure your OpenAI or DeepSeek API key in Settings → AI API Configuration first.');
      return;
    }

    // Process attachments: upload large files to storage, small files as base64
    const attachmentData = await Promise.all(
      attachments.map(async (att) => {
        const MAX_BASE64_SIZE = 1024 * 1024; // 1MB - files larger than this will be uploaded to storage
        
        // For large files, upload to storage and send URL
        if (att.file.size > MAX_BASE64_SIZE) {
          try {
            const fileExt = att.name.split('.').pop();
            const fileName = `ai-assistant/${user?.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `ai-assistant/${user?.id}/${fileName}`;

            const { data, error } = await supabase.storage
              .from('message-attachments') // Reuse message-attachments bucket or create ai-assistant bucket
              .upload(filePath, att.file);

            if (error) {
              console.warn('Failed to upload large file to storage, falling back to base64:', error);
              // Fallback to base64 if upload fails
              return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  resolve({
                    name: att.name,
                    type: att.type,
                    data: reader.result as string
                  });
                };
                reader.onerror = reject;
                reader.readAsDataURL(att.file);
              });
            }

            const { data: { publicUrl } } = supabase.storage
              .from('message-attachments')
              .getPublicUrl(filePath);

            return {
              name: att.name,
              type: att.type,
              url: publicUrl
            };
          } catch (error) {
            console.error('Error uploading file to storage:', error);
            // Fallback to base64
            return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  name: att.name,
                  type: att.type,
                  data: reader.result as string
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(att.file);
            });
          }
        }
        
        // For small files, send as base64
        return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: att.name,
              type: att.type,
              data: reader.result as string
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(att.file);
        });
      })
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
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
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
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
          if (action.type === 'create_bot') {
            if (action.result?.success) {
              return `✅ Created bot: "${action.result.bot?.name}" (${action.result.bot?.symbol})`;
            } else {
              const errorMsg = action.result?.error || 'Unknown error';
              const details = action.result?.details ? `\n   Details: ${action.result.details}` : '';
              return `❌ Bot creation failed: ${errorMsg}${details}`;
            }
          } else if (action.type === 'update_bot') {
            if (action.result?.success) {
              return `✅ Updated bot: "${action.result.bot?.name}"`;
            } else {
              return `❌ Bot update failed: ${action.result?.error || 'Unknown error'}`;
            }
          } else if (action.type === 'get_bot_performance' && action.result?.success) {
            return `📊 Bot Performance: ${action.result.performance?.name} - PnL: ${action.result.performance?.pnl} USDT (${action.result.performance?.pnlPercentage}%)`;
          } else if (action.type === 'update_user_settings') {
            if (action.result?.success) {
              return `✅ Settings updated successfully`;
            } else {
              return `❌ Settings update failed: ${action.result?.error || 'Unknown error'}`;
            }
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
        
        // Speak the AI response if voice chat is enabled
        if (voiceChatEnabled && data.response && synthRef.current) {
          speakText(data.response);
        }
        
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
        
        // Speak the AI response if voice chat is enabled
        if (voiceChatEnabled && data.response && synthRef.current) {
          speakText(data.response);
        }
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

  const clearChat = async () => {
    const confirmClear = window.confirm('Are you sure you want to clear the chat history? This action cannot be undone.');
    if (!confirmClear) {
      return;
    }
    
    // Only clear if user confirms twice
    const doubleConfirm = window.confirm('This will permanently delete all chat messages. Continue?');
    if (!doubleConfirm) {
      return;
    }
    
    if (!user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
      const cleanUrl = supabaseUrl.replace('/rest/v1', '');
      const response = await fetch(
        `${cleanUrl}/functions/v1/ai-assistant?action=clear-history`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to clear chat history');
        setError('Failed to clear chat history. Please try again.');
        return;
      }

      // Clear local messages and show welcome message
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
• **Edit User Settings**: I can update your notification preferences, alert settings, and risk management settings!

**Try saying:**
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Update my bot to use tighter stop loss"
- "Show me my bot performance"
- "Enable email notifications for trade executed"
- "Set my daily loss limit to 500 USDT"

What would you like to know?`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
      setError('Failed to clear chat history. Please try again.');
    }
  };

  return (
    <div className={`${isEmbedded ? 'h-full' : 'min-h-screen'} bg-gray-50 dark:bg-gray-900`}>
      {!isEmbedded && (
        <>
          <Header 
            title="AI Assistant" 
            subtitle="Get help with bot settings and trading questions"
            showBack
          />
          <Navigation />
        </>
      )}
      
      <div className={`${isEmbedded ? 'px-4 py-4 h-full' : 'container mx-auto px-4 py-6 max-w-4xl pb-24'}`}>
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

        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: isEmbedded ? 'calc(100vh - 140px)' : 'calc(100vh - 250px)' }}>
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
                  {/* Show attachments if any */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center space-x-2 bg-blue-500/20 dark:bg-blue-900/40 border border-blue-400/30 dark:border-blue-700/50 rounded px-2 py-1 text-xs"
                        >
                          <i className="ri-file-line"></i>
                          <span>{att.name}</span>
                          <span className="text-blue-200 dark:text-blue-300">
                            ({(att.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
            
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm"
                  >
                    <i className="ri-file-line text-blue-600 dark:text-blue-400"></i>
                    <span className="text-blue-900 dark:text-blue-100">{att.name}</span>
                    <span className="text-blue-600 dark:text-blue-400 text-xs">
                      ({(att.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      type="button"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Recording Indicator */}
            {isRecording && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                  Recording... Speak now
                </span>
                {transcript && (
                  <span className="text-xs text-red-600 dark:text-red-500 italic">
                    "{transcript}"
                  </span>
                )}
              </div>
            )}

            <div className="flex space-x-2">
              <div className="flex-1 flex flex-col">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about bot settings, trading strategies, or platform features..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-white"
                  rows={3}
                  disabled={loading || !apiConfigured}
                />
                <div className="flex items-center space-x-2 mt-2">
                  {documentAnalysisEnabled && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || !apiConfigured}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Attach Document"
                      type="button"
                    >
                      <i className="ri-attachment-line text-lg"></i>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.txt,.doc,.docx,.csv,.xlsx,.json"
                    disabled={!documentAnalysisEnabled}
                  />
                  {voiceChatEnabled && (
                    <button
                      onClick={toggleVoiceRecording}
                      disabled={loading || !apiConfigured}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        isRecording
                          ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                          : 'text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={isRecording ? 'Stop Recording (Click again or it will auto-stop)' : 'Start Voice Chat'}
                      type="button"
                    >
                      <i className={`ri-mic-line text-lg ${isRecording ? 'animate-pulse' : ''}`}></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={loading || (!input.trim() && attachments.length === 0) || !apiConfigured}
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
              {documentAnalysisEnabled && ' • Click attachment icon to upload documents'}
              {voiceChatEnabled && ' • Click microphone for voice chat'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

