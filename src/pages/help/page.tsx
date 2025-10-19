
import { useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';

export default function Help() {
  const [selectedCategory, setSelectedCategory] = useState('getting-started');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const categories = [
    { id: 'getting-started', label: 'Getting Started', icon: 'ri-play-line' },
    { id: 'bots', label: 'Trading Bots', icon: 'ri-robot-line' },
    { id: 'api', label: 'API Setup', icon: 'ri-code-line' },
    { id: 'security', label: 'Security', icon: 'ri-shield-line' },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: 'ri-tools-line' }
  ];

  const faqData = {
    'getting-started': [
      {
        id: '1',
        question: 'How do I create my first trading bot?',
        answer: 'To create your first bot, go to the Bots page and tap "Create Bot". Choose your trading pair, set your parameters like stop loss and take profit, then activate the bot. Make sure you have configured your exchange API keys first.'
      },
      {
        id: '2',
        question: 'What exchanges are supported?',
        answer: 'Pablo currently supports Bybit and OKX exchanges. We are continuously working to add more exchanges based on user demand.'
      },
      {
        id: '3',
        question: 'Is there a minimum deposit required?',
        answer: 'There is no minimum deposit required by Pablo. However, each exchange has its own minimum trading amounts. We recommend starting with at least $100 for meaningful trading.'
      }
    ],
    'bots': [
      {
        id: '4',
        question: 'How do stop loss and take profit work?',
        answer: 'Stop loss automatically closes your position when losses reach a set percentage to protect your capital. Take profit closes positions when they reach your target profit percentage. Both are essential risk management tools.'
      },
      {
        id: '5',
        question: 'Can I run multiple bots simultaneously?',
        answer: 'Yes, you can run multiple bots at the same time. Each bot operates independently with its own parameters and risk settings. Monitor your total exposure to avoid overtrading.'
      },
      {
        id: '6',
        question: 'How often do bots execute trades?',
        answer: 'Bots monitor markets continuously and execute trades based on your configured strategy and market conditions. The frequency depends on market volatility and your bot settings.'
      }
    ],
    'api': [
      {
        id: '7',
        question: 'How do I set up exchange API keys?',
        answer: 'Go to Settings > API Configuration. Create API keys on your exchange with trading permissions enabled. Enter the keys in Pablo and test the connection. Never share your API keys with anyone.'
      },
      {
        id: '8',
        question: 'What permissions do API keys need?',
        answer: 'API keys need "Trade" and "Read" permissions. Do not enable "Withdraw" permissions for security. This allows bots to trade but prevents unauthorized withdrawals.'
      },
      {
        id: '9',
        question: 'Are my API keys secure?',
        answer: 'Yes, API keys are encrypted and stored securely. We use industry-standard encryption and never store withdrawal permissions. Your funds remain safe on the exchange.'
      }
    ],
    'security': [
      {
        id: '10',
        question: 'How is my account protected?',
        answer: 'We use multi-factor authentication, encrypted data storage, and secure API connections. Enable 2FA and use strong passwords for maximum security.'
      },
      {
        id: '11',
        question: 'Can Pablo access my exchange funds?',
        answer: 'No, Pablo cannot withdraw or transfer your funds. We only have trading permissions through API keys. Your funds always remain on the exchange under your control.'
      },
      {
        id: '12',
        question: 'What if I lose my phone?',
        answer: 'Contact support immediately to secure your account. You can also log in from another device and change your password. Enable device-specific security features.'
      }
    ],
    'troubleshooting': [
      {
        id: '13',
        question: 'My bot is not executing trades',
        answer: 'Check your API key permissions, ensure sufficient balance, verify bot is active, and check if market conditions meet your strategy criteria. Review bot logs for specific errors.'
      },
      {
        id: '14',
        question: 'Why are my profits different from expectations?',
        answer: 'Profits depend on market conditions, fees, slippage, and timing. Past performance does not guarantee future results. Review your bot settings and market analysis.'
      },
      {
        id: '15',
        question: 'How do I contact support?',
        answer: 'Use the in-app chat feature, email support@pablo.ai, or visit our help center. Include your account details and specific issue description for faster assistance.'
      }
    ]
  };

  const guides = [
    {
      title: 'Quick Start Guide',
      description: 'Get up and running with your first trading bot in 5 minutes',
      icon: 'ri-rocket-line',
      color: 'blue',
      steps: ['Create account', 'Add API keys', 'Create bot', 'Start trading']
    },
    {
      title: 'Risk Management',
      description: 'Learn how to protect your capital with proper risk controls',
      icon: 'ri-shield-check-line',
      color: 'green',
      steps: ['Set stop losses', 'Configure position sizes', 'Monitor performance', 'Adjust strategies']
    },
    {
      title: 'Advanced Strategies',
      description: 'Explore sophisticated trading strategies for experienced users',
      icon: 'ri-brain-line',
      color: 'purple',
      steps: ['Market analysis', 'Strategy selection', 'Backtesting', 'Optimization']
    }
  ];

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Help & Support" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Quick Guides */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Guides</h3>
          <div className="space-y-4">
            {guides.map((guide, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 bg-${guide.color}-100 rounded-full flex items-center justify-center`}>
                    <i className={`${guide.icon} text-${guide.color}-600`}></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{guide.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{guide.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {guide.steps.map((step, stepIndex) => (
                        <span key={stepIndex} className="px-2 py-1 bg-white text-xs text-gray-600 rounded-full">
                          {stepIndex + 1}. {step}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Tabs */}
        <Card className="p-4">
          <div className="flex space-x-2 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className={category.icon}></i>
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* FAQ Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {faqData[selectedCategory as keyof typeof faqData]?.map((faq) => (
              <div key={faq.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <i className={`ri-arrow-${expandedFaq === faq.id ? 'up' : 'down'}-s-line text-gray-500`}></i>
                </button>
                {expandedFaq === faq.id && (
                  <div className="px-4 pb-4">
                    <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Contact Support */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Need More Help?</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="ri-chat-3-line text-blue-600"></i>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Live Chat</p>
                <p className="text-sm text-gray-600">Get instant help from our support team</p>
              </div>
              <button 
                onClick={() => {
                  const widget = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
                  if (widget) widget.click();
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Start Chat
              </button>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-mail-line text-gray-600"></i>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Email Support</p>
                <p className="text-sm text-gray-600">support@pablo.ai</p>
              </div>
              <a 
                href="mailto:support@pablo.ai"
                className="text-gray-600 hover:text-gray-700 text-sm font-medium"
              >
                Send Email
              </a>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-book-line text-gray-600"></i>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Documentation</p>
                <p className="text-sm text-gray-600">Comprehensive guides and tutorials</p>
              </div>
              <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                View Docs
              </button>
            </div>
          </div>
        </Card>

        {/* App Info */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">App Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-900">1.2.3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Updated</span>
              <span className="text-gray-900">January 15, 2024</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Platform</span>
              <span className="text-gray-900">Web App</span>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
