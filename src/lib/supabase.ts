
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'

// Extract project ref for storage key (Supabase format: sb-{project-ref}-auth-token)
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'default'
const storageKey = `sb-${projectRef}-auth-token`

// Create Supabase client with better error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: storageKey,
    // Use PKCE flow for better security with custom domains
    flowType: 'pkce',
    // Handle CORS errors more gracefully
    debug: false
  },
  global: {
    headers: {
      'X-Client-Info': 'pablo-trading-app'
    },
    // Add fetch timeout to prevent hanging
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Add timeout for fetch requests (30 seconds)
        signal: AbortSignal.timeout?.(30000) || undefined
      }).catch((error) => {
        // Handle CORS and network errors gracefully
        if (error.name === 'AbortError' || error.message?.includes('Failed to fetch')) {
          console.warn('⚠️ Network request failed. This might be due to CORS or network connectivity issues.')
        }
        throw error
      })
    }
  }
})

// Helper: Read access token from localStorage if Supabase client session isn't ready yet
export function getAccessTokenFromLocalStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    // Supabase stores under key: sb-{project-ref}-auth-token
    const expectedKey = `sb-${projectRef}-auth-token`
    const stored = window.localStorage.getItem(expectedKey)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed?.access_token && parsed?.expires_at) {
      const expirationMs = (typeof parsed.expires_at === 'number' ? parsed.expires_at : parseInt(parsed.expires_at)) * 1000
      if (Number.isFinite(expirationMs) && expirationMs > Date.now()) {
        return parsed.access_token as string
      }
    }
  } catch {
    // ignore
  }
  return null
}

// Fast auth helpers: default to localStorage, fallback to racing getSession with 1s timeout
export async function getSessionFast(): Promise<import('@supabase/supabase-js').Session | null> {
  // Prefer localStorage-first
  const localToken = getAccessTokenFromLocalStorage();
  if (localToken) {
    // Attempt to read current session; if not yet ready, construct a minimal session shape
    const current = await supabase.auth.getSession().catch(() => null);
    if (current?.data?.session) return current.data.session;
    // Minimal session compatible with our apiCall token usage
    return {
      access_token: localToken,
      token_type: 'bearer',
      refresh_token: '',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 300, // short placeholder
      user: undefined as any
    } as any;
  }

  // Fallback: race Supabase getSession with 1s timeout
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: any } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 1000)
      ),
    ]);
    return (result as any)?.data?.session || null;
  } catch {
    return null;
  }
}

export async function getAuthTokenFast(): Promise<string | null> {
  const fromLocal = getAccessTokenFromLocalStorage();
  if (fromLocal) return fromLocal;
  const session = await getSessionFast();
  return session?.access_token || null;
}

// Log Supabase status on client side
if (typeof window !== 'undefined' && (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder'))) {
  console.warn('⚠️ Supabase not properly configured. Using placeholder credentials.')
}

// API endpoints for Edge Functions
export const API_ENDPOINTS = {
  BOT_MANAGEMENT: `${supabaseUrl}/functions/v1/bot-management`,
  TRADING_ENGINE: `${supabaseUrl}/functions/v1/trading-engine`,
  BOT_EXECUTOR: `${supabaseUrl}/functions/v1/bot-executor`,
  MARKET_DATA: `${supabaseUrl}/functions/v1/market-data`,
  FUTURES_PAIRS: `${supabaseUrl}/functions/v1/futures-pairs`,
  ALERTS_SYSTEM: `${supabaseUrl}/functions/v1/alerts-system`,
  API_KEYS: `${supabaseUrl}/functions/v1/api-keys`,
  AUTH_FIX: `${supabaseUrl}/functions/v1/auth-fix-ultimate`,
}

// Helper function to make authenticated API calls
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const headers = new Headers(options.headers as HeadersInit)
    // Only set Content-Type automatically when we have a body
    if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
    }

    const authToken = await getAuthTokenFast()
    
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`)
    } else {
      headers.delete('Authorization')
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
