import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/base/Button';
import SocialShare from '../../components/ui/SocialShare';
import { useAuth } from '../../hooks/useAuth';
import { useTracking } from '../../hooks/useTracking';

type CampaignContent = {
  title: string;
  description: string;
  heroBadge: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  faq: Array<{ q: string; a: string }>;
};

const DEFAULT_CAMPAIGN: CampaignContent = {
  title: 'Pablo AI Trading | Start Your Free Trial',
  description:
    'Deploy autonomous crypto trading bots with real-time risk controls and analytics. Start with a free trial—no credit card required.',
  heroBadge: '14-Day Free Trial • No Credit Card Required',
  headline: 'Launch trading bots that adapt to volatility—without writing code.',
  subheadline:
    'Pablo combines market analysis, execution tooling, and risk controls into one platform so you can deploy, monitor, and iterate faster.',
  bullets: [
    'Automate entries/exits with safety-first risk controls',
    'Track performance with transparent analytics and reports',
    'Scale across supported exchanges from one dashboard',
  ],
  primaryCta: 'Start Free Trial',
  secondaryCta: 'See How It Works',
  faq: [
    {
      q: 'Do you custody my funds?',
      a: 'No. Pablo provides software tools. Trades execute directly on your exchange account. We do not hold or custody your funds.',
    },
    {
      q: 'Do I need a credit card to start?',
      a: 'No. You can start the free trial without a credit card.',
    },
    {
      q: 'Is trading risky?',
      a: 'Yes. Cryptocurrency trading involves risk and losses are possible. Use risk controls and only trade with funds you can afford to lose.',
    },
  ],
};

const CAMPAIGNS: Record<string, Partial<CampaignContent>> = {
  futures: {
    title: 'Pablo Futures Automation | Start Free Trial',
    description:
      'Discover futures opportunities and deploy bots with risk controls. Start with a free trial—no credit card required.',
    headline: 'Find high-potential futures pairs—and deploy in minutes.',
    subheadline:
      'Use market dashboards, futures pair discovery, and risk tooling to move faster from idea to execution.',
    bullets: [
      'Identify candidates with performance + volume signals',
      'Use safer defaults for leverage, stops, and sizing',
      'Monitor outcomes with performance analytics',
    ],
  },
  adwords: {
    title: 'Pablo Trading Platform | Automated Cryptocurrency Trading Tools',
    description:
      'Professional trading automation tooling for cryptocurrency markets. We do not handle user funds. Trading involves risk.',
    headline: 'Professional crypto trading automation tools—built for control.',
    subheadline:
      'Create, test, and deploy strategies with analytics and safeguards. Your funds stay on the exchange.',
    bullets: [
      'Automation tools and infrastructure (no fund custody)',
      'Backtest and monitor performance in one place',
      'Risk controls to help manage exposure',
    ],
  },
};

function buildAuthUrlPreservingQuery(currentSearch: string) {
  const params = new URLSearchParams(currentSearch);
  params.set('signup', 'true');
  const query = params.toString();
  return query ? `/auth?${query}` : '/auth?signup=true';
}

export default function CampaignLandingPage() {
  const { user, loading } = useAuth();
  const { trackEvent } = useTracking();
  const navigate = useNavigate();
  const location = useLocation();
  const { campaignSlug } = useParams<{ campaignSlug?: string }>();

  const campaign = useMemo<CampaignContent>(() => {
    const slug = (campaignSlug || '').trim().toLowerCase();
    const overrides = slug ? CAMPAIGNS[slug] : undefined;
    return { ...DEFAULT_CAMPAIGN, ...(overrides || {}) };
  }, [campaignSlug]);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Fire tracking scripts for page views (configured via Admin > Tracking Codes)
    trackEvent('page_view').catch(() => {});
  }, [trackEvent]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = campaign.title;

    const metas: Array<{ name?: string; property?: string; content: string }> = [
      { name: 'description', content: campaign.description },
      { property: 'og:title', content: campaign.title },
      { property: 'og:description', content: campaign.description },
      { property: 'og:type', content: 'website' },
    ];

    const applied = metas.map((meta) => {
      const selector = meta.name
        ? `meta[name="${meta.name}"]`
        : `meta[property="${meta.property}"]`;
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      const created = !el;
      if (!el) {
        el = document.createElement('meta');
        if (meta.name) el.name = meta.name;
        if (meta.property) el.setAttribute('property', meta.property);
        document.head.appendChild(el);
      }
      const prev = el.getAttribute('content') ?? '';
      el.setAttribute('content', meta.content);
      return { el, created, prev };
    });

    const canonicalHref = `${window.location.origin}${location.pathname}`;
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const createdCanonical = !canonical;
    let prevCanonical = '';
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    } else {
      prevCanonical = canonical.href;
    }
    canonical.href = canonicalHref;

    return () => {
      document.title = previousTitle;
      applied.forEach(({ el, created, prev }) => {
        if (created) document.head.removeChild(el);
        else el.setAttribute('content', prev);
      });
      if (createdCanonical && canonical && document.head.contains(canonical)) {
        document.head.removeChild(canonical);
      } else if (canonical && prevCanonical) {
        canonical.href = prevCanonical;
      }
    };
  }, [campaign.title, campaign.description, location.pathname]);

  const handleSignup = () => {
    navigate(buildAuthUrlPreservingQuery(location.search));
  };

  const handleHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)] blur-3xl opacity-80 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.35),_transparent_55%)] blur-3xl opacity-70 pointer-events-none" />

      <header className="relative z-10 border-b border-slate-800/70 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 hover:opacity-90 transition-opacity"
            aria-label="Go to homepage"
          >
            <img
              src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png"
              alt="Pablo Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-blue-200/80">Pablo Bots</p>
              <p className="text-xs font-light text-slate-100">Autonomous Trading Network</p>
            </div>
          </button>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button size="sm" onClick={handleSignup}>
              {campaign.primaryCta}
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center space-x-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-4 py-1 text-sm shadow-lg shadow-blue-500/10 backdrop-blur">
                <i className="ri-sparkling-2-fill text-blue-400" />
                <span>{campaign.heroBadge}</span>
              </div>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {campaign.headline}
              </h1>

              <p className="max-w-xl text-lg text-slate-200">{campaign.subheadline}</p>

              <ul className="space-y-3 text-sm text-slate-200">
                {campaign.bullets.map((b) => (
                  <li key={b} className="flex items-start space-x-3">
                    <i className="ri-checkbox-circle-fill text-emerald-400 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" onClick={handleSignup}>
                  {campaign.primaryCta}
                  <i className="ri-arrow-right-up-line ml-2 text-lg" />
                </Button>
                <Button variant="secondary" size="lg" onClick={handleHowItWorks}>
                  {campaign.secondaryCta}
                  <i className="ri-scan-2-fill ml-2 text-base" />
                </Button>
              </div>

              <p className="text-xs text-slate-300">
                No funds custody. Cancel anytime. Trading involves risk—use only capital you can afford to lose.
              </p>
            </div>

            {/* Trust + quick value */}
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-8 shadow-xl shadow-blue-500/10">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-xl text-white shadow-lg shadow-blue-500/40">
                    <i className="ri-shield-check-line" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Built for control</h2>
                    <p className="mt-1 text-sm text-slate-200">
                      Start with a free trial, run paper trading, and scale up when you’re ready—without handing custody of funds to a third party.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold">Fast setup</p>
                    <p className="mt-1 text-xs text-slate-200">Create an account and start exploring the platform in minutes.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold">Safety-first defaults</p>
                    <p className="mt-1 text-xs text-slate-200">Risk controls and visibility help you manage exposure responsibly.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold">Clear analytics</p>
                    <p className="mt-1 text-xs text-slate-200">Monitor PnL, drawdown, and performance reporting.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold">Upgrade anytime</p>
                    <p className="mt-1 text-xs text-slate-200">Start free and scale when you need more bots or throughput.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                  <div>
                    <p className="text-sm font-semibold">Ready to start?</p>
                    <p className="mt-1 text-xs text-slate-200">Go straight to signup (we’ll keep your campaign params).</p>
                  </div>
                  <Button size="sm" onClick={handleSignup}>
                    {campaign.primaryCta}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-200/80">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold">A clear path from signup to execution</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              The goal is to reduce friction: create your account, connect your exchange (your funds stay there), then test and iterate.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300">
                1
              </div>
              <h3 className="mt-4 text-lg font-semibold">Create your account</h3>
              <p className="mt-2 text-sm text-slate-200">Start the free trial in seconds. No credit card required.</p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                2
              </div>
              <h3 className="mt-4 text-lg font-semibold">Connect & configure</h3>
              <p className="mt-2 text-sm text-slate-200">
                Configure your settings and risk preferences, then connect your exchange for execution.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300">
                3
              </div>
              <h3 className="mt-4 text-lg font-semibold">Monitor & improve</h3>
              <p className="mt-2 text-sm text-slate-200">
                Track performance, review results, and iterate your approach with better inputs and guardrails.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-200/80">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold">Quick answers</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {campaign.faq.map((item) => (
              <div
                key={item.q}
                className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-7"
              >
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-slate-200">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-800/70 bg-slate-950/70">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Start your free trial today</h2>
              <p className="mt-2 text-sm text-slate-200">
                Create an account in seconds. No credit card. Funds stay on the exchange. Cancel anytime.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="lg" onClick={() => navigate('/pricing')}>
                View Pricing
              </Button>
              <Button size="lg" onClick={handleSignup}>
                {campaign.primaryCta}
                <i className="ri-arrow-right-up-line ml-2 text-lg" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/70 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <img
                src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png"
                alt="Pablo Logo"
                className="h-9 w-9 object-contain"
              />
              <span className="text-sm uppercase tracking-[0.3em] text-white">Pablo Bots</span>
            </div>
            <p className="mt-3 text-xs text-slate-200">
              © {new Date().getFullYear()} Pablo Bots Trading Systems. We provide software tools only. We do not handle user funds.
            </p>
            <div className="mt-4">
              <SocialShare
                variant="compact"
                title={campaign.title}
                description={campaign.description}
                className="text-white"
              />
            </div>
          </div>

          <div className="text-xs text-slate-200 md:text-right">
            <p className="font-semibold text-white">Risk Disclosure</p>
            <p className="mt-2 max-w-md">
              Trading involves risk and losses are possible. Past performance does not guarantee future results. Use appropriate
              risk controls and trade responsibly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


