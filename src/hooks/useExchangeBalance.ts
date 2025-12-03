import { useState, useEffect } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface ExchangeBalance {
  exchange: string
  totalBalance: number
  availableBalance: number
  lockedBalance: number
  assets: Array<{
    asset: string
    free: number
    locked: number
    total: number
  }>
  lastUpdated: string
  status: 'connected' | 'disconnected' | 'error'
  error?: string
  note?: string
}

export function useExchangeBalance() {
  const [balances, setBalances] = useState<ExchangeBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = async () => {
    try {
      setLoading(true)
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/balances`)
      setBalances(response.balances || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchBalances, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [])

  return {
    balances,
    loading,
    error,
    refetch: fetchBalances,
  }
}
