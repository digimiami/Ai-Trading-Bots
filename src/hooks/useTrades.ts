import { useState, useEffect } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface Trade {
  id: string
  botId: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  exitPrice?: number
  pnl?: number
  status: 'open' | 'closed'
  timestamp: string
  exchange: string
}

export function useTrades(botId?: string) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrades = async () => {
    try {
      setLoading(true)
      const url = botId 
        ? `${API_ENDPOINTS.TRADING_ENGINE}/trades?botId=${botId}`
        : `${API_ENDPOINTS.TRADING_ENGINE}/trades`
      const response = await apiCall(url)
      setTrades(response.trades || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trades')
    } finally {
      setLoading(false)
    }
  }

  const closeTrade = async (tradeId: string, exitPrice: number) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.TRADING_ENGINE}/close-trade`, {
        method: 'POST',
        body: JSON.stringify({ tradeId, exitPrice }),
      })
      await fetchTrades() // Refresh the list
      return response.trade
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to close trade')
    }
  }

  useEffect(() => {
    fetchTrades()
    
    // Set up polling for real-time updates (reduced from 30s to 60s to save egress)
    const interval = setInterval(fetchTrades, 60000) // Update every 1 minute
    
    return () => clearInterval(interval)
  }, [botId])

  return {
    trades,
    loading,
    error,
    fetchTrades,
    closeTrade,
  }
}
