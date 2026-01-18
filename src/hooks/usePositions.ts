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
  openedAt?: string;
}

export function usePositions(exchangeFilter: 'all' | 'bybit' | 'okx' | 'bitunix' = 'all') {
  const [positions, setPositions] = useState<ExchangePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

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
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=list&exchange=${exchangeFilter}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch positions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setPositions(data.positions || []);
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Some positions failed to fetch:', data.errors);
      }
    } catch (err) {
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

  useEffect(() => {
    fetchPositions();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchPositions, 60000);

    return () => clearInterval(interval);
  }, [fetchPositions]);

  return {
    positions,
    loading,
    error,
    fetchPositions,
    closePosition,
  };
}
