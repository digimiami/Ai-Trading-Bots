/**
 * Subscription Management Page
 * Allows users to view their subscription, invoices, and payment history
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import { supabase } from '../../lib/supabase'
import Button from '../../components/base/Button'
import Card from '../../components/base/Card'
import Header from '../../components/feature/Header'

interface Invoice {
  id: string
  invoice_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  metadata: any
  subscription_id: string
}

interface PaymentHistory {
  id: string
  invoice_id: string
  amount: number
  currency: string
  status: string
  payment_method: string
  created_at: string
  metadata: any
  subscription_id: string
}

export default function SubscriptionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subscription, plans, loading: subscriptionLoading } = useSubscription()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchInvoices()
      fetchPaymentHistory()
    }
  }, [user])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      // Fetch payment history directly from database
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setInvoices(data || [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPaymentHistory(data || [])
    } catch (err) {
      console.error('Error fetching payment history:', err)
    }
  }

  const getCurrentPlan = () => {
    if (!subscription) return null
    return plans.find(p => p.id === subscription.plan_id)
  }

  const currentPlan = getCurrentPlan()

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'settled':
      case 'complete':
        return 'text-green-500'
      case 'pending':
      case 'processing':
        return 'text-yellow-500'
      case 'failed':
      case 'expired':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'USD') {
      return `$${amount.toFixed(2)}`
    }
    return `${amount} ${currency}`
  }

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading subscription information...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Subscription Management</h1>
            <p className="text-gray-400">Manage your subscription, view invoices, and payment history</p>
          </div>

          {/* Current Subscription */}
          {currentPlan && subscription && (
            <Card className="mb-8 bg-blue-900/20 border-blue-500/50">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Current Plan</h2>
                    <h3 className="text-xl text-blue-400">{currentPlan.display_name}</h3>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      subscription.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {subscription.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-gray-400 text-sm">Bots</p>
                    <p className="text-white text-lg font-semibold">
                      {subscription.max_bots === null ? 'Unlimited' : subscription.max_bots}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Trades/Day</p>
                    <p className="text-white text-lg font-semibold">
                      {subscription.max_trades_per_day === null ? 'Unlimited' : subscription.max_trades_per_day}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Exchanges</p>
                    <p className="text-white text-lg font-semibold">
                      {subscription.max_exchanges === null ? 'Unlimited' : subscription.max_exchanges}
                    </p>
                  </div>
                </div>

                {subscription.expires_at && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-400 text-sm">Expires</p>
                    <p className="text-white">{formatDate(subscription.expires_at)}</p>
                  </div>
                )}

                <div className="mt-6">
                  <Button
                    variant="primary"
                    onClick={() => navigate('/pricing')}
                  >
                    Change Plan
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Payment History */}
          <Card className="mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Payment History</h2>
              
              {paymentHistory.length === 0 ? (
                <p className="text-gray-400">No payment history found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Invoice ID</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Method</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-3 px-4 text-white">{formatDate(payment.created_at)}</td>
                          <td className="py-3 px-4 text-gray-300 font-mono text-sm">{payment.invoice_id?.substring(0, 20)}...</td>
                          <td className="py-3 px-4 text-white font-semibold">
                            {formatCurrency(payment.amount, payment.currency)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={getStatusColor(payment.status)}>
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{payment.payment_method.toUpperCase()}</td>
                          <td className="py-3 px-4">
                            {payment.metadata?.checkout_link && (
                              <a
                                href={payment.metadata.checkout_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                View Invoice
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="bg-red-900/20 border-red-500/50 mb-8">
              <p className="text-red-400">{error}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
