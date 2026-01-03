import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';

const META = {
  title: 'Pablo Disclaimer | Trading Platform',
  description:
    'Important disclaimer regarding the use of Pablo trading automation platform and cryptocurrency trading risks.',
};

export default function DisclaimerPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = META.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const disclaimers = [
    {
      title: 'No Investment Advice',
      content: [
        'Pablo Trading Platform is a software tool that provides trading automation services. We do not provide investment, financial, legal, or tax advice.',
        'All trading decisions are made by you. You are solely responsible for evaluating the merits and risks associated with using our platform and any trading strategies you implement.',
      ],
    },
    {
      title: 'No Guarantee of Results',
      content: [
        'Past performance does not guarantee future results. Historical backtesting results are not indicative of future performance.',
        'Trading results vary based on market conditions, strategy selection, risk management, and other factors beyond our control.',
        'There is no guarantee that you will achieve profits or avoid losses when using our platform.',
      ],
    },
    {
      title: 'We Do Not Handle Funds',
      content: [
        'Pablo does not hold, manage, or have access to your funds. All trading is executed directly on cryptocurrency exchanges that you connect to our platform.',
        'Your funds remain on the exchange at all times. We only send trading instructions via API keys that you provide.',
        'You are responsible for the security of your exchange accounts and API keys.',
      ],
    },
    {
      title: 'Trading Risks',
      content: [
        'Cryptocurrency trading involves substantial risk of loss. You may lose some or all of your invested capital.',
        'Leveraged trading amplifies both gains and losses. You can lose more than your initial investment when using leverage.',
        'Market volatility, technical issues, exchange downtime, and other factors can result in significant losses.',
      ],
    },
    {
      title: 'Platform Availability',
      content: [
        'While we strive to maintain high availability, we do not guarantee uninterrupted access to our platform.',
        'Technical issues, maintenance, or third-party service disruptions may temporarily prevent access to our services.',
        'We are not liable for any losses resulting from platform unavailability or technical issues.',
      ],
    },
    {
      title: 'Third-Party Services',
      content: [
        'Our platform integrates with third-party cryptocurrency exchanges and services. We are not responsible for the actions, policies, or services of these third parties.',
        'Exchange downtime, policy changes, or service limitations may affect your ability to trade.',
        'You should review and understand the terms of service and policies of any exchange you connect to our platform.',
      ],
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Disclaimer</h1>
          <p className="text-sm text-gray-600">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-sm text-yellow-800 font-semibold">
              ⚠️ Important: Please read this disclaimer carefully before using Pablo Trading Platform.
            </p>
          </div>
        </header>

        <section className="space-y-6">
          {disclaimers.map((disclaimer) => (
            <div key={disclaimer.title} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{disclaimer.title}</h2>
              <ul className="space-y-3 text-gray-700">
                {disclaimer.content.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-500">
                      <i className="ri-information-line" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-8 bg-red-50 rounded-lg border border-red-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Acknowledgment</h2>
          <p className="text-gray-700 mb-4">
            By using Pablo Trading Platform, you acknowledge that you have read, understood, and agree to this disclaimer. 
            You understand the risks associated with cryptocurrency trading and automated trading systems.
          </p>
          <p className="text-gray-700">
            If you do not agree with any part of this disclaimer, you should not use our platform.
          </p>
        </section>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/risk')}>
            Risk Disclosure
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
                  <button onClick={() => navigate('/disclaimer')} className="hover:text-white transition">
                    Disclaimer
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

