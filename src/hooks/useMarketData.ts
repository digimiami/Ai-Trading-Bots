
import { useState, useEffect } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface MarketData {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  high24h: number
  low24h: number
  timestamp: string
  klines: Array<{
    timestamp: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

export function useMarketData(symbol: string = 'BTCUSDT', exchange: string = 'bybit') {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMarketData = async () => {
    try {
      setLoading(true)
      const response = await apiCall(
        `${API_ENDPOINTS.MARKET_DATA}?symbol=${symbol}&exchange=${exchange}`
      )
      setData(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMarketData()
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchMarketData, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [symbol, exchange])

  return {
    data,
    loading,
    error,
    refetch: fetchMarketData,
  }
}
