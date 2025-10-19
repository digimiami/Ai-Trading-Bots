
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    experience: '',
    riskTolerance: '',
    tradingGoals: '',
    initialCapital: '',
    preferredExchange: ''
  });

  const steps = [
    {
      title: 'Welcome to Pablo',
      subtitle: 'AI-Powered Trading Bots',
      content: (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <i className="ri-robot-line text-4xl text-blue-600"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Start Your Trading Journey</h2>
            <p className="text-gray-600">
              Create intelligent trading bots that work 24/7 across multiple exchanges
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-check-line text-green-600"></i>
              </div>
              <span className="text-gray-700">Multi-exchange support (Bybit, OKX)</span>
            </div>
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-check-line text-green-600"></i>
              </div>
              <span className="text-gray-700">Advanced risk management</span>
            </div>
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-check-line text-green-600"></i>
              </div>
              <span className="text-gray-700">Real-time performance tracking</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Trading Experience',
      subtitle: 'Help us understand your background',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">What's your trading experience?</h3>
          <div className="space-y-3">
            {[
              { value: 'beginner', label: 'Beginner', desc: 'New to trading' },
              { value: 'intermediate', label: 'Intermediate', desc: '1-3 years experience' },
              { value: 'advanced', label: 'Advanced', desc: '3+ years experience' },
              { value: 'professional', label: 'Professional', desc: 'Professional trader' }
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setFormData(prev => ({ ...prev, experience: value }))}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.experience === value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{label}</div>
                <div className="text-sm text-gray-500">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Risk Tolerance',
      subtitle: 'Set your comfort level',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">What's your risk tolerance?</h3>
          <div className="space-y-3">
            {[
              { value: 'conservative', label: 'Conservative', desc: 'Low risk, steady returns', color: 'green' },
              { value: 'moderate', label: 'Moderate', desc: 'Balanced risk and reward', color: 'blue' },
              { value: 'aggressive', label: 'Aggressive', desc: 'High risk, high potential returns', color: 'orange' }
            ].map(({ value, label, desc, color }) => (
              <button
                key={value}
                onClick={() => setFormData(prev => ({ ...prev, riskTolerance: value }))}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.riskTolerance === value
                    ? `border-${color}-600 bg-${color}-50`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-${color}-100 rounded-full flex items-center justify-center`}>
                    <i className={`ri-shield-${value === 'conservative' ? 'check' : value === 'moderate' ? 'star' : 'flash'}-line text-${color}-600`}></i>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Trading Goals',
      subtitle: 'What do you want to achieve?',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">What are your trading goals?</h3>
          <div className="space-y-3">
            {[
              { value: 'passive-income', label: 'Passive Income', desc: 'Generate steady monthly returns' },
              { value: 'capital-growth', label: 'Capital Growth', desc: 'Grow portfolio value over time' },
              { value: 'learning', label: 'Learning', desc: 'Learn automated trading strategies' },
              { value: 'diversification', label: 'Diversification', desc: 'Diversify investment portfolio' }
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setFormData(prev => ({ ...prev, tradingGoals: value }))}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.tradingGoals === value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{label}</div>
                <div className="text-sm text-gray-500">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Initial Setup',
      subtitle: 'Configure your trading parameters',
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Trading Capital
            </label>
            <select
              value={formData.initialCapital}
              onChange={(e) => setFormData(prev => ({ ...prev, initialCapital: e.target.value }))}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select amount</option>
              <option value="100-500">$100 - $500</option>
              <option value="500-1000">$500 - $1,000</option>
              <option value="1000-5000">$1,000 - $5,000</option>
              <option value="5000-10000">$5,000 - $10,000</option>
              <option value="10000+">$10,000+</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Exchange
            </label>
            <div className="space-y-2">
              {[
                { value: 'bybit', label: 'Bybit', desc: 'Popular derivatives exchange' },
                { value: 'okx', label: 'OKX', desc: 'Global crypto exchange' },
                { value: 'both', label: 'Both', desc: 'Use multiple exchanges' }
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setFormData(prev => ({ ...prev, preferredExchange: value }))}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    formData.preferredExchange === value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{label}</div>
                  <div className="text-sm text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Ready to Start!',
      subtitle: 'Your account is configured',
      content: (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <i className="ri-check-line text-4xl text-green-600"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Set!</h2>
            <p className="text-gray-600">
              Your trading profile has been configured. You can now create your first bot.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Experience:</span>
              <span className="font-medium capitalize">{formData.experience}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Risk Tolerance:</span>
              <span className="font-medium capitalize">{formData.riskTolerance}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Goals:</span>
              <span className="font-medium capitalize">{formData.tradingGoals?.replace('-', ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Capital:</span>
              <span className="font-medium">${formData.initialCapital}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Exchange:</span>
              <span className="font-medium capitalize">{formData.preferredExchange}</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('user_profile', JSON.stringify(formData));
      navigate('/');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true;
      case 1: return formData.experience !== '';
      case 2: return formData.riskTolerance !== '';
      case 3: return formData.tradingGoals !== '';
      case 4: return formData.initialCapital !== '' && formData.preferredExchange !== '';
      case 5: return true;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Card */}
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {steps[currentStep].title}
            </h1>
            <p className="text-gray-500 text-sm">
              {steps[currentStep].subtitle}
            </p>
          </div>

          <div className="mb-8">
            {steps[currentStep].content}
          </div>

          {/* Navigation */}
          <div className="flex space-x-3">
            {currentStep > 0 && (
              <Button
                variant="secondary"
                onClick={handleBack}
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
            </Button>
          </div>
        </Card>

        {/* Skip Option */}
        {currentStep < steps.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Skip setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
