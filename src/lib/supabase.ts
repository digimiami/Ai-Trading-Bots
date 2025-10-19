
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API endpoints for Edge Functions
export const API_ENDPOINTS = {
  BOT_MANAGEMENT: `${supabaseUrl}/functions/v1/bot-management`,
  TRADING_ENGINE: `${supabaseUrl}/functions/v1/trading-engine`,
  MARKET_DATA: `${supabaseUrl}/functions/v1/market-data`,
  ALERTS_SYSTEM: `${supabaseUrl}/functions/v1/alerts-system`,
  API_KEYS: `${supabaseUrl}/functions/v1/api-keys`,
  AUTH_FIX: `${supabaseUrl}/functions/v1/auth-fix-ultimate`,
}

// Helper function to make authenticated API calls
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API call failed:', response.status, errorText)
      throw new Error(`API call failed: ${response.statusText}`)
    }

    const text = await response.text()
    if (!text) {
      return {}
    }

    try {
      return JSON.parse(text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text)
      throw new Error('Invalid JSON response')
    }
  } catch (error) {
    console.error('API call error:', error)
    throw error
  }
}
