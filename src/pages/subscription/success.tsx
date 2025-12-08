/**
 * Subscription Success Page
 * Shown after successful payment via BTCPay
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import Button from '../../components/base/Button'
import Card from '../../components/base/Card'
import Header from '../../components/feature/Header'

export default function SubscriptionSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refresh, subscription } = useSubscription()
  const [loading, setLoading] = useState(true)
  const invoiceId = searchParams.get('invoiceId')

  useEffect(() => {
    // Refresh subscription data
    const checkSubscription = async () => {
      if (invoiceId) {
        // Poll for subscription activation (webhook may take a few seconds)
        let attempts = 0
        const maxAttempts = 10

        const pollSubscription = async () => {
          await refresh()
          attempts++

          if (subscription?.status === 'active' || attempts >= maxAttempts) {
            setLoading(false)
          } else {
            setTimeout(pollSubscription, 2000) // Check every 2 seconds
          }
        }

        pollSubscription()
      } else {
        setLoading(false)
      }
    }

    checkSubscription()
  }, [invoiceId, refresh, subscription])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <Card className="max-w-2xl mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white">Processing your payment...</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-20">
        <Card className="max-w-2xl mx-auto text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-check-line text-4xl text-white"></i>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-400">
              Your subscription has been activated.
            </p>
          </div>

          {subscription && (
            <div className="bg-gray-800/50 rounded-lg p-6 mb-6 text-left">
              <h3 className="text-lg font-semibold text-white mb-4">
                Subscription Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan:</span>
                  <span className="text-white font-semibold">{subscription.plan_display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-semibold capitalize">{subscription.status}</span>
                </div>
                {subscription.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires:</span>
                    <span className="text-white">
                      {new Date(subscription.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Bots:</span>
                  <span className="text-white">
                    {subscription.max_bots === null ? 'Unlimited' : subscription.max_bots}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <Button
              variant="primary"
              onClick={() => navigate('/bots')}
            >
              Create Your First Bot
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/pricing')}
            >
              View Plans
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

