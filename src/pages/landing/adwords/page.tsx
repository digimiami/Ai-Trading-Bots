import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/base/Button';
import { useAuth } from '../../../hooks/useAuth';
import { useSubscription } from '../../../hooks/useSubscription';

const META_TAGS = [
  {
    name: 'description',
    content:
      'Pablo is a cryptocurrency trading automation platform that provides tools for algorithmic trading. We do not handle user funds. Trading involves risk and past performance does not guarantee future results.',
  },
  {
    name: 'keywords',
    content:
      'crypto trading automation, algorithmic trading tools, trading bot platform, cryptocurrency trading software',
  },
  {
    property: 'og:title',
    content: 'Pablo AI Trading Platform | Automated Cryptocurrency Trading Tools',
  },
  {
    property: 'og:description',
    content:
      'Professional trading automation platform for cryptocurrency markets. We provide tools and infrastructure only. We do not handle user funds. Trading involves substantial risk.',
  },
  {
    property: 'og:type',
    content: 'website',
  },
];

type MetaDefinition = {
  name?: string;
  property?: string;
  content: string;
};

export default function AdWordsLandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plans, loading: plansLoading } = useSubscription();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const previousTitle = document.title;
    const newTitle = 'Pablo AI Trading Platform | Automated Cryptocurrency Trading Tools';
    document.title = newTitle;

    const appliedMeta = META_TAGS.map((meta: MetaDefinition) => {
      const selector = meta.name
        ? `meta[name="${meta.name}"]`
        : `meta[property="${meta.property}"]`;
      let element = document.head.querySelector(selector) as HTMLMetaElement | null;
      const created = !element;
      if (!element) {
        element = document.createElement('meta');
        if (meta.name) {
          element.name = meta.name;
        } else if (meta.property) {
          element.setAttribute('property', meta.property);
        }
        document.head.appendChild(element);
      }
      const previousContent = element.getAttribute('content') ?? '';
      element.setAttribute('content', meta.content);
      return { element, created, previousContent };
    });

    return () => {
      document.title = previousTitle;
      appliedMeta.forEach(({ element, created, previousContent }) => {
        if (created) {
          document.head.removeChild(element);
        } else {
          element.setAttribute('content', previousContent);
        }
      });
    };
  }, []);

  const handleSignup = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
              alt="Pablo Logo" 
              className="h-10 w-10 object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">Pablo Trading Platform</p>
              <p className="text-xs text-gray-600">Trading Automation Tools</p>
            </div>
          </button>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button size="sm" onClick={handleSignup}>Start Free Trial</Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-6 py-16 text-center">
          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <i className="ri-shield-check-line" />
              <span>14-Day Free Trial • No Credit Card Required</span>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
              Professional Cryptocurrency Trading Automation Platform
            </h1>
            
            <p className="mx-auto max-w-3xl text-lg text-gray-600 sm:text-xl">
              Pablo provides advanced trading automation tools and infrastructure for cryptocurrency markets. 
              Create, backtest, and deploy algorithmic trading strategies across multiple exchanges.
            </p>

            <div className="flex flex-col items-center justify-center space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0 pt-4">
              <Button size="lg" onClick={handleSignup}>
                Start Free Trial
                <i className="ri-arrow-right-line ml-2" />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Learn More
              </Button>
            </div>
          </div>
        </section>

        {/* Important Disclaimers Section */}
        <section className="bg-yellow-50 border-y border-yellow-200 py-8">
          <div className="mx-auto max-w-5xl px-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-2xl text-yellow-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Important Information</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>
                      <strong>We Do Not Handle User Funds:</strong> Pablo is a software platform that provides trading automation tools. 
                      All trading is executed directly on cryptocurrency exchanges. We do not hold, manage, or have access to your funds.
                    </li>
                    <li>
                      <strong>Trading Involves Risk:</strong> Cryptocurrency trading carries substantial risk of loss. 
                      Past performance does not guarantee future results. Only trade with funds you can afford to lose.
                    </li>
                    <li>
                      <strong>No Guaranteed Returns:</strong> Trading results vary based on market conditions, strategy selection, 
                      and risk management. There are no guarantees of profit or specific returns.
                    </li>
                    <li>
                      <strong>Educational Purpose:</strong> Our platform is designed for educational and research purposes. 
                      Users are responsible for their own trading decisions and risk management.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
              Professional Trading Tools
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive platform for developing, testing, and deploying algorithmic trading strategies
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 mb-4">
                <i className="ri-code-s-slash-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Algorithmic Trading</h3>
              <p className="text-gray-600">
                Create custom trading algorithms using our visual bot builder or connect your own strategies via API.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 mb-4">
                <i className="ri-bar-chart-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Backtesting Engine</h3>
              <p className="text-gray-600">
                Test your strategies against historical market data to evaluate performance before deploying with real capital.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 mb-4">
                <i className="ri-shield-check-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Risk Management</h3>
              <p className="text-gray-600">
                Built-in risk controls including stop-loss, position sizing, and leverage limits to help manage trading risk.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 mb-4">
                <i className="ri-exchange-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Exchange Support</h3>
              <p className="text-gray-600">
                Connect to multiple cryptocurrency exchanges from a single platform for diversified trading access.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 mb-4">
                <i className="ri-file-paper-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Paper Trading</h3>
              <p className="text-gray-600">
                Practice and refine your strategies using simulated trading with real market data, no real funds required.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600 mb-4">
                <i className="ri-line-chart-line text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Performance Analytics</h3>
              <p className="text-gray-600">
                Track and analyze your trading performance with detailed reports, metrics, and insights.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600">
                Simple steps to get started with algorithmic trading
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Create an Account</h3>
                  <p className="text-gray-600">
                    Sign up for a free trial account. No credit card required. Start with paper trading to learn the platform.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Exchange</h3>
                  <p className="text-gray-600">
                    Securely connect your cryptocurrency exchange account using API keys. Your funds remain on the exchange at all times.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Build and Test Strategies</h3>
                  <p className="text-gray-600">
                    Use our tools to create trading bots or import your own strategies. Backtest against historical data to evaluate performance.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Deploy and Monitor</h3>
                  <p className="text-gray-600">
                    Once satisfied with backtesting results, deploy your strategy. Monitor performance and adjust as needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="bg-gray-50 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
                Transparent Pricing
              </h2>
              <p className="text-lg text-gray-600">
                Start with a free trial. Upgrade when you're ready.
              </p>
            </div>

            {plansLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading plans...</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {plans.map((plan) => {
                  const isTesting = plan.name === 'Testing';
                  const isPopular = plan.name === 'Pro';

                  return (
                    <div
                      key={plan.id}
                      className={`bg-white rounded-lg border-2 p-6 shadow-sm ${
                        isPopular ? 'border-blue-500 shadow-md' : 'border-gray-200'
                      }`}
                    >
                      {isPopular && (
                        <div className="text-center mb-4">
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            Most Popular
                          </span>
                        </div>
                      )}
                      {isTesting && (
                        <div className="text-center mb-4">
                          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            14-Day Trial
                          </span>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                        </div>
                        <div>
                          <span className="text-3xl font-bold text-gray-900">
                            {plan.price_monthly_usd === 0 ? 'Free' : `$${plan.price_monthly_usd.toFixed(2)}`}
                          </span>
                          {plan.price_monthly_usd > 0 && (
                            <span className="text-gray-600">/month</span>
                          )}
                        </div>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center space-x-2">
                            <i className="ri-check-line text-green-600" />
                            <span className="text-gray-700">
                              {plan.max_bots === null ? 'Unlimited' : plan.max_bots} Trading Bots
                            </span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="ri-check-line text-green-600" />
                            <span className="text-gray-700">
                              {plan.max_trades_per_day === null 
                                ? 'Unlimited' 
                                : `${plan.max_trades_per_day}`} Trades/Day
                            </span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="ri-check-line text-green-600" />
                            <span className="text-gray-700">
                              {plan.max_exchanges === null 
                                ? 'Unlimited' 
                                : `${plan.max_exchanges}`} Exchange{plan.max_exchanges !== 1 ? 's' : ''}
                            </span>
                          </li>
                        </ul>
                        <Button
                          className="w-full"
                          variant={isPopular ? 'primary' : 'secondary'}
                          onClick={handleSignup}
                        >
                          {isTesting ? 'Start Free Trial' : `Get Started`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="bg-blue-600 py-16">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              Start your free trial today. No credit card required. Explore our platform with paper trading.
            </p>
            <Button size="lg" variant="secondary" onClick={handleSignup}>
              Start Free Trial
              <i className="ri-arrow-right-line ml-2" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
                  alt="Pablo Logo" 
                  className="h-8 w-8 object-contain"
                />
                <span className="text-white font-semibold">Pablo Trading</span>
              </div>
              <p className="text-sm">
                Professional cryptocurrency trading automation platform.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => navigate('/auth')} className="hover:text-white transition">
                    Sign In
                  </button>
                </li>
                <li>
                  <button onClick={handleSignup} className="hover:text-white transition">
                    Start Free Trial
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/pricing')} className="hover:text-white transition">
                    Pricing
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-white transition">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-white transition">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/risk')} className="hover:text-white transition">
                    Risk Disclosure
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => navigate('/contact')} className="hover:text-white transition">
                    Contact Us
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/help')} className="hover:text-white transition">
                    Help Center
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>
              © {new Date().getFullYear()} Pablo Trading Platform. All rights reserved.
            </p>
            <p className="mt-2 text-xs">
              <strong>Disclaimer:</strong> Pablo is a software platform providing trading automation tools. 
              We do not handle user funds. All trading is executed directly on cryptocurrency exchanges. 
              Trading involves substantial risk of loss. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

