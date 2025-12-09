/**
 * Admin Subscription Management Component
 * Allows admins to upgrade/manage user subscriptions
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Card from '../../../components/base/Card'
import Button from '../../../components/base/Button'

interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: string
  expires_at: string | null
  trial_started_at: string | null
  trial_period_days: number | null
  users: { email: string }
  subscription_plans: { name: string; display_name: string; max_bots: number | null }
}

interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  max_bots: number | null
}

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgradingUserId, setUpgradingUserId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  useEffect(() => {
    fetchSubscriptions()
    fetchPlans()
  }, [])

  const fetchSubscriptions = async () => {
    try {
      setError(null)
      // Use left join instead of inner join to show subscriptions even if user is deleted
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          users (email),
          subscription_plans (name, display_name, max_bots)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Subscription fetch error:', error)
        throw error
      }
      setSubscriptions(data || [])
    } catch (err) {
      console.error('Error fetching subscriptions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, price_monthly_usd, max_bots')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  }

  const upgradeUserSubscription = async (userId: string, planId: string) => {
    try {
      setUpgradingUserId(userId)

      // Get plan details
      const plan = plans.find(p => p.id === planId)
      if (!plan) throw new Error('Plan not found')

      // Calculate expiration (30 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Create or update subscription
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (existingSub) {
        // Update existing subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            plan_id: planId,
            status: 'active',
            expires_at: expiresAt.toISOString(),
            trial_started_at: null,
            trial_period_days: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)

        if (error) throw error
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            expires_at: expiresAt.toISOString(),
            started_at: new Date().toISOString(),
            trial_started_at: null,
            trial_period_days: null
          })

        if (error) throw error
      }

      alert(`✅ User subscription upgraded to ${plan.display_name}`)
      fetchSubscriptions()
    } catch (err) {
      console.error('Error upgrading subscription:', err)
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to upgrade subscription'}`)
    } finally {
      setUpgradingUserId(null)
      setSelectedPlanId('')
    }
  }

  const extendTrial = async (subscriptionId: string, days: number) => {
    try {
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('trial_started_at, trial_period_days')
        .eq('id', subscriptionId)
        .single()

      if (!sub) throw new Error('Subscription not found')

      const newExpiresAt = new Date()
      if (sub.trial_started_at) {
        newExpiresAt.setTime(new Date(sub.trial_started_at).getTime())
      }
      newExpiresAt.setDate(newExpiresAt.getDate() + (sub.trial_period_days || 14) + days)

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          expires_at: newExpiresAt.toISOString(),
          trial_period_days: (sub.trial_period_days || 14) + days,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)

      if (error) throw error

      alert(`✅ Trial extended by ${days} days`)
      fetchSubscriptions()
    } catch (err) {
      console.error('Error extending trial:', err)
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to extend trial'}`)
    }
  }

  const getTrialDaysRemaining = (subscription: UserSubscription): number | null => {
    if (!subscription.trial_started_at || !subscription.trial_period_days) return null

    const daysElapsed = Math.floor(
      (new Date().getTime() - new Date(subscription.trial_started_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    return Math.max(0, subscription.trial_period_days - daysElapsed)
  }

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading subscriptions...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <Button onClick={fetchSubscriptions}>Retry</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">User Subscriptions</h2>
          <Button variant="secondary" size="sm" onClick={fetchSubscriptions}>
            <i className="ri-refresh-line mr-2"></i>
            Refresh
          </Button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <i className="ri-wallet-line text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400 text-lg mb-2">No subscriptions found</p>
            <p className="text-gray-500 text-sm">Subscriptions will appear here once users sign up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-semibold">User</th>
                  <th className="pb-3 text-gray-400 font-semibold">Plan</th>
                  <th className="pb-3 text-gray-400 font-semibold">Status</th>
                  <th className="pb-3 text-gray-400 font-semibold">Trial Days</th>
                  <th className="pb-3 text-gray-400 font-semibold">Expires</th>
                  <th className="pb-3 text-gray-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                const trialDays = getTrialDaysRemaining(sub)
                const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date()
                const isTrialExpired = trialDays !== null && trialDays <= 0

                return (
                  <tr key={sub.id} className="border-b border-gray-800">
                    <td className="py-3 text-white">{sub.users?.email || 'Unknown'}</td>
                    <td className="py-3 text-gray-300">
                      {sub.subscription_plans?.display_name || 'Unknown'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          sub.status === 'active' && !isExpired && !isTrialExpired
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isTrialExpired ? 'Trial Expired' : isExpired ? 'Expired' : sub.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300">
                      {trialDays !== null ? (
                        <span className={trialDays <= 0 ? 'text-red-400' : 'text-yellow-400'}>
                          {trialDays} days left
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="py-3 text-gray-300">
                      {sub.expires_at
                        ? new Date(sub.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <select
                          value={upgradingUserId === sub.user_id ? selectedPlanId : ''}
                          onChange={(e) => {
                            setSelectedPlanId(e.target.value)
                            setUpgradingUserId(sub.user_id)
                          }}
                          className="px-2 py-1 bg-gray-800 text-white border border-gray-700 rounded text-sm"
                          disabled={upgradingUserId === sub.user_id && upgradingUserId !== null}
                        >
                          <option value="">Select Plan...</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.display_name} (${plan.price_monthly_usd}/mo)
                            </option>
                          ))}
                        </select>
                        {selectedPlanId && upgradingUserId === sub.user_id && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => upgradeUserSubscription(sub.user_id, selectedPlanId)}
                          >
                            Upgrade
                          </Button>
                        )}
                        {trialDays !== null && trialDays > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => extendTrial(sub.id, 7)}
                          >
                            +7 Days
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

