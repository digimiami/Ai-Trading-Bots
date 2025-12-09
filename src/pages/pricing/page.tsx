/**
 * Pricing/Subscription Page
 * Allows users to view plans and subscribe via BTCPay Server
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription, type SubscriptionPlan } from '../../hooks/useSubscription'
import Button from '../../components/base/Button'
import Card from '../../components/base/Card'
import Header from '../../components/feature/Header'

export default function PricingPage() {
  const navigate = useNavigate()
  const { plans, subscription, loading, createInvoice, refresh } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  const handleSubscribe = async (planId: string) => {
    try {
      setIsProcessing(true)
      setError(null)
      setSelectedPlan(planId)

      const result = await createInvoice(planId, selectedCurrency)
      
      if (result && result.invoice) {
        // Redirect to BTCPay payment page
        window.location.href = result.invoice.checkoutLink
      } else {
        setError('Failed to create invoice. Please try again.')
        setIsProcessing(false)
      }
    } catch (err) {
      console.error('Subscription error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create subscription')
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

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
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
                      } else {
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

