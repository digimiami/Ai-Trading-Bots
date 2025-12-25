import { useState, useEffect, useRef, useCallback } from 'react'
import { API_ENDPOINTS, apiCall } from '../lib/supabase'

export interface ExchangeBalance {
  exchange: string
  totalBalance: number
  availableBalance: number
  lockedBalance: number
  unrealizedPnL?: number
  assets: Array<{
    asset: string
    free: number
    locked: number
    total: number
  }>
  lastUpdated: string
  status: 'connected' | 'disconnected' | 'error'
  error?: string
  note?: string
}

export function useExchangeBalance() {
  const [balances, setBalances] = useState<ExchangeBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const latestRequestIdRef = useRef(0)
  const isMountedRef = useRef(true)

  const fetchBalances = useCallback(async () => {
    // #region agent log
    const currentRequestId = ++latestRequestIdRef.current;
    fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:35',message:'fetchBalances called',data:{requestId:currentRequestId,isMounted:isMountedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:39',message:'Cancelling previous request',data:{requestId:currentRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const controller = new AbortController()
    abortControllerRef.current = controller
    const thisRequestId = currentRequestId

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:47',message:'Setting loading true',data:{requestId:thisRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (!isMountedRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:50',message:'Component unmounted before fetch, aborting',data:{requestId:thisRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        controller.abort()
        return
      }
      setLoading(true)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:54',message:'API call starting',data:{requestId:thisRequestId,endpoint:`${API_ENDPOINTS.API_KEYS}/balances`},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await apiCall(`${API_ENDPOINTS.API_KEYS}/balances`, { signal: controller.signal })
      
      // Check if this is still the latest request and component is mounted
      if (controller.signal.aborted || !isMountedRef.current || thisRequestId !== latestRequestIdRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:59',message:'Request stale or aborted, skipping state update',data:{requestId:thisRequestId,isAborted:controller.signal.aborted,isMounted:isMountedRef.current,isLatest:thisRequestId === latestRequestIdRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.log('[useExchangeBalance] Skipping stale request:', { requestId: thisRequestId, latestId: latestRequestIdRef.current, aborted: controller.signal.aborted, mounted: isMountedRef.current })
        return
      }
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.error('[useExchangeBalance] Invalid response structure:', response)
        throw new Error('Invalid response from API')
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:64',message:'API response received',data:{requestId:thisRequestId,hasBalances:!!response.balances,responseKeys:Object.keys(response||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:67',message:'Updating balances state',data:{requestId:thisRequestId,balancesCount:(response.balances||[]).length},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setBalances(response.balances || [])
      setError(null)
    } catch (err: any) {
      // Don't set error if request was aborted, component unmounted, or this is not the latest request
      if (err?.name === 'AbortError' || controller.signal.aborted || !isMountedRef.current || thisRequestId !== latestRequestIdRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:73',message:'Request aborted/stale/unmounted, ignoring error',data:{requestId:thisRequestId,errorName:err?.name,isAborted:controller.signal.aborted,isMounted:isMountedRef.current,isLatest:thisRequestId === latestRequestIdRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:77',message:'Error caught',data:{requestId:thisRequestId,errorMessage:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      // Only update loading state if this is the latest request and component is mounted
      if (!controller.signal.aborted && isMountedRef.current && thisRequestId === latestRequestIdRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:83',message:'Setting loading false',data:{requestId:thisRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        setLoading(false)
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:86',message:'Skipping loading state update',data:{requestId:thisRequestId,isAborted:controller.signal.aborted,isMounted:isMountedRef.current,isLatest:thisRequestId === latestRequestIdRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    }
  }, [])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:89',message:'useEffect mounted',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    isMountedRef.current = true
    fetchBalances()
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:94',message:'Interval callback executing',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      fetchBalances()
    }, 60000) // Update every minute
    
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d699810-8c68-443d-8f9c-b629f3dcc932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useExchangeBalance.ts:100',message:'useEffect cleanup',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'final-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      isMountedRef.current = false
      clearInterval(interval)
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchBalances])

  return {
    balances,
    loading,
    error,
    refetch: fetchBalances,
  }
}
