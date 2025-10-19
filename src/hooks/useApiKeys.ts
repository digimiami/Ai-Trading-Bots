import { useState, useEffect } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface ApiKey {
  id: string
  exchange: string
  isTestnet: boolean
  isActive: boolean
  createdAt: string
}

export interface ApiKeyFormData {
  exchange: 'bybit' | 'okx'
  apiKey: string
  apiSecret: string
  passphrase?: string
  isTestnet: boolean
}

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchApiKeys = async () => {
    try {
      setLoading(true)
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/list`)
      setApiKeys(response.apiKeys || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys')
    } finally {
      setLoading(false)
    }
  }

  const saveApiKey = async (formData: ApiKeyFormData) => {
    try {
      setLoading(true)
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/save`, {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      
      // Refresh the list
      await fetchApiKeys()
      return response.apiKey
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const testApiConnection = async (formData: ApiKeyFormData) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/test`, {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      return response
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to test API connection')
    }
  }

  const toggleApiKey = async (id: string, isActive: boolean) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ id, isActive }),
      })
      
      // Refresh the list
      await fetchApiKeys()
      return response.apiKey
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to toggle API key')
    }
  }

  const deleteApiKey = async (id: string) => {
    try {
      await apiCall(`${API_ENDPOINTS.API_KEYS}?id=${id}`, {
        method: 'DELETE',
      })
      
      // Refresh the list
      await fetchApiKeys()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  useEffect(() => {
    fetchApiKeys()
  }, [])

  return {
    apiKeys,
    loading,
    error,
    saveApiKey,
    testApiConnection,
    toggleApiKey,
    deleteApiKey,
    refetch: fetchApiKeys,
  }
}
