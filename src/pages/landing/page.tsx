import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import { useAuth } from '../../hooks/useAuth';

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)] blur-3xl opacity-80 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.35),_transparent_55%)] blur-3xl opacity-70 pointer-events-none" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 shadow-lg shadow-blue-500/40">
              <i className="ri-robot-2-fill text-xl" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-200/80">Pablo</p>
              <p className="text-xs font-light text-slate-300/70">Autonomous Trading Network</p>
            </div>
          </div>

          <nav className="hidden items-center space-x-8 text-sm font-medium text-slate-200/80 md:flex">
            <button onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              Platform
            </button>
            <button onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              Architecture
            </button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              Pricing
            </button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="transition hover:text-white">
              FAQ
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/auth?invite=')}>Launch App</Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16 text-center lg:flex-row lg:items-start lg:text-left">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-4 py-1 text-sm text-blue-200/80 shadow-lg shadow-blue-500/10 backdrop-blur">
              <i className="ri-sparkling-2-fill text-blue-400" />
              <span>Quantum-Ready Trading Stack</span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Hyper-intelligent trading bots that <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">learn the market in real time.</span>
            </h1>
            <p className="max-w-2xl text-lg text-slate-300/75 sm:text-xl">
              Pablo merges multi-exchange liquidity, deep learning models, and adaptive risk engines into a single neural console. Deploy bots that evolve with volatility—without writing a line of code.
            </p>
            <div className="flex flex-col items-center space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0 lg:justify-start">
              <Button size="lg" onClick={() => navigate('/auth')}>
                Get Started Free
                <i className="ri-arrow-right-up-line ml-2 text-lg" />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Capabilities
                <i className="ri-scan-2-fill ml-2 text-base" />
              </Button>
            </div>

            <div className="grid w-full gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl shadow-blue-500/5 backdrop-blur lg:grid-cols-3">
              {[
                { label: 'Automations Deployed', value: '18,000+', accent: 'from-cyan-400 via-blue-500 to-indigo-500' },
                { label: 'Monthly Trade Throughput', value: '12.6M', accent: 'from-purple-400 via-fuchsia-500 to-pink-500' },
                { label: 'Uptime Across Exchanges', value: '99.97%', accent: 'from-emerald-400 via-teal-500 to-cyan-500' },
              ].map((stat) => (
                <div key={stat.label} className="text-left">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-semibold`}>
                    <span className={`bg-gradient-to-r ${stat.accent} bg-clip-text text-transparent`}>{stat.value}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-16 flex-1 lg:mt-0">
            <div className="absolute inset-0 -translate-y-10 translate-x-6 rounded-3xl bg-gradient-to-br from-blue-500/40 via-indigo-500/40 to-purple-500/40 blur-3xl" />
            <div className="relative flex flex-col space-y-6 rounded-3xl border border-slate-800/60 bg-slate-900/80 p-8 shadow-2xl shadow-blue-500/20">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>PABLO // AUTONOMOUS BOT CORE</span>
                <span>v7.4.2</span>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-inner shadow-blue-500/10">
                  <p className="text-xs uppercase tracking-[0.4em] text-blue-300/80">Live Alpha Feed</p>
                  <div className="mt-3 grid gap-3 text-sm text-slate-200/90">
                    {[
                      { pair: 'BTC/USDT', signal: 'Neural Long Bias', confidence: '0.87', latency: '23ms' },
                      { pair: 'ETH/USDT', signal: 'Volatility Sweep', confidence: '0.78', latency: '19ms' },
                      { pair: 'SOL/USDT', signal: 'Gamma Reversion', confidence: '0.73', latency: '31ms' },
                    ].map((row) => (
                      <div key={row.pair} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
                        <span className="font-medium text-slate-100">{row.pair}</span>
                        <span className="text-xs uppercase tracking-wide text-blue-300">{row.signal}</span>
                        <span className="text-xs text-emerald-300">Conf. {row.confidence}</span>
                        <span className="text-xs text-slate-400">{row.latency}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/70 p-4 text-sm text-slate-300/80">
                  <div className="flex items-center justify-between">
                    <span>Adaptive Risk Envelope</span>
                    <span className="text-emerald-300">Engaged</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Auto-Scaling Nodes</span>
                    <span className="text-blue-300">13 active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cross-Exchange Coverage</span>
                    <span className="text-purple-300">Bybit · OKX · Binance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="relative mx-auto max-w-6xl px-6 pb-32">
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                title: 'Neural Strategy Engine',
                description:
                  'Train, validate, and deploy ensembles that self-adjust with every tick. Pablo learns your risk appetite and recalibrates sizing, entry velocity, and exit targets in real time.',
                icon: 'ri-cpu-line',
              },
              {
                title: 'Total Automation Mesh',
                description:
                  'Link spot, futures, and derivatives accounts across exchanges with unified governance. Pablo schedules jobs, synchronizes balances, and safeties everything with kill-switch layers.',
                icon: 'ri-links-line',
              },
              {
                title: 'Compliance & Audit Ledger',
                description:
                  'Every decision is immortalized. Export execution trails, ML inference snapshots, and treasury movements for audit, compliance, or investors—instantly.',
                icon: 'ri-shield-check-line',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition-transform hover:-translate-y-1 hover:border-blue-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative space-y-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-xl text-white shadow-lg shadow-blue-500/40">
                    <i className={feature.icon} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-slate-300/80">{feature.description}</p>
                  <div className="flex items-center space-x-2 text-sm font-medium text-blue-300/80">
                    <span>Discover more</span>
                    <i className="ri-arrow-right-up-line" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="architecture" className="relative overflow-hidden bg-slate-900/30 py-24">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(59,130,246,0.1)_0%,_rgba(56,189,248,0.05)_40%,_transparent_70%)]" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 lg:flex-row">
            <div className="flex-1 space-y-6">
              <p className="text-sm uppercase tracking-[0.4em] text-blue-300/80">System Blueprint</p>
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                Modular intelligence layers built for speed, governance, and resilience.
              </h2>
              <p className="text-base text-slate-300/80">
                Pablo’s orchestrator continuously streams order books, macro data, and risk factors through GPUs to output precise execution plans. Every module is containerized, upgradeable, and observable in real time.
              </p>
              <div className="grid gap-4 text-sm text-slate-200/80">
                {[
                  { label: 'Latency-Optimized Execution', detail: 'Sub-35ms pipeline with smart order routing and liquidity fragmentation heuristics.' },
                  { label: 'ML Validation Lab', detail: 'Shadow-sim each signal across historical stress periods before production deployment.' },
                  { label: 'Treasury Guardrails', detail: 'Dynamic drawdown shields, leverage governors, and circuit breakers baked into every bot.' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start space-x-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-inner shadow-blue-500/5">
                    <i className="ri-checkbox-circle-fill mt-1 text-lg text-emerald-400" />
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-slate-400/80">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 rounded-3xl border border-slate-800/70 bg-slate-950/80 p-8 shadow-2xl shadow-blue-500/10">
              <p className="text-sm uppercase tracking-[0.4em] text-slate-400/80">Signal Pipeline</p>
              <div className="mt-6 space-y-5">
                {[
                  { title: '01 // Data Fusion', detail: 'Multi-venue order books • Funding rates • Volatility clusters • Social sentiment embeddings.' },
                  { title: '02 // Intelligence Core', detail: 'Transformer-based directional models + reinforcement tuning + Bayesian risk overlays.' },
                  { title: '03 // Execution Mesh', detail: 'Smart order routing • Iceberg logic • TWAP/VWAP overlays • slippage-aware fills.' },
                  { title: '04 // Governance Cloud', detail: 'Real-time PnL forensics • Audit ledger • Strategy rollback • Team-level permissions.' },
                ].map((stage, index) => (
                  <div key={stage.title} className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 transition hover:border-blue-500/60">
                    <div className="flex items-center justify-between text-xs text-blue-300/70">
                      <span>Layer {index + 1}</span>
                      <i className="ri-arrow-right-up-line text-base" />
                    </div>
                    <h4 className="mt-2 text-lg font-semibold text-white">{stage.title}</h4>
                    <p className="text-sm text-slate-400/80">{stage.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="relative mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-300/70">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Scale from your first bot to institutional fleets.
            </h2>
            <p className="mt-4 text-base text-slate-300/75">
              Transparent pricing. Unlimited simulations. Enterprise support when you are ready to go pro.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {[
              {
                name: 'Ignition',
                price: '$0',
                period: 'forever',
                features: ['2 live bots', 'Unlimited paper trading', 'Neural strategy templates', 'Community support'],
                accent: 'from-blue-500 via-indigo-500 to-purple-500',
              },
              {
                name: 'Velocity',
                price: '$149',
                period: 'month',
                features: ['15 live bots', 'Cross-exchange automation', 'Risk governance controls', 'Strategy versioning'],
                accent: 'from-emerald-400 via-cyan-500 to-blue-500',
                highlighted: true,
              },
              {
                name: 'Command',
                price: 'Talk to us',
                period: '',
                features: ['Unlimited automation clusters', 'Dedicated quant desk', 'Custom integrations', '24/7 priority response'],
                accent: 'from-amber-400 via-orange-500 to-red-500',
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10 transition ${
                  plan.highlighted ? 'scale-[1.02] border-blue-500/50 shadow-blue-500/20' : 'hover:-translate-y-1'
                }`}
              >
                <div className={`absolute inset-x-6 top-6 h-1 rounded-full bg-gradient-to-r ${plan.accent}`} />
                <div className="relative mt-8 space-y-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                    <p className="mt-3 text-sm text-slate-400/80">Everything you need to {plan.name === 'Command' ? 'go institutional' : 'launch confidently'}.</p>
                  </div>
                  <div className="flex items-end space-x-2">
                    <span className="text-4xl font-semibold text-white">{plan.price}</span>
                    <span className="text-sm text-slate-400/80">{plan.period && `/ ${plan.period}`}</span>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-300/80">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center space-x-2">
                        <i className="ri-checkbox-circle-fill text-emerald-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    onClick={() => navigate('/auth')}
                  >
                    {plan.name === 'Command' ? 'Book Strategy Call' : 'Start with ' + plan.name}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="relative bg-slate-900/40 py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-blue-300/70">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Bring Pablo into your stack in hours, not weeks.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {[
                {
                  q: 'How fast can I deploy my first bot?',
                  a: 'Most teams connect exchanges and spin their first live automation in under 15 minutes. Templates cover directional, market-neutral, and arbitrage structures out of the box.',
                },
                {
                  q: 'Do I need my own infrastructure?',
                  a: 'No. Pablo manages the compute, scaling, and failover. You can optionally bring your own keys and VPC if compliance requires.',
                },
                {
                  q: 'Can I import my custom strategies?',
                  a: 'Yes. Upload Python notebooks, REST endpoints, or signal webhooks. Pablo handles orchestration, risk, and execution for you.',
                },
                {
                  q: 'Is there a sandbox environment?',
                  a: 'Every plan includes unlimited paper trading and historical backtests—so you can stress strategies before committing capital.',
                },
              ].map((item) => (
                <div key={item.q} className="rounded-3xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-lg shadow-blue-500/5">
                  <h3 className="text-lg font-semibold text-white">{item.q}</h3>
                  <p className="mt-3 text-sm text-slate-300/75">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/70 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-lg text-white shadow-lg shadow-blue-500/40">
                <i className="ri-robot-2-fill" />
              </div>
              <span className="text-sm uppercase tracking-[0.3em] text-slate-400/80">Pablo</span>
            </div>
            <p className="mt-3 text-xs text-slate-500/80">
              © {new Date().getFullYear()} Pablo Trading Systems. Crafted for forward-looking funds and traders.
            </p>
          </div>
          <div className="flex flex-col items-start space-y-3 text-sm md:flex-row md:items-center md:space-x-6 md:space-y-0">
            <button onClick={() => navigate('/auth')} className="text-slate-300/80 transition hover:text-white">
              Sign In
            </button>
            <button onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-300/80 transition hover:text-white">
              Platform
            </button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-300/80 transition hover:text-white">
              Pricing
            </button>
            <button onClick={() => navigate('/privacy')} className="text-slate-300/80 transition hover:text-white">
              Privacy
            </button>
            <button onClick={() => navigate('/terms')} className="text-slate-300/80 transition hover:text-white">
              Terms
            </button>
            <button onClick={() => navigate('/risk')} className="text-slate-300/80 transition hover:text-white">
              Risk Disclosure
            </button>
            <button onClick={() => navigate('/help')} className="text-slate-300/80 transition hover:text-white">
              Support
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

