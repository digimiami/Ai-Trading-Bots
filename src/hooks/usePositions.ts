import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getAuthTokenFast } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ExchangePosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  leverage: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt?: string;
}

export interface ClosedPosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercentage: number;
  fees: number;
  leverage: number;
  closedAt: string;
}

export function usePositions(exchangeFilter: 'all' | 'bybit' | 'okx' | 'bitunix' = 'all') {
  const [positions, setPositions] = useState<ExchangePosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [closedLoading, setClosedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const fetchInProgressRef = useRef(false); // Prevent concurrent fetches

  const dlog = (...args: any[]) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG_POSITIONS') === '1') {
        // eslint-disable-next-line no-console
        console.log('[positions]', ...args);
      }
    } catch {
      // ignore
    }
  };

  const isTransientNetworkError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes('Failed to fetch') ||
      msg.includes('ERR_NETWORK_CHANGED') ||
      msg.includes('ERR_NAME_NOT_RESOLVED') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed')
    );
  };

  const getFreshSessionToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  const requireAccessToken = async (): Promise<string> => {
    let token = await getAuthTokenFast();

    if (!token) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      } catch (error) {
        console.warn('usePositions: getSession fallback failed', error);
      }
    }

    if (!token) {
      throw new Error('No active session');
    }

    return token;
  };

  const fetchPositions = useCallback(async () => {
    if (authLoading || !user) {
      dlog('fetchPositions skipped', { authLoading, hasUser: !!user, exchangeFilter });
      return;
    }

    // Prevent concurrent fetches - if one is already running, skip this one
    if (fetchInProgressRef.current) {
      console.log('[positions] ⏭️ Fetch already in progress, skipping duplicate call');
      return;
    }

    try {
      fetchInProgressRef.current = true;
      // Only show loading spinner on initial load or when positions array is empty
      const isInitialLoad = positions.length === 0;
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);

      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=list&exchange=${exchangeFilter}`;
      dlog('fetchPositions start', { exchangeFilter, url, hasToken: !!accessToken });
      console.log(`[positions] 🔍 Fetching positions from: ${url.substring(0, 80)}...`);

      const doFetch = async (token: string) => {
        // Add timeout: 35 seconds (slightly longer than Edge Function timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn('[positions] ⏱️ Request timeout after 35s, aborting...');
          controller.abort();
        }, 35000);
        
        try {
          console.log('[positions] 📡 Starting fetch request...');
          const startTime = Date.now();
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
          });
          const duration = Date.now() - startTime;
          clearTimeout(timeoutId);
          console.log(`[positions] ✅ Fetch completed in ${duration}ms, status: ${response.status}`);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          const errorMsg = err instanceof Error ? err.message : String(err);
          const isTimeout = err instanceof Error && (err.name === 'AbortError' || errorMsg.includes('aborted'));
          
          if (isTimeout) {
            console.error('[positions] ❌ Request timeout after 35s');
            throw new Error('Request timeout: Positions fetch took longer than 35s. Check Edge Function logs.');
          }
          console.error('[positions] ❌ Fetch error:', errorMsg);
          throw err;
        }
      };

      let response: Response;
      try {
        response = await doFetch(accessToken);
        console.log('[positions] ✅ doFetch completed, response:', { 
          status: response.status, 
          ok: response.ok,
          type: response.type,
          url: response.url
        });
        dlog('fetchPositions response', { status: response.status });
      } catch (fetchErr: any) {
        console.error('[positions] ❌ doFetch threw error:', fetchErr);
        throw fetchErr;
      }

      // If the token was restored from storage but not yet accepted, retry once with a fresh session token.
      if (response.status === 401) {
        const fresh = await getFreshSessionToken();
        if (fresh && fresh !== accessToken) {
          dlog('fetchPositions retrying with fresh token');
          response = await doFetch(fresh);
          dlog('fetchPositions retry response', { status: response.status });
        }
      }

      console.log('[positions] 📥 Checking response.ok:', response.ok, 'status:', response.status);
      
      if (!response.ok) {
        console.error('[positions] ❌ Response not OK, getting error text...');
        const errorText = await response.text();
        console.error('[positions] ❌ Error response:', { status: response.status, errorText: errorText?.slice(0, 500) });
        dlog('fetchPositions failed', { status: response.status, errorText: errorText?.slice(0, 200) });
        throw new Error(`Failed to fetch positions: ${response.status} - ${errorText}`);
      }

      console.log('[positions] ✅ Response OK, parsing JSON...');
      let data: any;
      try {
        const responseText = await response.text();
        console.log('[positions] 📄 Response text received, length:', responseText.length);
        console.log('[positions] 📄 First 500 chars:', responseText.substring(0, 500));
        
        if (!responseText || responseText.trim().length === 0) {
          console.error('[positions] ❌ Empty response body!');
          throw new Error('Empty response body from Edge Function');
        }
        
        data = JSON.parse(responseText);
        console.log('[positions] ✅ JSON parsed successfully:', {
          hasPositions: !!data.positions,
          positionsLength: data.positions?.length ?? 0,
          hasErrors: !!data.errors,
          errorsLength: data.errors?.length ?? 0,
          dataKeys: Object.keys(data)
        });
      } catch (parseErr: any) {
        console.error('[positions] ❌ JSON parse error:', parseErr);
        throw new Error(`Failed to parse response: ${parseErr.message}`);
      }
      
      dlog('fetchPositions success', { positions: data.positions?.length ?? 0, errors: data.errors?.length ?? 0 });
      
      if (!data || typeof data !== 'object') {
        console.error('[positions] ❌ Invalid data structure:', data);
        throw new Error('Invalid response: data is not an object');
      }
      
      const positionsArray = Array.isArray(data.positions) ? data.positions : [];
      console.log('[positions] 📊 Setting positions array:', positionsArray.length, 'positions');
      setPositions(positionsArray);
      setLoading(false); // Set loading to false immediately after setting positions
      
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        console.warn('[positions] ⚠️ Some positions failed to fetch:', data.errors);
        setError(`Some exchanges failed to load: ${data.errors.join('; ')}`);
      } else {
        console.log('[positions] ✅ No errors, clearing error state');
        setError(null);
      }
    } catch (err) {
      console.error('[positions] ❌ Error in fetchPositions:', err);
      console.error('[positions] ❌ Error details:', {
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.substring(0, 500) : undefined
      });
      
      // Keep last-known data on transient network flips (vpn/wifi/dns changes).
      if (isTransientNetworkError(err)) {
        dlog('fetchPositions transient network error', err);
        setError('Network issue detected. Showing last known positions…');
        setLoading(false);
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      console.error('[positions] ❌ Setting error state:', errorMessage);
      setError(errorMessage);
      setPositions([]);
      setLoading(false);
    } finally {
      console.log('[positions] ✅ Finally block: clearing fetch in progress flag');
      fetchInProgressRef.current = false;
      // Don't set loading to false here - it's already set above after positions are loaded
      // This prevents race conditions with concurrent fetches
    }
  }, [user, authLoading, exchangeFilter, positions.length]);

  const closePosition = async (
    exchange: string,
    symbol: string,
    side: 'long' | 'short',
    size: number
  ): Promise<boolean> => {
    try {
      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=close`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exchange, symbol, side, size }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Failed to close position: ${response.status}`);
      }

      const data = await response.json();
      
      // Refresh positions after closing
      await fetchPositions();
      
      return data.success === true;
    } catch (err) {
      console.error('Error closing position:', err);
      throw err;
    }
  };

  const fetchClosedPositions = useCallback(async (limit: number = 10) => {
    if (authLoading || !user) {
      return;
    }

    try {
      setClosedLoading(true);

      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=closed-positions&exchange=${exchangeFilter}&limit=${limit}`;

      const doFetch = async (token: string) =>
        fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });

      let response = await doFetch(accessToken);
      if (response.status === 401) {
        const fresh = await getFreshSessionToken();
        if (fresh && fresh !== accessToken) {
          response = await doFetch(fresh);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch closed positions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setClosedPositions(data.closedPositions || []);
    } catch (err) {
      if (isTransientNetworkError(err)) {
        return;
      }
      console.error('Error fetching closed positions:', err);
      setClosedPositions([]);
    } finally {
      setClosedLoading(false);
    }
  }, [user, authLoading, exchangeFilter]);

  useEffect(() => {
    fetchPositions();
    fetchClosedPositions(10); // At least 10 recent closed positions

    // Open positions should feel "live" (PnL/price changes). Refresh frequently while tab is visible.
    const OPEN_POSITIONS_REFRESH_MS = 10_000;
    const CLOSED_POSITIONS_REFRESH_MS = 60_000;

    const tickOpen = () => {
      if (document.visibilityState === 'visible') {
        fetchPositions();
      }
    };

    const tickClosed = () => {
      if (document.visibilityState === 'visible') {
        fetchClosedPositions(10); // Keep closed positions slower
      }
    };

    const openInterval = setInterval(tickOpen, OPEN_POSITIONS_REFRESH_MS);
    const closedInterval = setInterval(tickClosed, CLOSED_POSITIONS_REFRESH_MS);

    // When the tab becomes visible again, refresh immediately (no waiting for the next interval).
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPositions();
        fetchClosedPositions(10);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(openInterval);
      clearInterval(closedInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchPositions, fetchClosedPositions]);

  return {
    positions,
    closedPositions,
    loading,
    closedLoading,
    error,
    fetchPositions,
    fetchClosedPositions,
    closePosition,
  };
}
