/**
 * Hook for managing user subscriptions
 * Handles subscription status, plan limits, and payment integration
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  description: string | null
  price_monthly_usd: number
  price_crypto: Record<string, string> | null
  max_bots: number | null
  max_trades_per_day: number | null
  max_exchanges: number | null
  features: Record<string, any>
}

export interface UserSubscription {
  subscription_id: string
  plan_id: string
  plan_name: string
  plan_display_name: string
  status: string
  expires_at: string | null
  next_billing_date: string | null
  max_bots: number
  max_trades_per_day: number | null
  max_exchanges: number
  features: Record<string, any>
  trial_days_remaining?: number | null
  trial_started_at?: string | null
  trial_period_days?: number | null
}

export interface Invoice {
  id: string
  checkoutLink: string
  amount: string
  currency: string
  status: string
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription plans
  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .neq('name', 'Free')
        .order('sort_order', { ascending: true })

      if (error) throw error
      // Double filter to ensure Free Plan is removed
      const filteredPlans = (data || []).filter(plan => {
        const nameLower = (plan.name || '').toLowerCase();
        const displayNameLower = (plan.display_name || '').toLowerCase();
        return nameLower !== 'free' && 
               displayNameLower !== 'free plan' &&
               !displayNameLower.includes('free plan');
      });
      setPlans(filteredPlans)
    } catch (err) {
      console.error('Error fetching plans:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch plans')
    }
  }

  // Fetch user's active subscription
  const fetchSubscription = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setSubscription(null)
        setLoading(false)
        return
      }

      // Call the database function
      const { data, error } = await supabase
        .rpc('get_user_active_subscription', { p_user_id: user.id })

      if (error) throw error

      if (data && data.length > 0) {
        setSubscription(data[0])
      } else {
        // No active subscription, check for Testing plan instead of Free plan
        const { data: testingPlan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('name', 'Testing')
          .eq('is_active', true)
          .single()

        if (testingPlan) {
          // Return Testing plan as default
          setSubscription({
            subscription_id: '',
            plan_id: testingPlan.id,
            plan_name: 'Testing',
            plan_display_name: testingPlan.display_name,
            status: 'active',
            expires_at: null,
            next_billing_date: null,
            max_bots: testingPlan.max_bots,
            max_trades_per_day: testingPlan.max_trades_per_day,
            max_exchanges: testingPlan.max_exchanges,
            features: testingPlan.features
          })
        } else {
          setSubscription(null)
        }
      }
    } catch (err) {
      console.error('Error fetching subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription')
    } finally {
      setLoading(false)
    }
  }

  // Check if user can create more bots
  const canCreateBot = async (): Promise<{ allowed: boolean; reason?: string; currentCount?: number }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { allowed: false, reason: 'Not authenticated' }
      }

      // Check if user is admin - admins get unlimited access
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role === 'admin') {
        // Get current bot count for display
        const { count } = await supabase
          .from('trading_bots')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .neq('status', 'deleted')

        return { 
          allowed: true, 
          reason: 'Admin users have unlimited access',
          currentCount: count || 0 
        }
      }

      // Call database function (returns JSONB)
      const { data, error } = await supabase
        .rpc('can_user_create_bot', { p_user_id: user.id })

      if (error) throw error

      // Handle JSONB response
      if (data && typeof data === 'object') {
        const result = data as any
        const allowed = result.allowed === true
        
        if (allowed) {
          return { 
            allowed: true, 
            reason: result.reason || 'Allowed',
            currentCount: result.current_bots || 0 
          }
        } else {
          return { 
            allowed: false, 
            reason: result.reason || 'You have reached your bot creation limit. Please upgrade your plan.',
            currentCount: result.current_bots || 0
          }
        }
      }

      // Fallback for old boolean response (shouldn't happen, but handle it)
      if (data === true) {
        const { count } = await supabase
          .from('trading_bots')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .neq('status', 'deleted')

        return { 
          allowed: true, 
          currentCount: count || 0 
        }
      }

      // Default deny
      return { 
        allowed: false, 
        reason: 'Unable to verify subscription limits' 
      }
    } catch (err) {
      console.error('Error checking bot creation limit:', err)
      return { 
        allowed: false, 
        reason: 'Error checking subscription limits' 
      }
    }
  }

  // Create invoice for subscription
  const createInvoice = async (planId: string, currency: string = 'USD'): Promise<{ invoice: Invoice; subscription: any } | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btcpay-integration?action=create-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ planId, currency })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const data = await response.json()
      return data
    } catch (err) {
      console.error('Error creating invoice:', err)
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
      return null
    }
  }

  // Get invoice status
  const getInvoiceStatus = async (invoiceId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btcpay-integration?action=invoice-status&invoiceId=${invoiceId}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        }
      )

      if (!response.ok) throw new Error('Failed to get invoice status')
      return await response.json()
    } catch (err) {
      console.error('Error getting invoice status:', err)
      return null
    }
  }

  // Refresh subscription data
  const refresh = async () => {
    await Promise.all([fetchPlans(), fetchSubscription()])
  }

  useEffect(() => {
    refresh()
  }, [])

  return {
    subscription,
    plans,
    loading,
    error,
    canCreateBot,
    createInvoice,
    getInvoiceStatus,
    refresh
  }
}

