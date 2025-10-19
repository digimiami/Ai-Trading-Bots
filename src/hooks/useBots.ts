
import { useState, useEffect } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface TradingBot {
  id: string
  name: string
  strategy: string
  exchange: string
  symbol: string
  status: 'running' | 'stopped' | 'paused'
  config: Record<string, any>
  performance: Record<string, any>
  created_at: string
  updated_at: string
}

export function useBots() {
  const [bots, setBots] = useState<TradingBot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBots = async () => {
    try {
      setLoading(true)
      const response = await apiCall(`${API_ENDPOINTS.BOT_MANAGEMENT}/bots`)
      setBots(response.bots)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bots')
    } finally {
      setLoading(false)
    }
  }

  const createBot = async (botData: Partial<TradingBot>) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.BOT_MANAGEMENT}/create`, {
        method: 'POST',
        body: JSON.stringify(botData),
      })
      await fetchBots() // Refresh the list
      return response.bot
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create bot')
    }
  }

  const updateBot = async (id: string, updates: Partial<TradingBot>) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.BOT_MANAGEMENT}/update`, {
        method: 'PUT',
        body: JSON.stringify({ id, ...updates }),
      })
      await fetchBots() // Refresh the list
      return response.bot
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update bot')
    }
  }

  const deleteBot = async (id: string) => {
    try {
      await apiCall(`${API_ENDPOINTS.BOT_MANAGEMENT}?id=${id}`, {
        method: 'DELETE',
      })
      await fetchBots() // Refresh the list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete bot')
    }
  }

  const startBot = async (id: string) => {
    try {
      await apiCall(API_ENDPOINTS.TRADING_ENGINE, {
        method: 'POST',
        body: JSON.stringify({ action: 'start_bot', botId: id }),
      })
      await fetchBots() // Refresh the list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to start bot')
    }
  }

  const stopBot = async (id: string) => {
    try {
      await apiCall(API_ENDPOINTS.TRADING_ENGINE, {
        method: 'POST',
        body: JSON.stringify({ action: 'stop_bot', botId: id }),
      })
      await fetchBots() // Refresh the list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to stop bot')
    }
  }

  useEffect(() => {
    fetchBots()
  }, [])

  return {
    bots,
    loading,
    error,
    fetchBots,
    createBot,
    updateBot,
    deleteBot,
    startBot,
    stopBot,
  }
}
