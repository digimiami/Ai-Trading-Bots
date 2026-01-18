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

  const fetchClosedPositions = useCallback(async (limit: number = 10) => {
    if (authLoading || !user) {
      return;
    }

    try {
      setClosedLoading(true);

      const accessToken = await requireAccessToken();
      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/positions?action=closed-positions&exchange=${exchangeFilter}&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch closed positions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setClosedPositions(data.closedPositions || []);
    } catch (err) {
      console.error('Error fetching closed positions:', err);
      setClosedPositions([]);
    } finally {
      setClosedLoading(false);
    }
  }, [user, authLoading, exchangeFilter]);

  useEffect(() => {
    fetchPositions();
    fetchClosedPositions(10); // At least 10 recent closed positions

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchPositions();
      fetchClosedPositions(10); // At least 10 recent closed positions
    }, 60000);

    return () => clearInterval(interval);
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
