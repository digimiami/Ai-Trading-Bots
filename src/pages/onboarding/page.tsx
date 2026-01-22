import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import ApiKeyStep from '../../components/wizard/ApiKeyStep';
import TelegramStep from '../../components/wizard/TelegramStep';
import { useSetupWizard } from '../../hooks/useSetupWizard';

export default function Onboarding() {
  const navigate = useNavigate();
  const { markWizardCompleted, updateOnboardingData } = useSetupWizard();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    experience: '',
    riskTolerance: '',
    tradingGoals: '',
    initialCapital: '',
    preferredExchange: ''
  });
  const [apiKeyCompleted, setApiKeyCompleted] = useState(false);
  const [telegramCompleted, setTelegramCompleted] = useState(false);

  // Welcome step
  const welcomeStep = {
    title: 'Welcome to Pablo AI Trading',
    subtitle: 'Let\'s get you started',
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-robot-line text-4xl text-blue-600"></i>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Your Automated Trading Journey Starts Here
          </h3>
          <p className="text-gray-600">
            We'll guide you through a quick setup process to configure your account and get you trading in minutes.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start space-x-3">
            <i className="ri-checkbox-circle-line text-blue-600 text-xl"></i>
            <div>
              <div className="font-medium text-blue-900">Profile Setup</div>
              <div className="text-sm text-blue-700">Tell us about your trading experience</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <i className="ri-checkbox-circle-line text-blue-600 text-xl"></i>
            <div>
              <div className="font-medium text-blue-900">Connect Exchange & AI (Optional)</div>
              <div className="text-sm text-blue-700">Link exchange API keys (Bybit, MEXC, Bitunix) and OpenAI API key</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <i className="ri-checkbox-circle-line text-blue-600 text-xl"></i>
            <div>
              <div className="font-medium text-blue-900">Telegram Notifications (Optional)</div>
              <div className="text-sm text-blue-700">Get alerts on your phone</div>
            </div>
          </div>
        </div>
      </div>
    )
  };

  // Profile step components (reused from original)
  const profileSteps = [
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
                onClick={() => {
                  setFormData(prev => ({ ...prev, experience: value }));
                  updateOnboardingData({ experience: value });
                }}
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
              { value: 'conservative', label: 'Conservative', desc: 'Low risk, steady returns' },
              { value: 'moderate', label: 'Moderate', desc: 'Balanced risk and reward' },
              { value: 'aggressive', label: 'Aggressive', desc: 'High risk, high potential returns' }
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => {
                  setFormData(prev => ({ ...prev, riskTolerance: value }));
                  updateOnboardingData({ riskTolerance: value });
                }}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.riskTolerance === value
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
                onClick={() => {
                  setFormData(prev => ({ ...prev, tradingGoals: value }));
                  updateOnboardingData({ tradingGoals: value });
                }}
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
              onChange={(e) => {
                setFormData(prev => ({ ...prev, initialCapital: e.target.value }));
                updateOnboardingData({ initialCapital: e.target.value });
              }}
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
                { value: 'mexc', label: 'MEXC', desc: 'Global crypto exchange' },
                { value: 'bitunix', label: 'Bitunix', desc: 'Futures trading platform' },
                { value: 'multiple', label: 'Multiple', desc: 'Use multiple exchanges' }
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, preferredExchange: value }));
                    updateOnboardingData({ preferredExchange: value });
                  }}
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
    }
  ];

  // Completion step
  const completionStep = {
    title: 'Setup Complete!',
    subtitle: 'You\'re all set to start trading',
    content: (
      <div className="text-center space-y-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <i className="ri-check-line text-4xl text-green-600"></i>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Set!</h2>
          <p className="text-gray-600 mb-4">
            Your account has been configured. You can now start creating trading bots.
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Experience:</span>
            <span className="font-medium capitalize">{formData.experience || 'Not set'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Risk Tolerance:</span>
            <span className="font-medium capitalize">{formData.riskTolerance || 'Not set'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Goals:</span>
            <span className="font-medium capitalize">{(formData.tradingGoals || 'Not set').replace('-', ' ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Capital:</span>
            <span className="font-medium">{formData.initialCapital ? `$${formData.initialCapital}` : 'Not set'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Exchange:</span>
            <span className="font-medium capitalize">{formData.preferredExchange || 'Not set'}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">API Keys:</span>
              <span className={`font-medium ${apiKeyCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {apiKeyCompleted ? 'Connected' : 'Skipped'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Telegram:</span>
              <span className={`font-medium ${telegramCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {telegramCompleted ? 'Connected' : 'Skipped'}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  };

  // Calculate total steps
  const totalSteps = 1 + profileSteps.length + 2 + 1; // Welcome + Profile + API + Telegram + Completion

  const getCurrentStepData = () => {
    if (currentStep === 0) return welcomeStep;
    if (currentStep <= profileSteps.length) return profileSteps[currentStep - 1];
    if (currentStep === profileSteps.length + 1) return { title: 'API Keys', subtitle: 'Connect your exchange (Optional)' };
    if (currentStep === profileSteps.length + 2) return { title: 'Telegram', subtitle: 'Setup notifications (Optional)' };
    return completionStep;
  };

  const handleNext = async () => {
    const stepData = getCurrentStepData();
    
    if (currentStep === totalSteps - 1) {
      // Final step - complete wizard
      await markWizardCompleted(formData);
      navigate('/dashboard');
      return;
    }

    // Special handling for API and Telegram steps
    if (currentStep === profileSteps.length + 1 && !apiKeyCompleted) {
      // API step - skip if not completed
      setCurrentStep(currentStep + 1);
      return;
    }

    if (currentStep === profileSteps.length + 2 && !telegramCompleted) {
      // Telegram step - skip if not completed
      setCurrentStep(currentStep + 1);
      return;
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    const stepData = getCurrentStepData();
    
    if (currentStep === 0) return true; // Welcome step
    if (currentStep <= profileSteps.length) {
      const profileIdx = currentStep - 1;
      switch (profileIdx) {
        case 0: return formData.experience !== '';
        case 1: return formData.riskTolerance !== '';
        case 2: return formData.tradingGoals !== '';
        case 3: return formData.initialCapital !== '' && formData.preferredExchange !== '';
        default: return true;
      }
    }
    if (currentStep === profileSteps.length + 1) return apiKeyCompleted; // API step - can proceed if completed or skip
    if (currentStep === profileSteps.length + 2) return telegramCompleted; // Telegram step - can proceed if completed or skip
    return true; // Completion step
  };

  const renderStepContent = () => {
    const stepData = getCurrentStepData();
    
    if (currentStep === profileSteps.length + 1) {
      return (
        <ApiKeyStep
          onSkip={() => {
            setApiKeyCompleted(false);
            setCurrentStep(currentStep + 1);
          }}
          onComplete={() => {
            setApiKeyCompleted(true);
            setCurrentStep(currentStep + 1);
          }}
        />
      );
    }

    if (currentStep === profileSteps.length + 2) {
      return (
        <TelegramStep
          onSkip={() => {
            setTelegramCompleted(false);
            setCurrentStep(currentStep + 1);
          }}
          onComplete={() => {
            setTelegramCompleted(true);
            setCurrentStep(currentStep + 1);
          }}
        />
      );
    }

    return stepData.content;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Card */}
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {getCurrentStepData().title}
            </h1>
            <p className="text-gray-500 text-sm">
              {getCurrentStepData().subtitle}
            </p>
          </div>

          <div className="mb-8">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          {(currentStep < profileSteps.length + 1 || currentStep > profileSteps.length + 2) && (
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
                {currentStep === totalSteps - 1 ? 'Get Started' : 'Continue'}
              </Button>
            </div>
          )}
        </Card>

        {/* Skip Option - only show on profile steps */}
        {currentStep > 0 && currentStep <= profileSteps.length && (
          <div className="text-center mt-4">
            <button
              onClick={async () => {
                await markWizardCompleted(formData);
                navigate('/dashboard');
              }}
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
