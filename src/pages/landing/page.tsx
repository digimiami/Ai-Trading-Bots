import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import SocialShare from '../../components/ui/SocialShare';
import TradingRobot3D from '../../components/ui/TradingRobot3D';

const META_TAGS = [
  {
    name: 'description',
    content:
      'Pablo is the autonomous crypto trading platform that fuses neural networks, risk intelligence, and real-time exchange execution to keep you in the market 24/7.',
  },
  {
    name: 'keywords',
    content:
      'AI trading bots, crypto automation, Pablo trading, algorithmic trading, automated crypto strategies, futures trading automation',
  },
  {
    property: 'og:title',
    content: 'Pablo AI Trading Bots | Hyper-Automated Crypto Execution',
  },
  {
    property: 'og:description',
    content:
      'Launch institutional-grade trading bots in minutes. Pablo orchestrates market data, machine learning, and risk controls so you can scale across exchanges without writing code.',
  },
  {
    property: 'og:type',
    content: 'website',
  },
  {
    property: 'og:image',
    content: `${typeof window !== 'undefined' ? window.location.origin : ''}/og-image.png`,
  },
  {
    name: 'twitter:card',
    content: 'summary_large_image',
  },
  {
    name: 'twitter:title',
    content: 'Pablo AI Trading Bots | Hyper-Automated Crypto Execution',
  },
  {
    name: 'twitter:description',
    content:
      'Scale crypto strategies with Pablo—an intelligent automation layer that continuously optimizes entries, exits, and position sizing in real time.',
  },
];

type MetaDefinition = {
  name?: string;
  property?: string;
  content: string;
};

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { plans, loading: plansLoading } = useSubscription();
  const selectedCurrency = 'USD'; // Fixed to USD for landing page

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const previousTitle = document.title;
    const newTitle = 'Pablo AI Trading Bots | Hyper-Automated Crypto Execution';
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

    const canonicalHref = `${window.location.origin}/`;
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const createdCanonical = !canonicalLink;
    let previousCanonical = '';
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    } else {
      previousCanonical = canonicalLink.href;
    }
    canonicalLink.href = canonicalHref;

    return () => {
      document.title = previousTitle;
      appliedMeta.forEach(({ element, created, previousContent }) => {
        if (created) {
          document.head.removeChild(element);
        } else {
          element.setAttribute('content', previousContent);
        }
      });
      if (createdCanonical && canonicalLink && document.head.contains(canonicalLink)) {
        document.head.removeChild(canonicalLink);
      } else if (canonicalLink && previousCanonical) {
        canonicalLink.href = previousCanonical;
      }
    };
  }, []);

  // Add AI Workers script only on homepage
  useEffect(() => {
    const scriptId = 'aiworkers-widget-script';
    
    // Remove any existing script/widget from previous installations
    const existingScript = document.getElementById(scriptId);
    if (existingScript && existingScript.parentNode) {
      existingScript.parentNode.removeChild(existingScript);
    }

    // Remove any existing widget containers that might have been created
    const widgetContainers = document.querySelectorAll('[id*="aiworkers"], [class*="aiworkers"], [id*="widget"], [data-aiworkers]');
    widgetContainers.forEach(el => {
      try {
        el.parentNode?.removeChild(el);
      } catch (e) {
        // Ignore errors if element was already removed
      }
    });

    // Remove script tags by src
    const existingScripts = document.querySelectorAll('script[src*="aiworkers.vip"]');
    existingScripts.forEach(script => {
      try {
        script.parentNode?.removeChild(script);
      } catch (e) {
        // Ignore errors if element was already removed
      }
    });

    // Create and add the script
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://aiworkers.vip/widget.js?clientId=1e2d0fff534f389d6f6b47ece19fde2715a9e5888b9c4ae63c31b2119b572db4';
    script.async = true;
    document.head.appendChild(script);

    // Cleanup: remove script and widget when component unmounts
    return () => {
      // Remove script
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove && scriptToRemove.parentNode) {
        scriptToRemove.parentNode.removeChild(scriptToRemove);
      }

      // Remove any widget containers
      const widgets = document.querySelectorAll('[id*="aiworkers"], [class*="aiworkers"], [id*="widget"], [data-aiworkers]');
      widgets.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          // Ignore errors
        }
      });

      // Remove any remaining script tags
      const scriptsToRemove = document.querySelectorAll('script[src*="aiworkers.vip"]');
      scriptsToRemove.forEach(s => {
        try {
          s.parentNode?.removeChild(s);
        } catch (e) {
          // Ignore errors
        }
      });
    };
  }, []);

  const handleSignup = () => {
    navigate('/auth');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950" style={{ color: '#ffffff' }}>
      {/* 3D Trading Robot Effect */}
      <TradingRobot3D />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)] blur-3xl opacity-80 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.35),_transparent_55%)] blur-3xl opacity-70 pointer-events-none" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
              alt="Pablo Logo" 
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
            />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-200/80">Pablo Bots</p>
              <p className="text-xs font-light text-slate-100">Autonomous Trading Network</p>
            </div>
          </button>

          <nav className="hidden items-center space-x-8 text-sm font-medium text-white md:flex">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              Features
            </button>
            <button onClick={() => navigate('/market-dashboard')} className="transition hover:text-white">
              Market Dashboard
            </button>
            <button onClick={() => navigate('/crypto-bubbles')} className="transition hover:text-white">
              Crypto Bubbles
            </button>
            <button onClick={() => navigate('/crypto-news')} className="transition hover:text-white">
              Crypto News
            </button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              Pricing
            </button>
            <button onClick={() => navigate('/contact')} className="transition hover:text-white">
              Contact
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button size="sm" onClick={handleSignup}>Start Free Trial</Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16 text-center">
          <div className="flex-1 space-y-8 max-w-4xl">
            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-4 py-1 text-sm shadow-lg shadow-blue-500/10 backdrop-blur">
              <i className="ri-sparkling-2-fill text-blue-400" />
              <span className="text-white">14-Day Free Trial • No Credit Card Required</span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-white">Hyper-intelligent trading bots that</span> <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">learn the market in real time.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-white sm:text-xl">
              Pablo merges multi-exchange liquidity, deep learning models, and adaptive risk engines into a single neural console. Deploy bots that evolve with volatility—without writing a line of code.
            </p>
            <div className="flex flex-col items-center space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
              <Button size="lg" onClick={handleSignup}>
                Start Free Trial
                <i className="ri-arrow-right-up-line ml-2 text-lg" />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Features
                <i className="ri-scan-2-fill ml-2 text-base" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative mx-auto max-w-6xl px-6 pb-32">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-200 mb-4">Platform Features</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl mb-4">
              Everything you need to trade like a pro
            </h2>
            <p className="text-base text-white max-w-2xl mx-auto">
              Powerful tools and AI-driven insights to help you make smarter trading decisions
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
            {/* AI Assistant */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-xl text-white shadow-lg shadow-blue-500/40">
                  <i className="ri-robot-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">AI Assistant</h3>
                <p className="text-sm text-white">
                  Get intelligent trading recommendations powered by advanced AI. Ask questions, get strategy suggestions, and receive real-time market insights to optimize your trading decisions.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-blue-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>

            {/* Backtest */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 text-xl text-white shadow-lg shadow-emerald-500/40">
                  <i className="ri-bar-chart-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Backtest Engine</h3>
                <p className="text-sm text-white">
                  Test your trading strategies against historical data before risking real capital. Analyze performance, optimize parameters, and validate your approach with comprehensive backtesting tools.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-emerald-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>

            {/* Futures Pairs Finder */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-xl text-white shadow-lg shadow-purple-500/40">
                  <i className="ri-search-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Futures Pairs Finder</h3>
                <p className="text-sm text-white">
                  Discover the best trading opportunities across futures markets. Filter by volume, volatility, and performance metrics to find pairs that match your trading style and risk tolerance.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-purple-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>

            {/* AI ML Dashboard */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-xl text-white shadow-lg shadow-amber-500/40">
                  <i className="ri-brain-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">AI/ML Dashboard</h3>
                <p className="text-sm text-white">
                  Leverage machine learning models to predict market movements and optimize your trading strategies. Access advanced analytics, pattern recognition, and predictive insights.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-amber-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>

            {/* Ready Bots */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 text-xl text-white shadow-lg shadow-cyan-500/40">
                  <i className="ri-rocket-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Pablo Bots Ready</h3>
                <p className="text-sm text-white">
                  Deploy pre-configured, battle-tested trading bots in seconds. Choose from our curated selection of optimized strategies designed by professional traders and AI analysis.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-cyan-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>

            {/* Additional Feature */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-xl text-white shadow-lg shadow-indigo-500/40">
                  <i className="ri-shield-check-line" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Risk Management</h3>
                <p className="text-sm text-white">
                  Advanced risk controls and safety features to protect your capital. Set stop losses, take profits, leverage limits, and emergency stops to trade with confidence.
                </p>
                <div className="flex items-center space-x-2 text-sm font-medium text-indigo-300/80">
                  <span>Learn more</span>
                  <i className="ri-arrow-right-up-line" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="relative mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-200 mb-4">Pricing</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl mb-4">
              Start free, scale as you grow
            </h2>
            <p className="text-base text-white">
              Transparent pricing. Unlimited paper trading. Start with a 14-day free trial—no credit card required.
            </p>
          </div>

          {plansLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-white">Loading plans...</p>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-4">
              {plans.map((plan) => {
                const priceCrypto = plan.price_crypto as Record<string, string> || {};
                const displayPrice = selectedCurrency === 'USD' 
                  ? `$${plan.price_monthly_usd.toFixed(2)}`
                  : `${priceCrypto[selectedCurrency] || plan.price_monthly_usd} ${selectedCurrency}`;
                const isTesting = plan.name === 'Testing';
                const isPopular = plan.name === 'Pro';

                return (
                  <div
                    key={plan.id}
                    className={`relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition ${
                      isPopular ? 'scale-[1.02] border-blue-500/50 shadow-blue-500/20' : 'hover:-translate-y-1'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isTesting && (
                      <div className="absolute -top-4 right-4">
                        <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          14-Day Trial
                        </span>
                      </div>
                    )}

                    <div className="relative mt-8 space-y-6">
                      <div>
                        <h3 className="text-2xl font-semibold text-white">{plan.display_name}</h3>
                        <p className="mt-3 text-sm text-white min-h-[40px]">{plan.description}</p>
                      </div>
                      <div className="flex items-end space-x-2">
                        <span className="text-4xl font-semibold text-white">
                          {plan.price_monthly_usd === 0 ? 'Free' : displayPrice}
                        </span>
                        {plan.price_monthly_usd > 0 && (
                          <span className="text-sm text-white">/month</span>
                        )}
                      </div>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-center space-x-2">
                          <i className="ri-checkbox-circle-fill text-emerald-400" />
                          <span className="text-white">{plan.max_bots === null ? 'Unlimited' : plan.max_bots} Trading Bots</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <i className="ri-checkbox-circle-fill text-emerald-400" />
                          <span className="text-white">
                            {plan.max_trades_per_day === null 
                              ? 'Unlimited' 
                              : `${plan.max_trades_per_day}`} Trades/Day
                          </span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <i className="ri-checkbox-circle-fill text-emerald-400" />
                          <span className="text-white">
                            {plan.max_exchanges === null 
                              ? 'Unlimited' 
                              : `${plan.max_exchanges}`} Exchange{plan.max_exchanges !== 1 ? 's' : ''}
                          </span>
                        </li>
                        {plan.features?.paper_trading && (
                          <li className="flex items-center space-x-2">
                            <i className="ri-checkbox-circle-fill text-emerald-400" />
                            <span className="text-white">Paper Trading</span>
                          </li>
                        )}
                        {plan.features?.real_trading && (
                          <li className="flex items-center space-x-2">
                            <i className="ri-checkbox-circle-fill text-emerald-400" />
                            <span className="text-white">Real Trading</span>
                          </li>
                        )}
                        {plan.features?.ai_optimization && (
                          <li className="flex items-center space-x-2">
                            <i className="ri-checkbox-circle-fill text-emerald-400" />
                            <span className="text-white">AI Optimization</span>
                          </li>
                        )}
                      </ul>
                      <Button
                        className="w-full"
                        variant={isPopular ? 'primary' : 'secondary'}
                        onClick={handleSignup}
                      >
                        {isTesting ? 'Start Free Trial' : `Get ${plan.display_name}`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-white">
              All plans include access to all features. Upgrade anytime. Cancel anytime.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/70 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <img 
                src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
                alt="Pablo Logo" 
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
              />
              <span className="text-sm uppercase tracking-[0.3em] text-white">Pablo Bots</span>
            </div>
            <p className="mt-3 text-xs text-white">
              © {new Date().getFullYear()} Pablo Bots Trading Systems. Crafted for forward-looking funds and traders.
            </p>
            <div className="mt-4">
              <SocialShare 
                variant="compact"
                title="Pablo AI Trading Bots | Hyper-Automated Crypto Execution"
                description="Launch institutional-grade trading bots in minutes. Pablo orchestrates market data, machine learning, and risk controls so you can scale across exchanges without writing code."
                className="text-white"
              />
            </div>
          </div>
          <div className="flex flex-col items-start space-y-3 text-sm md:flex-row md:items-center md:space-x-6 md:space-y-0">
            <button onClick={() => navigate('/auth')} className="text-white transition hover:text-blue-300">
              Sign In
            </button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-white transition hover:text-blue-300">
              Features
            </button>
            <button onClick={() => navigate('/market-dashboard')} className="text-white transition hover:text-blue-300">
              Market Dashboard
            </button>
            <button onClick={() => navigate('/crypto-bubbles')} className="text-white transition hover:text-blue-300">
              Crypto Bubbles
            </button>
            <button onClick={() => navigate('/crypto-news')} className="text-white transition hover:text-blue-300">
              Crypto News
            </button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-white transition hover:text-blue-300">
              Pricing
            </button>
            <button onClick={() => navigate('/contact')} className="text-white transition hover:text-blue-300">
              Contact
            </button>
            <button onClick={() => navigate('/privacy')} className="text-white transition hover:text-blue-300">
              Privacy
            </button>
            <button onClick={() => navigate('/terms')} className="text-white transition hover:text-blue-300">
              Terms
            </button>
            <button onClick={() => navigate('/risk')} className="text-white transition hover:text-blue-300">
              Risk Disclosure
            </button>
            <button onClick={() => navigate('/cookies')} className="text-white transition hover:text-blue-300">
              Cookies
            </button>
            <button onClick={() => navigate('/disclaimer')} className="text-white transition hover:text-blue-300">
              Disclaimer
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
