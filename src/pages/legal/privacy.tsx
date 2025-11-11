import { useEffect } from 'react';

const META = {
  title: 'Pablo Privacy Policy | Autonomous Trading Bots',
  description:
    'Understand how Pablo collects, stores, and protects information when you automate trading through our AI-powered platform.',
};

export default function PrivacyPolicyPage() {
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
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-6 py-20 space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-300/80">Legal</p>
          <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>
          <p className="text-sm text-slate-400">
            Effective: {new Date().getFullYear()} • Pablo Autonomous Trading Systems
          </p>
          <p className="text-base text-slate-300/80">
            This policy explains how Pablo collects, uses, and protects information when you use our trading automation
            services. It applies to the Pablo web app, APIs, mobile interfaces, and any connected execution infrastructure.
          </p>
        </header>

        <section className="space-y-6">
          {sections.map((section) => (
            <div key={section.heading} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 shadow-lg shadow-blue-500/5">
              <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-300/80">
                {section.body.map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-400">
                      <i className="ri-checkbox-circle-fill" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 text-sm text-slate-300/80 shadow-lg shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white">Data Retention & Transfers</h2>
          <p className="mt-3">
            We retain operational records for as long as required to support your trading automations, comply with legal obligations,
            or resolve disputes. Residual backups may persist for up to 12 months. When we use subprocessors, we ensure they uphold
            equivalent security and privacy commitments.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 text-sm text-slate-300/80 shadow-lg shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p className="mt-3">
            Reach our privacy team at <span className="text-blue-300">privacy@pablobots.net</span> for questions, data requests,
            or compliance documentation.
          </p>
        </section>
      </div>
    </div>
  );
}

