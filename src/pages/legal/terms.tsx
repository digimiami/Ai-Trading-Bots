import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';

const META = {
  title: 'Pablo Terms of Service | AI Trading Platform',
  description:
    'Review the legal agreement that governs access to Pablo's automated trading bots, APIs, and analytics services.',
};

export default function TermsPage() {
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
      title: 'Acceptance of Terms',
      paragraphs: [
        'By creating an account or connecting exchange credentials, you agree to these terms and represent that you have the authority to bind any organization you act on behalf of.',
        'If you do not agree, you may not access or use Pablo. Continued use after updates constitutes acceptance of the revised terms.',
      ],
    },
    {
      title: 'Licensing & Usage',
      paragraphs: [
        'Pablo grants a limited, non-exclusive, revocable license to access the platform for the sole purpose of orchestrating trading bots and analytics.',
        'You must not attempt to reverse engineer, decompile, or resell access to Pablo’s infrastructure.',
        'You retain ownership of your strategies and data. We may analyse anonymized, aggregated telemetry to improve performance and reliability.',
      ],
    },
    {
      title: 'Exchange Accounts & Risk',
      paragraphs: [
        'You are solely responsible for API key scopes, leverage settings, and capital allocated to automated strategies.',
        'Pablo does not guarantee profits or uninterrupted uptime. You acknowledge the inherent volatility of digital assets and agree to monitor deployed bots.',
        'We recommend configuring safety limits, drawdown guards, and manual overrides before enabling live execution.',
      ],
    },
    {
      title: 'Payment & Subscription',
      paragraphs: [
        'Paid plans are billed in accordance with the pricing schedule displayed inside the application. Fees are non-refundable except where required by law.',
        'Downgrading or cancelling takes effect at the end of the current billing cycle. Access to premium features will be removed when the cycle expires.',
      ],
    },
    {
      title: 'Limitation of Liability',
      paragraphs: [
        'Pablo is provided “as is” without warranties of any kind. We are not liable for lost profits, trading losses, or indirect damages arising from use of the platform.',
        'Our total liability for any claim is limited to the fees paid for the service during the prior three months.',
      ],
    },
    {
      title: 'Termination',
      paragraphs: [
        'You may terminate this agreement at any time by deleting your account and discontinuing use.',
        'We reserve the right to suspend or terminate accounts that violate these terms, abuse resources, or present security risk to the platform.',
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-sm text-gray-600">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-base text-gray-700 mt-4">
            These terms govern access to Pablo's automated trading platform, APIs, and associated services. They form a binding agreement between you (or your organization) and Pablo Trading Systems.
          </p>
        </header>

        <section className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="space-y-3 text-gray-700">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Governing Law & Contact</h2>
          <p className="text-gray-700">
            These terms are governed by the laws of the jurisdiction in which Pablo Trading Systems operates. Questions can be directed to{' '}
            <a href="mailto:legal@pablobots.net" className="text-blue-600 hover:text-blue-800 underline">
              legal@pablobots.net
            </a>.
          </p>
        </section>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/privacy')}>
            Privacy Policy
          </Button>
          <Button variant="secondary" onClick={() => navigate('/risk')}>
            Risk Disclosure
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

