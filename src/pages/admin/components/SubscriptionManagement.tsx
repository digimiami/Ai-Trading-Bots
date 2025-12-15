/**
 * Admin Subscription Management Component
 * Allows admins to upgrade/manage user subscriptions
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
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
  invoice_id: string | null
  invoice_url: string | null
  users: { email: string }
  subscription_plans: { name: string; display_name: string; max_bots: number | null }
}

interface UserWithSubscription {
  user_id: string
  email: string
  subscription: UserSubscription | null
}

interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  max_bots: number | null
  is_active?: boolean
}

export default function SubscriptionManagement() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
  const [usersWithSubscriptions, setUsersWithSubscriptions] = useState<UserWithSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [upgradingUserId, setUpgradingUserId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [activatingSubscriptionId, setActivatingSubscriptionId] = useState<string | null>(null)
  const [changingPlanSubscriptionId, setChangingPlanSubscriptionId] = useState<string | null>(null)
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false)
  const [planChangeData, setPlanChangeData] = useState<{
    subscriptionId: string
    userId: string
    currentPlanId: string
    newPlanId: string
    currentPlanName: string
    newPlanName: string
  } | null>(null)

  useEffect(() => {
    checkAdminStatus()
    fetchAllUsersAndSubscriptions()
    fetchPlans()
  }, [user])

  const checkAdminStatus = async () => {
    if (!user?.id) {
      setIsAdmin(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!error && data?.role === 'admin') {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
      setIsAdmin(false)
    }
  }

  const fetchAllUsersAndSubscriptions = async () => {
    try {
      setError(null)
      setLoading(true)
      
      // Fetch all users
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .order('created_at', { ascending: false })
        .limit(500)

      if (usersError) {
        console.error('Users fetch error:', usersError)
        throw usersError
      }

      // Fetch all subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (subscriptionsError) {
        console.error('Subscription fetch error:', subscriptionsError)
        
        // If table doesn't exist, just show users without subscriptions
        if (subscriptionsError.code === 'PGRST116' || subscriptionsError.message?.includes('relation')) {
          console.warn('user_subscriptions table may not exist:', subscriptionsError)
          // Show users without subscriptions
          const usersOnly = (allUsers || []).map((u: any) => ({
            user_id: u.id,
            email: u.email,
            subscription: null
          }))
          setUsersWithSubscriptions(usersOnly)
          setSubscriptions([])
          setLoading(false)
          return
        }
        
        throw subscriptionsError
      }

      // Enrich subscriptions with plan data
      const enrichedSubscriptions = await Promise.all(
        (subscriptionsData || []).map(async (sub: any) => {
          let planData = null

          // Fetch plan details
          if (sub.plan_id) {
            try {
              const { data: plan, error: planError } = await supabase
                .from('subscription_plans')
                .select('name, display_name, max_bots')
                .eq('id', sub.plan_id)
                .maybeSingle()
              
              if (!planError && plan) {
                planData = plan
              }
            } catch (err) {
              console.warn(`Failed to fetch plan ${sub.plan_id}:`, err)
            }
          }

          return {
            ...sub,
            users: { email: 'Loading...' }, // Will be filled from user data
            subscription_plans: planData
          }
        })
      )

      setSubscriptions(enrichedSubscriptions)

      // Combine users with their subscriptions
      const usersWithSubs = (allUsers || []).map((u: any) => {
        const subscription = enrichedSubscriptions.find((sub: any) => sub.user_id === u.id) || null
        
        // If subscription exists, update the email
        if (subscription) {
          subscription.users = { email: u.email }
        }

        return {
          user_id: u.id,
          email: u.email,
          subscription: subscription
        }
      })

      setUsersWithSubscriptions(usersWithSubs)
    } catch (err: any) {
      console.error('Error fetching users and subscriptions:', err)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load users and subscriptions'
      if (err.code === 'PGRST116') {
        errorMessage = 'Table not found. Please ensure the database is set up correctly.'
      } else if (err.message?.includes('permission') || err.message?.includes('RLS')) {
        errorMessage = 'Permission denied. Please check Row Level Security policies.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setUsersWithSubscriptions([])
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscriptions = async () => {
    // Legacy function - redirects to fetchAllUsersAndSubscriptions
    await fetchAllUsersAndSubscriptions()
  }

  const fetchPlans = async () => {
    try {
      // Admin should see ALL plans, not just active ones
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, price_monthly_usd, max_bots, is_active')
        .order('sort_order', { ascending: true })
        .order('price_monthly_usd', { ascending: false })

      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  }

  const changeUserPlan = async (subscriptionId: string, userId: string, newPlanId: string) => {
    if (!isAdmin) {
      alert('❌ Admin access required to change subscriptions')
      return
    }

    try {
      setChangingPlanSubscriptionId(subscriptionId)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-subscription-management`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId,
            newPlanId,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to change subscription plan')
      }

      const data = await response.json()
      
      // Get plan names for confirmation
      const currentPlan = plans.find(p => p.id === planChangeData?.currentPlanId)
      const newPlan = plans.find(p => p.id === newPlanId)
      const isUpgrade = (newPlan?.price_monthly_usd || 0) > (currentPlan?.price_monthly_usd || 0)
      const action = isUpgrade ? 'upgraded' : 'downgraded'
      
      alert(`✅ User subscription ${action} from ${currentPlan?.display_name || 'Unknown'} to ${newPlan?.display_name || 'Unknown'}. Email and message sent to user.`)
      fetchAllUsersAndSubscriptions()
      setShowPlanChangeModal(false)
      setPlanChangeData(null)
    } catch (err) {
      console.error('Error changing subscription plan:', err)
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to change subscription plan'}`)
    } finally {
      setChangingPlanSubscriptionId(null)
    }
  }

  const upgradeUserSubscription = async (userId: string, planId: string) => {
    // Legacy function - redirects to new changeUserPlan
    const subscription = subscriptions.find(s => s.user_id === userId)
    if (subscription) {
      await changeUserPlan(subscription.id, userId, planId)
    } else {
      // Create new subscription if none exists
      try {
        const plan = plans.find(p => p.id === planId)
        if (!plan) throw new Error('Plan not found')

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

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

        alert(`✅ User subscription created: ${plan.display_name}`)
        fetchSubscriptions()
      } catch (err) {
        console.error('Error creating subscription:', err)
        alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to create subscription'}`)
      }
    }
  }

  const handlePlanChangeClick = (subscription: UserSubscription, newPlanId: string) => {
    const currentPlan = plans.find(p => p.id === subscription.plan_id)
    const newPlan = plans.find(p => p.id === newPlanId)
    
    if (!currentPlan || !newPlan) {
      alert('Plan not found')
      return
    }

    if (subscription.plan_id === newPlanId) {
      alert('User is already on this plan')
      return
    }

    setPlanChangeData({
      subscriptionId: subscription.id,
      userId: subscription.user_id,
      currentPlanId: subscription.plan_id,
      newPlanId: newPlanId,
      currentPlanName: currentPlan.display_name,
      newPlanName: newPlan.display_name
    })
    setShowPlanChangeModal(true)
  }

  const manuallyActivateSubscription = async (subscriptionId: string, invoiceId?: string) => {
    try {
      setActivatingSubscriptionId(subscriptionId)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
      const response = await fetch(
        `${supabaseUrl}/functions/v1/btcpay-webhook?action=manual-activate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId,
            invoiceId,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to activate subscription')
      }

      const data = await response.json()
      alert(`✅ Subscription activated successfully! Email and message sent to user.`)
      fetchAllUsersAndSubscriptions()
    } catch (err) {
      console.error('Error activating subscription:', err)
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to activate subscription'}`)
    } finally {
      setActivatingSubscriptionId(null)
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
      fetchAllUsersAndSubscriptions()
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

  if (!isAdmin) {
    return (
      <Card>
        <div className="text-center py-8">
          <i className="ri-shield-cross-line text-6xl text-red-500 mb-4"></i>
          <p className="text-red-400 text-lg mb-2">Access Denied</p>
          <p className="text-gray-500 text-sm">Admin access is required to manage subscriptions.</p>
        </div>
      </Card>
    )
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
          <Button variant="secondary" size="sm" onClick={fetchAllUsersAndSubscriptions}>
            <i className="ri-refresh-line mr-2"></i>
            Refresh
          </Button>
        </div>

        {usersWithSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <i className="ri-wallet-line text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400 text-lg mb-2">No users found</p>
            <p className="text-gray-500 text-sm">Users will appear here once they sign up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-semibold">User</th>
                  <th className="pb-3 text-gray-400 font-semibold">Current Plan</th>
                  <th className="pb-3 text-gray-400 font-semibold">Status</th>
                  <th className="pb-3 text-gray-400 font-semibold">Trial Days</th>
                  <th className="pb-3 text-gray-400 font-semibold">Expires</th>
                  <th className="pb-3 text-gray-400 font-semibold">Change Plan</th>
                </tr>
              </thead>
              <tbody>
                {usersWithSubscriptions.map((userWithSub) => {
                  const sub = userWithSub.subscription
                  
                  // If user has no subscription, show a row with "No Subscription"
                  if (!sub) {
                    return (
                      <tr key={userWithSub.user_id} className="border-b border-gray-800">
                        <td className="py-3 text-white">{userWithSub.email}</td>
                        <td className="py-3">
                          <span className="text-gray-500 italic">No Subscription</span>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-400">
                            None
                          </span>
                        </td>
                        <td className="py-3 text-gray-300">N/A</td>
                        <td className="py-3 text-gray-300">N/A</td>
                        <td className="py-3">
                          <div className="flex gap-1 flex-wrap">
                            {plans
                              .sort((a, b) => (b.price_monthly_usd || 0) - (a.price_monthly_usd || 0))
                              .map((plan) => {
                                const isInactive = plan.is_active === false
                                
                                return (
                                  <Button
                                    key={plan.id}
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      // Create subscription for this user
                                      upgradeUserSubscription(userWithSub.user_id, plan.id)
                                    }}
                                    className={`text-xs whitespace-nowrap ${isInactive ? 'opacity-60' : ''}`}
                                    title={`Assign ${plan.display_name} ($${plan.price_monthly_usd}/mo)${isInactive ? ' [Inactive]' : ''}`}
                                  >
                                    ➕ {plan.display_name}
                                    {isInactive && <span className="ml-1 text-xs">(Inactive)</span>}
                                  </Button>
                                )
                              })}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  // User has subscription - show subscription details
                  const trialDays = getTrialDaysRemaining(sub)
                  const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date()
                  const isTrialExpired = trialDays !== null && trialDays <= 0

                  return (
                    <tr key={sub.id} className="border-b border-gray-800">
                      <td className="py-3 text-white">{userWithSub.email}</td>
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold">
                            {sub.subscription_plans?.display_name || 'Unknown'}
                          </span>
                          {(() => {
                            const currentPlan = plans.find(p => p.id === sub.plan_id)
                            return currentPlan ? (
                              <span className="text-xs text-gray-400">
                                ${currentPlan.price_monthly_usd}/mo • {currentPlan.max_bots === null ? 'Unlimited' : `${currentPlan.max_bots} bots`}
                              </span>
                            ) : null
                          })()}
                        </div>
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
                        <div className="flex gap-2 flex-wrap items-center">
                          {sub.status === 'pending' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => manuallyActivateSubscription(sub.id, sub.invoice_id || undefined)}
                              disabled={activatingSubscriptionId === sub.id}
                            >
                              {activatingSubscriptionId === sub.id ? 'Activating...' : 'Activate'}
                            </Button>
                          )}
                          
                          {/* Quick Plan Change Buttons */}
                          <div className="flex gap-1 flex-wrap">
                            {plans
                              .filter(plan => plan.id !== sub.plan_id)
                              .sort((a, b) => (b.price_monthly_usd || 0) - (a.price_monthly_usd || 0))
                              .map((plan) => {
                                const currentPlan = plans.find(p => p.id === sub.plan_id)
                                const isUpgrade = (plan.price_monthly_usd || 0) > (currentPlan?.price_monthly_usd || 0)
                                const isDowngrade = (plan.price_monthly_usd || 0) < (currentPlan?.price_monthly_usd || 0)
                                const isInactive = plan.is_active === false
                                
                                return (
                                  <Button
                                    key={plan.id}
                                    variant={isUpgrade ? "primary" : isDowngrade ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handlePlanChangeClick(sub, plan.id)}
                                    disabled={changingPlanSubscriptionId === sub.id}
                                    className={`text-xs whitespace-nowrap ${isInactive ? 'opacity-60' : ''}`}
                                    title={`${isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Change'} to ${plan.display_name} ($${plan.price_monthly_usd}/mo)${isInactive ? ' [Inactive]' : ''}`}
                                  >
                                    {isUpgrade ? '⬆️' : isDowngrade ? '⬇️' : '↔️'} {plan.display_name}
                                    {isInactive && <span className="ml-1 text-xs">(Inactive)</span>}
                                  </Button>
                                )
                              })}
                          </div>

                          {/* Legacy dropdown (keep for compatibility) */}
                          {plans.length > 3 && (
                            <select
                              value={upgradingUserId === sub.user_id ? selectedPlanId : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handlePlanChangeClick(sub, e.target.value)
                                }
                              }}
                              className="px-2 py-1 bg-gray-800 text-white border border-gray-700 rounded text-sm"
                              disabled={changingPlanSubscriptionId === sub.id}
                            >
                              <option value="">Change Plan...</option>
                              {plans
                                .filter(plan => plan.id !== sub.plan_id)
                                .sort((a, b) => (b.price_monthly_usd || 0) - (a.price_monthly_usd || 0))
                                .map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.display_name} (${plan.price_monthly_usd}/mo){plan.is_active === false ? ' [Inactive]' : ''}
                                  </option>
                                ))}
                            </select>
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

      {/* Plan Change Confirmation Modal */}
      {showPlanChangeModal && planChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Change Subscription Plan</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Current Plan:</span>
                  <span className="text-white font-semibold">{planChangeData.currentPlanName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">New Plan:</span>
                  <span className="text-white font-semibold">{planChangeData.newPlanName}</span>
                </div>
              </div>

              {(() => {
                const currentPlan = plans.find(p => p.id === planChangeData.currentPlanId)
                const newPlan = plans.find(p => p.id === planChangeData.newPlanId)
                const isUpgrade = (newPlan?.price_monthly_usd || 0) > (currentPlan?.price_monthly_usd || 0)
                
                return (
                  <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
                    <p className="text-sm text-blue-300">
                      {isUpgrade ? '⬆️ Upgrade' : '⬇️ Downgrade'}: User will be moved from{' '}
                      <strong>{planChangeData.currentPlanName}</strong> to{' '}
                      <strong>{planChangeData.newPlanName}</strong>
                    </p>
                    {newPlan && (
                      <div className="mt-2 text-xs text-gray-400">
                        <p>Max Bots: {newPlan.max_bots === null ? 'Unlimited' : newPlan.max_bots}</p>
                        <p>Price: ${newPlan.price_monthly_usd}/month</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <Button
                  onClick={() => changeUserPlan(
                    planChangeData.subscriptionId,
                    planChangeData.userId,
                    planChangeData.newPlanId
                  )}
                  disabled={changingPlanSubscriptionId === planChangeData.subscriptionId}
                  className="flex-1"
                >
                  {changingPlanSubscriptionId === planChangeData.subscriptionId ? 'Changing...' : 'Confirm Change'}
                </Button>
                <Button
                  onClick={() => {
                    setShowPlanChangeModal(false)
                    setPlanChangeData(null)
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

