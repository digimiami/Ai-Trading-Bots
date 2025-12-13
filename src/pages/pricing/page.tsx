/**
 * Pricing/Subscription Page
 * Allows users to view plans and subscribe via BTCPay Server
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription, type SubscriptionPlan } from '../../hooks/useSubscription'
import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/base/Button'
import Card from '../../components/base/Card'
import Header from '../../components/feature/Header'

export default function PricingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { plans, subscription, loading, createInvoice, refresh } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  const handleSelectPlan = (planId: string, planName: string) => {
    // If user is not authenticated, store plan selection and redirect to signup
    if (!user) {
      // Store selected plan in localStorage and sessionStorage for signup
      localStorage.setItem('selectedPlanId', planId)
      localStorage.setItem('selectedPlanName', planName)
      sessionStorage.setItem('selectedPlanId', planId)
      // Redirect to signup with plan info
      navigate(`/auth?plan=${planId}&signup=true`, { replace: false })
      return
    }

    // If user is authenticated, proceed with subscription
    handleSubscribe(planId)
  }

  const handleSubscribe = async (planId: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:25',message:'handleSubscribe called',data:{planId,selectedCurrency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    try {
      setIsProcessing(true)
      setError(null)
      setSelectedPlan(planId)

      const result = await createInvoice(planId, selectedCurrency)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:33',message:'createInvoice result',data:{hasResult:!!result,hasInvoice:!!result?.invoice,hasCheckoutLink:!!result?.invoice?.checkoutLink},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      
      if (result && result.invoice) {
        // Redirect to BTCPay payment page
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:35',message:'Redirecting to BTCPay',data:{checkoutLink:result.invoice.checkoutLink},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        window.location.href = result.invoice.checkoutLink
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:37',message:'Invoice creation failed',data:{hasResult:!!result,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        // Show more specific error message if available
        const errorMessage = result?.error || result?.details || 'Failed to create invoice. Please try again.'
        setError(errorMessage)
        setIsProcessing(false)
      }
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:42',message:'handleSubscribe exception',data:{error:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      console.error('Subscription error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create subscription'
      setError(errorMessage)
      setIsProcessing(false)
    }
  }

  const getCurrentPlan = () => {
    if (!subscription) return null
    return plans.find(p => p.id === subscription.plan_id)
  }

  const currentPlan = getCurrentPlan()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading plans...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pay monthly with cryptocurrency from your own wallet. Zero transaction fees.
          </p>
        </div>

        {/* Current Subscription Status */}
        {currentPlan && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="bg-blue-900/20 border-blue-500/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Current Plan: {currentPlan.display_name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {subscription.expires_at 
                      ? `Expires: ${new Date(subscription.expires_at).toLocaleDateString()}`
                      : 'Active (No expiration)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Bots: {subscription.max_bots === null ? 'Unlimited' : subscription.max_bots}</p>
                  <p className="text-sm text-gray-400">
                    Trades/day: {subscription.max_trades_per_day === null ? 'Unlimited' : subscription.max_trades_per_day}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Currency Selector */}
        <div className="max-w-2xl mx-auto mb-8 text-center">
          <label className="text-white mr-4">Payment Currency:</label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="USD">USD</option>
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="USDT">Tether (USDT)</option>
            <option value="ETH">Ethereum (ETH)</option>
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="bg-red-900/20 border-red-500/50">
              <p className="text-red-400">{error}</p>
            </Card>
          </div>
        )}

        {/* Pricing Plans - Show all plans including Testing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.filter(plan => {
            const nameLower = (plan.name || '').toLowerCase();
            const displayNameLower = (plan.display_name || '').toLowerCase();
            // Include Testing plan, but filter out Free Plan in any variation
            return (nameLower === 'testing' || nameLower === 'test') || 
                   (nameLower !== 'free' && 
                   displayNameLower !== 'free plan' &&
                   !displayNameLower.includes('free plan') &&
                   !nameLower.includes('free'));
          }).sort((a, b) => {
            // Sort Testing plan first, then by price
            if (a.name === 'Testing') return -1;
            if (b.name === 'Testing') return 1;
            return a.price_monthly_usd - b.price_monthly_usd;
          }).map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id
            const isPopular = plan.name === 'Pro'
            const priceCrypto = plan.price_crypto as Record<string, string> || {}
            const displayPrice = selectedCurrency === 'USD' 
              ? `$${plan.price_monthly_usd.toFixed(2)}`
              : `${priceCrypto[selectedCurrency] || plan.price_monthly_usd} ${selectedCurrency}`

            return (
              <Card
                key={plan.id}
                className={`relative ${
                  isPopular 
                    ? 'border-blue-500 scale-105 bg-gradient-to-br from-blue-900/30 to-purple-900/30' 
                    : 'bg-gray-800/50'
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {plan.display_name}
                  </h3>
                  {(plan.name === 'Testing' || plan.name === 'Test') && (
                    <div className="mb-2">
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-semibold">
                        14-Day Free Trial
                      </span>
                    </div>
                  )}
                  <p className="text-gray-400 text-sm mb-6 min-h-[40px]">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-black dark:text-black">
                      {plan.price_monthly_usd === 0 ? 'Free' : displayPrice}
                    </span>
                    {plan.price_monthly_usd > 0 && (
                      <span className="text-gray-600 dark:text-gray-600 ml-2">/month</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start">
                      <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                      <span className="text-gray-300">
                        {plan.max_bots === null ? 'Unlimited' : plan.max_bots} Trading Bots
                      </span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                      <span className="text-gray-300">
                        {plan.max_trades_per_day === null 
                          ? 'Unlimited' 
                          : `${plan.max_trades_per_day}`} Trades/Day
                      </span>
                    </li>
                    <li className="flex items-start">
                      <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                      <span className="text-gray-300">
                        {plan.max_exchanges === null 
                          ? 'Unlimited' 
                          : `${plan.max_exchanges}`} Exchange{plan.max_exchanges !== 1 ? 's' : ''}
                      </span>
                    </li>
                    {plan.features?.paper_trading && (
                      <li className="flex items-start">
                        <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                        <span className="text-gray-300">Paper Trading</span>
                      </li>
                    )}
                    {plan.features?.real_trading && (
                      <li className="flex items-start">
                        <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                        <span className="text-gray-300">Real Trading</span>
                      </li>
                    )}
                    {plan.features?.ai_optimization && (
                      <li className="flex items-start">
                        <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                        <span className="text-gray-300">AI Optimization</span>
                      </li>
                    )}
                    {plan.features?.priority_support && (
                      <li className="flex items-start">
                        <i className="ri-check-line text-green-500 mr-2 mt-1"></i>
                        <span className="text-gray-300">Priority Support</span>
                      </li>
                    )}
                  </ul>

                  <Button
                    variant={isPopular ? 'primary' : 'secondary'}
                    onClick={() => {
                      if (isCurrentPlan) {
                        navigate('/bots')
                      } else if (!user) {
                        // Not authenticated - select plan and go to signup
                        handleSelectPlan(plan.id, plan.name)
                      } else {
                        // Authenticated - proceed with subscription
                        handleSubscribe(plan.id)
                      }
                    }}
                    disabled={isProcessing && selectedPlan === plan.id}
                    className="w-full"
                  >
                    {isProcessing && selectedPlan === plan.id ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : !user ? (
                      (plan.name === 'Testing' || plan.name === 'Test') ? 'Start Free Trial' : (plan.price_monthly_usd === 0 ? 'Sign Up Free' : 'Sign Up & Subscribe')
                    ) : (plan.name === 'Testing' || plan.name === 'Test') ? (
                      'Start Free Trial'
                    ) : plan.price_monthly_usd === 0 ? (
                      'Get Started'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Payment Info */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <Card className="bg-gray-800/50">
            <h3 className="text-xl font-semibold text-white mb-4">
              💳 Payment Information
            </h3>
            <div className="text-gray-400 space-y-2 text-sm">
              <p>
                • Pay from your own cryptocurrency wallet (no third-party custody)
              </p>
              <p>
                • Zero transaction fees (self-hosted BTCPay Server)
              </p>
              <p>
                • Supports Bitcoin, USDT, Ethereum, and Lightning Network
              </p>
              <p>
                • Subscriptions renew monthly automatically
              </p>
              <p>
                • Cancel anytime - access continues until end of billing period
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

