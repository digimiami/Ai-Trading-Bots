import { useEffect } from 'react';

const META = {
  title: 'Pablo Terms of Service | AI Trading Platform',
  description:
    'Review the legal agreement that governs access to Pablo’s automated trading bots, APIs, and analytics services.',
};

export default function TermsPage() {
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
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-6 py-20 space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-300/80">Legal</p>
          <h1 className="text-3xl font-semibold text-white">Terms of Service</h1>
          <p className="text-sm text-slate-400">Effective: {new Date().getFullYear()} • Pablo Autonomous Trading Systems</p>
          <p className="text-base text-slate-300/80">
            These terms govern access to Pablo’s automated trading platform, APIs, and associated services. They form a binding agreement between you (or your organization) and Pablo Trading Systems.
          </p>
        </header>

        <section className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 shadow-lg shadow-blue-500/5">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-300/80">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 text-sm text-slate-300/80 shadow-lg shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white">Governing Law & Contact</h2>
          <p className="mt-3">
            These terms are governed by the laws of the jurisdiction in which Pablo Trading Systems operates. Questions can be directed to{' '}
            <span className="text-blue-300">legal@pablobots.net</span>.
          </p>
        </section>
      </div>
    </div>
  );
}

