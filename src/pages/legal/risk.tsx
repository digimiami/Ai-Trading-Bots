import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';

const META = {
  title: 'Pablo Risk Disclosure | Automated Trading',
  description:
    'Review the market, liquidity, technology, and regulatory risks associated with deploying automated trading bots through Pablo.',
};

export default function RiskDisclosurePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = META.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const bullets = [
    {
      title: 'Market & Liquidity Risk',
      description:
        'Digital assets are highly volatile. Rapid price swings, order book gaps, slippage, and liquidity droughts may lead to losses that exceed collateral posted on margin exchanges.',
    },
    {
      title: 'Exchange Counterparty Risk',
      description:
        'Your funds remain on the connected exchange. Pablo has no custody. Exchange downtime, insolvency events, or liquidation engines may adversely affect positions. Use robust API key permissions and withdraw idle balances.',
    },
    {
      title: 'Automation & Model Risk',
      description:
        'Strategies that perform in backtests may fail in live markets. Model drift, data latency, or incorrect parameters can trigger unintended trades. Monitor bots and configure manual overrides and drawdown limits.',
    },
    {
      title: 'Technology Risk',
      description:
        'Despite redundant infrastructure, outages and connectivity disruptions can occur. Maintain contingency plans and review activity logs to confirm orders and fills.',
    },
    {
      title: 'Regulatory & Tax Risk',
      description:
        'You are responsible for complying with local regulations and reporting obligations. Pablo does not offer legal, tax, or investment advice.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <img 
                src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
                alt="Pablo Logo" 
                className="h-10 w-10 object-contain"
              />
              <span className="text-gray-900 font-semibold">Pablo Trading</span>
            </button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-wider text-gray-500 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Risk Disclosure</h1>
          <div className="p-4 bg-red-50 border-l-4 border-red-400 mb-4">
            <p className="text-sm text-red-800 font-semibold">
              ⚠️ Automated crypto trading involves substantial risk. You may lose some or all of your investment.
            </p>
          </div>
        </header>

        <section className="space-y-6">
          {bullets.map((item) => (
            <div key={item.title} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h2>
              <p className="text-gray-700">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Responsibilities</h2>
          <ul className="space-y-3 text-gray-700">
            {[
              'Backtest strategies thoroughly and start with reduced position sizes.',
              'Review leverage settings, funding rates, and margin requirements daily.',
              'Enable alerts and monitor system notifications to respond quickly to anomalies.',
              'Consult licensed professionals for legal, tax, or investment guidance.',
            ].map((item) => (
              <li key={item} className="flex items-start space-x-2">
                <span className="mt-1 text-blue-500">
                  <i className="ri-checkbox-circle-fill" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/disclaimer')}>
            Disclaimer
          </Button>
          <Button variant="secondary" onClick={() => navigate('/terms')}>
            Terms of Service
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-4 text-sm">
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-white transition">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-white transition">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/risk')} className="hover:text-white transition">
                    Risk Disclosure
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/cookies')} className="hover:text-white transition">
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Platform</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/auth')} className="hover:text-white transition">
                    Sign In
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/pricing')} className="hover:text-white transition">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/contact')} className="hover:text-white transition">
                    Contact
                  </button>
                </li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs mt-4">
                © {new Date().getFullYear()} Pablo Trading Platform. All rights reserved.
              </p>
              <p className="text-xs mt-2">
                Pablo is a software platform providing trading automation tools. We do not handle user funds. 
                Trading involves substantial risk of loss.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

