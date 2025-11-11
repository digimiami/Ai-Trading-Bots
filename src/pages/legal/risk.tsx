import { useEffect } from 'react';

const META = {
  title: 'Pablo Risk Disclosure | Automated Trading',
  description:
    'Review the market, liquidity, technology, and regulatory risks associated with deploying automated trading bots through Pablo.',
};

export default function RiskDisclosurePage() {
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
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-6 py-20 space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-300/80">Legal</p>
          <h1 className="text-3xl font-semibold text-white">Risk Disclosure</h1>
          <p className="text-sm text-slate-400">
            Automated crypto trading involves substantial risk. You may lose some or all of your investment.
          </p>
        </header>

        <section className="space-y-6 text-sm text-slate-300/80">
          {bullets.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 shadow-lg shadow-blue-500/5">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 text-sm text-slate-300/80 shadow-lg shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white">User Responsibilities</h2>
          <ul className="mt-3 space-y-2">
            {[
              'Backtest strategies thoroughly and start with reduced position sizes.',
              'Review leverage settings, funding rates, and margin requirements daily.',
              'Enable alerts and monitor system notifications to respond quickly to anomalies.',
              'Consult licensed professionals for legal, tax, or investment guidance.',
            ].map((item) => (
              <li key={item} className="flex items-start space-x-2">
                <span className="mt-1 text-blue-400">
                  <i className="ri-checkbox-circle-fill" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

