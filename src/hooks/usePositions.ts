import { useState, useEffect, useCallback } from 'react';
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

    try {
      setLoading(true);
      setError(null);

      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=list&exchange=${exchangeFilter}`;
      dlog('fetchPositions start', { exchangeFilter, url });

      const doFetch = async (token: string) =>
        fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });

      let response = await doFetch(accessToken);
      dlog('fetchPositions response', { status: response.status });

      // If the token was restored from storage but not yet accepted, retry once with a fresh session token.
      if (response.status === 401) {
        const fresh = await getFreshSessionToken();
        if (fresh && fresh !== accessToken) {
          dlog('fetchPositions retrying with fresh token');
          response = await doFetch(fresh);
          dlog('fetchPositions retry response', { status: response.status });
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        dlog('fetchPositions failed', { status: response.status, errorText: errorText?.slice(0, 200) });
        throw new Error(`Failed to fetch positions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      dlog('fetchPositions success', { positions: data.positions?.length ?? 0, errors: data.errors?.length ?? 0 });
      setPositions(data.positions || []);
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Some positions failed to fetch:', data.errors);
      }
    } catch (err) {
      // Keep last-known data on transient network flips (vpn/wifi/dns changes).
      if (isTransientNetworkError(err)) {
        dlog('fetchPositions transient network error', err);
        setError('Network issue detected. Showing last known positions…');
        return;
      }
      console.error('Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, exchangeFilter]);

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
