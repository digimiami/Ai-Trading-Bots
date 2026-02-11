import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';

const META = {
  title: 'Pablo Privacy Policy | Autonomous Trading Bots',
  description:
    'Understand how Pablo collects, stores, and protects information when you automate trading through our AI-powered platform.',
};

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = META.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const sections = [
    {
      heading: 'Data We Collect',
      body: [
        'Account identifiers (name, email, exchange account IDs).',
        'Operational telemetry (bot configuration, execution metrics, latency statistics).',
        'Billing and audit information as required for invoicing and compliance.',
        'Optional datasets you supply for custom models or strategy backtests.',
      ],
    },
    {
      heading: 'How Information Is Used',
      body: [
        'To operate, maintain, and optimize trading automation across supported exchanges.',
        'To deliver analytics, audit ledgers, notifications, and security alerts.',
        'To improve machine learning models in aggregate (never exposing individual strategies).',
        'To comply with legal requests and risk-control obligations.',
      ],
    },
    {
      heading: 'Security Controls',
      body: [
        'API credentials are encrypted at rest with hardware-backed keys.',
        'Network segregation keeps execution infrastructure isolated from public endpoints.',
        'Role-based permissions let you separate research, execution, and compliance access.',
        'Continuous monitoring detects anomalies, credential misuse, or failed safeguards.',
      ],
    },
    {
      heading: 'Your Rights',
      body: [
        'Request export or deletion of stored personal data by contacting privacy@pablobots.net.',
        'Revoke exchange keys or remove collaborators at any time from the security console.',
        'Receive notice when policy changes materially affect data usage or sharing.',
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-sm text-gray-600">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-base text-gray-700 mt-4">
            This policy explains how Pablo collects, uses, and protects information when you use our trading automation
            services. It applies to the Pablo web app, APIs, mobile interfaces, and any connected execution infrastructure.
          </p>
        </header>

        <section className="space-y-6">
          {sections.map((section) => (
            <div key={section.heading} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{section.heading}</h2>
              <ul className="space-y-2 text-gray-700">
                {section.body.map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-500">
                      <i className="ri-checkbox-circle-fill" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Retention & Transfers</h2>
          <p className="text-gray-700">
            We retain operational records for as long as required to support your trading automations, comply with legal obligations,
            or resolve disputes. Residual backups may persist for up to 12 months. When we use subprocessors, we ensure they uphold
            equivalent security and privacy commitments.
          </p>
        </section>

        <section className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
          <p className="text-gray-700">
            Reach our privacy team at{' '}
            <a href="mailto:privacy@pablobots.net" className="text-blue-600 hover:text-blue-800 underline">
              privacy@pablobots.net
            </a>{' '}
            for questions, data requests, or compliance documentation.
          </p>
        </section>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/terms')}>
            Terms of Service
          </Button>
          <Button variant="secondary" onClick={() => navigate('/cookies')}>
            Cookie Policy
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
                  <button onClick={() => navigate('/auth')} className="hover:text-white transition">
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

