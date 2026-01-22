import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Decrypt API keys (they are stored encrypted in the database)
function decrypt(encryptedText: string): string {
  const binaryString = atob(encryptedText);
  const utf8Bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    utf8Bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(utf8Bytes);
}

interface ExchangePosition {
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
  // Bitunix requires a positionId for some actions (e.g. tradeSide=CLOSE on place_order)
  positionId?: string;
}

interface ClosedPosition {
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

/**
 * Create Bybit signature for API requests
 */
async function createBybitSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

/**
 * Generate a random nonce for Bitunix API
 */
function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Create Bitunix Double SHA256 signature
 */
async function createBitunixSignature(
  nonce: string,
  timestamp: string,
  apiKey: string,
  queryParams: string,
  body: string,
  secretKey: string
): Promise<string> {
  let sortedQueryParams = queryParams;
  if (queryParams && queryParams.includes('=')) {
    const params = queryParams.split('&');
    const paramMap: Record<string, string> = {};
    for (const param of params) {
      const [key, value] = param.split('=');
      if (key) paramMap[key] = value || '';
    }
    const sortedKeys = Object.keys(paramMap).sort();
    sortedQueryParams = sortedKeys.map(key => `${key}=${paramMap[key]}`).join('&');
  }
  
  const digestInput = nonce + timestamp + apiKey + sortedQueryParams + body;
  const encoder = new TextEncoder();
  
  const digestHash = await crypto.subtle.digest('SHA-256', encoder.encode(digestInput));
  const digestHex = Array.from(new Uint8Array(digestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const signInput = digestHex + secretKey;
  const signHash = await crypto.subtle.digest('SHA-256', encoder.encode(signInput));
  return Array.from(new Uint8Array(signHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create OKX signature for API requests
 */
async function createOKXSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string
): Promise<string> {
  const message = timestamp + method + requestPath + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode(...hashArray));
}

/**
 * Fetch positions from Bybit
 */
async function fetchBybitPositions(
  apiKey: string,
  apiSecret: string
): Promise<ExchangePosition[]> {
  const baseUrl = 'https://api.bybit.com';
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const category = 'linear'; // Support linear futures for now

  const params: Record<string, string> = {
    category: category,
    settleCoin: 'USDT' // Filter for USDT margin
  };
  
  const queryParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
  const signature = await createBybitSignature(signaturePayload, apiSecret);

  try {
    const response = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bybit HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error (${data.retCode}): ${data.retMsg || 'Unknown error'}`);
    }

    if (!data.result?.list) return [];

    return data.result.list
      .filter((p: any) => parseFloat(p.size || 0) !== 0)
      .map((p: any) => {
        const size = Math.abs(parseFloat(p.size || 0));
        const entryPrice = parseFloat(p.avgPrice || p.entryPrice || 0);
        const currentPrice = parseFloat(p.markPrice || p.lastPrice || 0);
        const unrealizedPnL = parseFloat(p.unrealisedPnl || 0);
        const unrealizedPnLPercentage = entryPrice > 0 
          ? ((currentPrice - entryPrice) / entryPrice) * 100 * (p.side === 'Sell' ? -1 : 1)
          : 0;

        return {
          exchange: 'bybit',
          symbol: p.symbol,
          side: p.side?.toLowerCase() === 'buy' ? 'long' : 'short',
          size,
          entryPrice,
          currentPrice,
          unrealizedPnL,
          unrealizedPnLPercentage,
          leverage: parseFloat(p.leverage || 1),
          marginUsed: parseFloat(p.positionValue || 0) / parseFloat(p.leverage || 1),
          stopLoss: parseFloat(p.stopLoss || 0) || undefined,
          takeProfit: parseFloat(p.takeProfit || 0) || undefined
        };
      });
  } catch (error: any) {
    console.error('Error fetching Bybit positions:', error);
    throw error;
  }
}

/**
 * Fetch positions from OKX
 */
async function fetchOKXPositions(
  apiKey: string,
  apiSecret: string,
  passphrase: string
): Promise<ExchangePosition[]> {
  const baseUrl = 'https://www.okx.com';
  const method = 'GET';
  const requestPath = '/api/v5/account/positions';
  const body = '';
  const timestamp = new Date().toISOString();

  const signature = await createOKXSignature(timestamp, method, requestPath, body, apiSecret);

  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OKX HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    if (data.code !== '0') {
      throw new Error(`OKX API error (${data.code}): ${data.msg || 'Unknown error'}`);
    }

    if (!data.data) return [];

    return data.data
      .filter((p: any) => parseFloat(p.pos || 0) !== 0)
      .map((p: any) => {
        const size = Math.abs(parseFloat(p.pos || 0));
        const entryPrice = parseFloat(p.avgPx || p.avgPx || 0);
        const currentPrice = parseFloat(p.markPx || p.last || 0);
        const unrealizedPnL = parseFloat(p.upl || 0);
        const unrealizedPnLPercentage = entryPrice > 0 
          ? ((currentPrice - entryPrice) / entryPrice) * 100 * (p.posSide === 'short' ? -1 : 1)
          : 0;

        return {
          exchange: 'okx',
          symbol: p.instId,
          side: p.posSide === 'long' ? 'long' : 'short',
          size,
          entryPrice,
          currentPrice,
          unrealizedPnL,
          unrealizedPnLPercentage,
          leverage: parseFloat(p.lever || 1),
          marginUsed: parseFloat(p.margin || 0),
          stopLoss: parseFloat(p.slTriggerPx || p.stopLoss || 0) || undefined,
          takeProfit: parseFloat(p.tpTriggerPx || p.takeProfit || 0) || undefined
        };
      });
  } catch (error: any) {
    console.error('Error fetching OKX positions:', error);
    throw error;
  }
}

/**
 * Fetch positions from Bitunix
 */
async function fetchBitunixPositions(
  apiKey: string,
  apiSecret: string
): Promise<ExchangePosition[]> {
  // Bitunix has multiple position endpoints in the wild. The older `/api/v1/futures/position`
  // often returns code=2 "System error" even when positions exist. The OpenAPI endpoints
  // `get_pending_positions` should only return open positions. We skip `get_history_positions`
  // as it returns closed positions which we don't want for the open positions list.
  const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com'];
  const endpoints = [
    '/api/v1/futures/position/get_pending_positions',
    '/api/v1/futures/position/pending_position',
    '/api/v1/futures/position/list',
    '/api/v1/futures/position',
  ];

  const normalizeQueryParams = (queryParams: string): string => {
    if (!queryParams || !queryParams.includes('=')) return queryParams || '';
    const params = queryParams.split('&').filter(Boolean);
    const paramMap: Record<string, string> = {};
    for (const param of params) {
      const [key, value] = param.split('=');
      if (key) paramMap[key] = value || '';
    }
    return Object.keys(paramMap)
      .sort()
      .map((key) => `${key}=${paramMap[key]}`)
      .join('&');
  };

  const extractSize = (p: any): number => {
    const candidates = [
      p?.size,
      p?.qty,
      p?.holdVol,
      p?.hold_vol,
      p?.quantity,
      p?.vol,
      p?.positionAmt,
      p?.positionQty,
      p?.amount,
      p?.openVol,
      p?.open_vol,
    ];
    for (const c of candidates) {
      const n = typeof c === 'number' ? c : typeof c === 'string' ? parseFloat(c) : NaN;
      if (Number.isFinite(n) && n !== 0) return Math.abs(n);
    }
    return 0;
  };

  const parsePositionsFromResponse = (data: any): any[] => {
    const root = data?.data ?? null;
    if (!root) return [];
    if (Array.isArray(root)) return root;
    if (typeof root === 'object') {
      const possibleArrays = Object.values(root).filter((v) => Array.isArray(v)) as any[];
      if (possibleArrays.length > 0) return possibleArrays[0];
      return [root];
    }
    return [];
  };

  const extractFirstPositiveNumber = (...candidates: any[]): number | undefined => {
    for (const c of candidates) {
      const n = typeof c === 'number' ? c : typeof c === 'string' ? parseFloat(c) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    }
    return undefined;
  };

  // Bitunix does not always include SL/TP on the position object. We merge from pending TP/SL orders API.
  // Fetch ALL TP/SL orders once and cache them (more efficient than per-symbol calls)
  let allTpSlOrdersCache: { orders: any[]; timestamp: number } | null = null;
  const CACHE_TTL_MS = 5000; // 5 second cache
  
  const fetchAllBitunixTpSlOrders = async (): Promise<any[]> => {
    const now = Date.now();
    if (allTpSlOrdersCache && (now - allTpSlOrdersCache.timestamp) < CACHE_TTL_MS) {
      return allTpSlOrdersCache.orders;
    }
    
    const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com'];
    const endpoints = [
      '/api/v1/futures/tpsl/pending_orders',
      '/api/v1/futures/tpsl/orders',
      '/api/v1/futures/tpsl/list',
    ];
    
    // Try fetching ALL orders (no filters) - Bitunix might require this
    const queryVariants = [
      '', // No params - fetch all
      'marketType=futures',
      'marginCoin=USDT',
      'marketType=futures&marginCoin=USDT',
    ];
    
    const body = '';
    let attempts = 0;
    let lastError: string | null = null;

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        for (const qpRaw of queryVariants) {
          attempts++;
          try {
            const queryParams = normalizeQueryParams(qpRaw);
            const timestamp = Date.now().toString();
            const nonce = generateNonce();
            const signature = await createBitunixSignature(nonce, timestamp, apiKey, queryParams, body, apiSecret);

            const url = queryParams ? `${baseUrl}${endpoint}?${queryParams}` : `${baseUrl}${endpoint}`;
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(signature),
                'Content-Type': 'application/json',
                'language': 'en-US',
              },
            });

            if (!response.ok) {
              // Only log first attempt to reduce spam
              if (attempts === 1) {
                const errorText = await response.text().catch(() => '');
                console.log(`🔍 [Bitunix] Fetching TP/SL orders (tried ${attempts} endpoint/param combinations so far)...`);
              }
              continue;
            }

            const data = await response.json().catch(() => null);
            if (!data) {
              continue;
            }
            
            if (data.code !== 0) {
              // Only log code 2 (Parameter error) on first occurrence to reduce spam
              if (data.code === 2 && attempts === 1) {
                lastError = `code ${data.code}: ${data.msg || data.message || 'Parameter error'}`;
              }
              continue;
            }
            
            if (!data.data) {
              continue;
            }

            const orders = Array.isArray(data.data) ? data.data : (data.data.list || data.data.orders || []);
            if (Array.isArray(orders) && orders.length > 0) {
              console.log(`✅ [Bitunix] Fetched ${orders.length} total TP/SL orders`);
              allTpSlOrdersCache = { orders, timestamp: now };
              return orders;
            }
          } catch (err) {
            // Silently continue - reduce log spam
            continue;
          }
        }
      }
    }
    
    // Only log summary if we tried multiple times and all failed
    if (attempts > 1 && lastError) {
      console.log(`⚠️ [Bitunix] TP/SL orders API not available (${lastError}) - positions will show without TP/SL if not set`);
    }
    allTpSlOrdersCache = { orders: [], timestamp: now };
    return [];
  };

  const fetchBitunixPendingTpSlOrders = async (symbol: string): Promise<any[]> => {
    // First try fetching all orders and filtering by symbol
    try {
      const allOrders = await fetchAllBitunixTpSlOrders();
      if (allOrders.length > 0) {
        const normalizedSymbol = symbol.toUpperCase();
        const filtered = allOrders.filter((o: any) => {
          const oSymbol = String(o.symbol || o.contract || o.tradingPair || '').toUpperCase();
          return oSymbol === normalizedSymbol;
        });
        if (filtered.length > 0) {
          console.log(`✅ [Bitunix] Found ${filtered.length} TP/SL orders for ${symbol} from cached all-orders fetch`);
          return filtered;
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Bitunix] Failed to fetch all TP/SL orders:`, err instanceof Error ? err.message : String(err));
    }
    
    // Fallback: Try symbol-specific fetch (original method)
    const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com'];
    const endpoint = '/api/v1/futures/tpsl/pending_orders';
    const normalizedSymbol = symbol.toUpperCase();
    
    // Try multiple query parameter variants (same as bot-executor)
    const queryVariants = [
      `symbol=${normalizedSymbol}`,
      `marketType=futures&symbol=${normalizedSymbol}`,
      `marketType=futures&marginCoin=USDT&symbol=${normalizedSymbol}`,
      `marginCoin=USDT&symbol=${normalizedSymbol}`,
    ];
    
    const body = '';

    for (const baseUrl of baseUrls) {
      for (const qpRaw of queryVariants) {
        try {
          const queryParams = normalizeQueryParams(qpRaw);
          const timestamp = Date.now().toString();
          const nonce = generateNonce();
          const signature = await createBitunixSignature(nonce, timestamp, apiKey, queryParams, body, apiSecret);

          const url = queryParams ? `${baseUrl}${endpoint}?${queryParams}` : `${baseUrl}${endpoint}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US',
            },
          });

          if (!response.ok) {
            // Silently continue - reduce log spam
            continue;
          }

          const data = await response.json().catch(() => null);
          if (!data) {
            continue;
          }
          
          if (data.code === 0 && data.data) {
            const orders = Array.isArray(data.data) ? data.data : (data.data.list || data.data.orders || []);
            if (Array.isArray(orders) && orders.length > 0) {
              console.log(`✅ [Bitunix] Found ${orders.length} TP/SL orders for ${symbol}`);
              return orders;
            }
          }

          // Code 2 is common/temporary; try next variant/host before giving up
          if (data.code === 2) {
            continue;
          }
        } catch (err) {
          console.warn(`⚠️ [Bitunix] Error fetching TP/SL orders for ${symbol} with params ${qpRaw}:`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
    }

    console.log(`⚠️ [Bitunix] No TP/SL orders found for ${symbol} after trying all variants`);
    return [];
  };

  // Try fetching TP/SL orders by positionId (alternative method)
  const fetchBitunixPendingTpSlOrdersByPositionId = async (positionId: string): Promise<any[]> => {
    const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com'];
    const endpoints = [
      '/api/v1/futures/tpsl/pending_orders',
      '/api/v1/futures/tpsl/orders',
      '/api/v1/futures/tpsl/list',
    ];
    
    const queryVariants = [
      `positionId=${positionId}`,
      `position_id=${positionId}`,
      `posId=${positionId}`,
      `marketType=futures&positionId=${positionId}`,
      `marketType=futures&position_id=${positionId}`,
    ];
    
    const body = '';

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        for (const qpRaw of queryVariants) {
          try {
            const queryParams = normalizeQueryParams(qpRaw);
            const timestamp = Date.now().toString();
            const nonce = generateNonce();
            const signature = await createBitunixSignature(nonce, timestamp, apiKey, queryParams, body, apiSecret);

            const url = queryParams ? `${baseUrl}${endpoint}?${queryParams}` : `${baseUrl}${endpoint}`;
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(signature),
                'Content-Type': 'application/json',
                'language': 'en-US',
              },
            });

            if (!response.ok) continue;

            const data = await response.json().catch(() => null);
            if (!data || data.code !== 0 || !data.data) continue;

            const orders = Array.isArray(data.data) ? data.data : (data.data.list || data.data.orders || []);
            if (Array.isArray(orders) && orders.length > 0) {
              console.log(`✅ [Bitunix] Found ${orders.length} TP/SL orders for positionId ${positionId}`);
              return orders;
            }
          } catch {
            continue;
          }
        }
      }
    }

    return [];
  };

  // Prefer no-query (some accounts succeed more reliably) then typical variants.
  const queryVariants = [
    '',
    'marginCoin=USDT',
    'marketType=futures',
    'marketType=futures&marginCoin=USDT',
  ];

  let lastError: any = null;
  let has404Errors = false;
  let hasSuccess = false; // Track if any endpoint succeeded

  for (const baseUrl of baseUrls) {
    for (const endpoint of endpoints) {
      for (const qpRaw of queryVariants) {
        const queryParams = normalizeQueryParams(qpRaw);
        const url = queryParams ? `${baseUrl}${endpoint}?${queryParams}` : `${baseUrl}${endpoint}`;

        const timestamp = Date.now().toString();
        const nonce = generateNonce();
        const body = '';
        const signature = await createBitunixSignature(nonce, timestamp, apiKey, queryParams, body, apiSecret);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US',
            },
          });

          if (!response.ok) {
            // Track 404 errors - they might indicate no positions exist
            if (response.status === 404) {
              has404Errors = true;
              console.log(`⚠️ [Bitunix] Position endpoint returned 404: ${endpoint} (${qpRaw || 'no params'})`);
            } else {
              console.log(`⚠️ [Bitunix] Position endpoint returned HTTP ${response.status}: ${endpoint} (${qpRaw || 'no params'})`);
            }
            lastError = new Error(`Bitunix HTTP ${response.status} (${endpoint})`);
            continue;
          }

          const data = await response.json().catch(() => null);
          if (!data) {
            lastError = new Error(`Bitunix invalid JSON (${endpoint})`);
            continue;
          }

          if (data.code !== 0) {
            // Keep trying other endpoints/params; code=2 is common on legacy endpoints.
            console.log(`⚠️ [Bitunix] Position endpoint returned code ${data.code}: ${endpoint} (${qpRaw || 'no params'}) - ${data.msg || 'Unknown error'}`);
            lastError = new Error(`Bitunix API error (${data.code}) on ${endpoint}: ${data.msg || 'Unknown error'}`);
            continue;
          }

          console.log(`✅ [Bitunix] Position endpoint succeeded: ${endpoint} (${qpRaw || 'no params'})`);
          hasSuccess = true;
          const positions = parsePositionsFromResponse(data)
            .filter((p: any) => {
              // Filter out closed positions if status field exists
              const status = String(p.status || p.positionStatus || p.state || '').toLowerCase();
              if (status && (status === 'closed' || status === 'close' || status === 'settled' || status === 'liquidated')) {
                return false;
              }
              
              // Critical check: Bitunix open positions MUST have holdVol/hold_vol > 0
              // holdVol (holding volume) is the authoritative field for open positions
              // Check if holdVol field exists in the response
              const hasHoldVolField = p.holdVol !== undefined || p.hold_vol !== undefined;
              
              if (hasHoldVolField) {
                // If holdVol field exists, use it as the source of truth
                const holdVol = parseFloat(p.holdVol || p.hold_vol || 0);
                // Only accept positions where holdVol > 0
                return holdVol > 0;
              }
              
              // If holdVol field doesn't exist, fall back to other size fields
              // This handles cases where the API doesn't provide holdVol (legacy endpoints)
              // But we still need to ensure the position has a non-zero size
              const size = extractSize(p);
              return size > 0;
            });

          if (!positions.length) {
            // Successful response but empty; try other variants/endpoints.
            console.log(`⚠️ [Bitunix] Position endpoint succeeded but returned 0 positions: ${endpoint} (${qpRaw || 'no params'})`);
            continue;
          }

          console.log(`✅ [Bitunix] Found ${positions.length} positions from ${endpoint} (${qpRaw || 'no params'})`);

          // First pass: map raw positions. We may enrich price below if missing.
          const mappedPositions: ExchangePosition[] = positions.map((p: any) => {
            // Log position fields for debugging TP/SL extraction (only for first position to avoid spam)
            if (positions.length > 0 && positions.indexOf(p) === 0) {
              console.log(`🔍 [Bitunix] Sample position object fields: ${JSON.stringify(Object.keys(p)).substring(0, 500)}`);
              console.log(`🔍 [Bitunix] Sample position object (first 2000 chars): ${JSON.stringify(p).substring(0, 2000)}`);
              
              // Check for TP/SL fields in position object
              const tpSlFields = Object.keys(p).filter(k => 
                k.toLowerCase().includes('tp') || 
                k.toLowerCase().includes('sl') || 
                k.toLowerCase().includes('stop') || 
                k.toLowerCase().includes('take') ||
                k.toLowerCase().includes('trigger')
              );
              if (tpSlFields.length > 0) {
                console.log(`🔍 [Bitunix] Found potential TP/SL fields in position object: ${tpSlFields.join(', ')}`);
                for (const field of tpSlFields) {
                  console.log(`   ${field}: ${p[field]}`);
                }
              }
            }
            
            const size = extractSize(p);
            const entryPrice = parseFloat(
              p.entryPrice ||
              p.avgPrice ||
              p.openPrice ||
              p.openAvgPrice ||
              p.avgOpenPrice ||
              p.entry_price ||
              '0'
            );
            // Check if position object has a price field (Bitunix position objects often don't include current price)
            const hasPriceField = !!(p.markPrice || p.lastPrice || p.price || p.curPrice || p.marketPrice || p.currentPrice);
            const rawCurrentPrice = parseFloat(p.markPrice || p.lastPrice || p.price || p.curPrice || p.marketPrice || p.currentPrice || '0');
            // Only use fallback to entryPrice if we actually got a price from the position object
            // Otherwise set to 0 to trigger price enrichment
            const currentPrice = hasPriceField && rawCurrentPrice > 0 ? rawCurrentPrice : 0;
            // CRITICAL: Bitunix API returns "unrealizedPNL" (all caps), not "unrealizedPnl" or "unrealisedPnl"
            const unrealizedPnL = parseFloat(p.unrealizedPNL || p.unrealisedPnl || p.unrealizedPnl || p.pnl || p.PNL || '0');

            const sideRaw = String(p.side || p.positionSide || p.holdSide || p.posSide || '').toLowerCase();
            const isShort = sideRaw === 'short' || sideRaw === 'sell';
            const side: 'long' | 'short' = isShort ? 'short' : 'long';

            // If the API provides PnL, use it. Otherwise compute from currentPrice (only if we have a valid price).
            // CRITICAL: Don't compute PnL if currentPrice is 0 or equals entryPrice (indicates missing price data)
            let computedPnl = 0;
            let computedPnlPercentage = 0;
            
            // CRITICAL: Bitunix API's unrealizedPNL is often stale or returns 0 incorrectly
            // Always compute PnL from current price if available, otherwise use API value as fallback
            if (currentPrice > 0 && currentPrice !== entryPrice && entryPrice > 0 && size > 0) {
              // Always compute from current price when available (most accurate for live data)
              const delta = (currentPrice - entryPrice) * (isShort ? -1 : 1);
              computedPnl = delta * size;
              computedPnlPercentage = (delta / entryPrice) * 100;
              console.log(`✅ [Bitunix] Computed PnL from price for ${p.symbol || 'unknown'}: ${computedPnl.toFixed(2)} (${computedPnlPercentage.toFixed(2)}%)`);
            } else if (Number.isFinite(unrealizedPnL) && unrealizedPnL !== 0) {
              // Use API-provided PnL only if it's non-zero (might be stale but better than nothing)
              computedPnl = unrealizedPnL;
              computedPnlPercentage = entryPrice > 0 && size > 0 
                ? (unrealizedPnL / (entryPrice * size)) * 100 * (isShort ? -1 : 1)
                : 0;
              console.log(`⚠️ [Bitunix] Using API unrealizedPNL for ${p.symbol || 'unknown'}: ${unrealizedPnL} (${computedPnlPercentage.toFixed(2)}%) - will recompute when price is fetched`);
            } else {
              // No valid price or PnL - will be enriched later with ticker prices
              computedPnl = 0;
              computedPnlPercentage = 0;
              console.log(`⚠️ [Bitunix] No PnL data for ${p.symbol || 'unknown'}, will try to fetch price`);
            }

            const leverage = parseFloat(p.leverage || p.leverageRatio || '1') || 1;
            const marginUsed =
              parseFloat(p.marginUsed || p.margin || '0') ||
              (leverage > 0 ? (size * entryPrice) / leverage : size * entryPrice);

            // Try more field name variations for TP/SL (Bitunix might use different names)
            const stopLoss = extractFirstPositiveNumber(
              p.stopLoss,
              p.stop_loss,
              p.slPrice,
              p.sl_price,
              p.stopPrice,
              p.stop_price,
              p.sl,
              p.slTriggerPrice,
              p.slTriggerPx,
              p.stopLossPrice,
              p.stop_loss_price,
              p.positionStopLoss,
              p.position_stop_loss
            );
            
            const takeProfit = extractFirstPositiveNumber(
              p.takeProfit,
              p.take_profit,
              p.tpPrice,
              p.tp_price,
              p.tp,
              p.tpTriggerPrice,
              p.tpTriggerPx,
              p.takeProfitPrice,
              p.take_profit_price,
              p.positionTakeProfit,
              p.position_take_profit
            );

            return {
              exchange: 'bitunix',
              symbol: p.symbol || p.contract || p.tradingPair || p.instId || '',
              side,
              size,
              entryPrice,
              currentPrice,
              unrealizedPnL: computedPnl,
              unrealizedPnLPercentage: computedPnlPercentage,
              leverage,
              marginUsed,
              stopLoss,
              takeProfit,
              positionId: (() => {
                const raw =
                  p.positionId ??
                  p.position_id ??
                  p.posId ??
                  p.pos_id ??
                  p.id ??
                  p._id;
                const s = raw == null ? '' : String(raw);
                return s ? s : undefined;
              })(),
            };
          });

          // CRITICAL: Bitunix position objects don't include current price, so always fetch ticker prices
          // Always fetch prices for ALL Bitunix positions to ensure live data
          const symbolsNeedingPrice = Array.from(
            new Set(
              mappedPositions
                .map((p) => String(p.symbol || '').toUpperCase())
                .filter(Boolean)
            )
          );
          
          console.log(`🔍 [Bitunix] Fetching live prices for all positions: ${symbolsNeedingPrice.join(', ')} (${symbolsNeedingPrice.length} symbols)`);

          if (symbolsNeedingPrice.length) {
            try {
              // CRITICAL: Use correct API domain - futures uses fapi.bitunix.com
              const apiBaseUrl = 'https://fapi.bitunix.com';
              const priceMap = new Map<string, number>();
              
              // Try multiple endpoints (matching bot-executor approach)
              const tickerEndpoints = [
                `${apiBaseUrl}/api/v1/market/tickers?marketType=futures`,
                `${apiBaseUrl}/api/v1/market/ticker/all?marketType=futures`,
                `https://api.bitunix.com/api/v1/market/tickers?marketType=futures`,
                `https://api.bitunix.com/api/v1/market/ticker/all?marketType=futures`,
              ];
              
              let tickersArray: any[] = [];
              
              // Fetch all tickers once (more efficient than per-symbol)
              let tickerFetchAttempted = false;
              for (const tickerEndpoint of tickerEndpoints) {
                try {
                  if (!tickerFetchAttempted) {
                    console.log(`🔍 [Bitunix] Trying ticker endpoints for price data...`);
                    tickerFetchAttempted = true;
                  }
                  const resp = await fetch(tickerEndpoint, { 
                    method: 'GET', 
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                  });
                  
                  if (!resp.ok) {
                    // Only log once per endpoint type to reduce spam
                    if (tickerEndpoint.includes('/ticker/all')) {
                      console.warn(`⚠️ [Bitunix] Ticker endpoint ${tickerEndpoint} returned HTTP ${resp.status}`);
                    }
                    continue;
                  }
                  
                  const data = await resp.json().catch(() => null);
                  if (!data || data.code !== 0 || !data.data) {
                    // Only log code 2 errors (common, expected) once
                    if (data?.code === 2 && tickerEndpoint.includes('/ticker/all')) {
                      console.warn(`⚠️ [Bitunix] Ticker endpoint ${tickerEndpoint} returned code ${data.code}`);
                    }
                    continue;
                  }
                  
                  // Handle different response formats (same as bot-executor)
                  if (Array.isArray(data.data)) {
                    tickersArray = data.data;
                  } else if (typeof data.data === 'object') {
                    const possibleArrays = Object.values(data.data).filter((v: any) => Array.isArray(v));
                    if (possibleArrays.length > 0) {
                      tickersArray = possibleArrays[0] as any[];
                    } else {
                      tickersArray = Object.keys(data.data).map(key => ({
                        symbol: key,
                        ...(data.data as any)[key]
                      }));
                    }
                  }
                  
                  if (tickersArray.length > 0) {
                    console.log(`✅ [Bitunix] Fetched ${tickersArray.length} tickers from ${tickerEndpoint}`);
                    break; // Success, stop trying endpoints
                  }
                } catch (err) {
                  console.warn(`⚠️ [Bitunix] Error fetching from ${tickerEndpoint}:`, err instanceof Error ? err.message : String(err));
                  continue;
                }
              }
              
              // Extract prices from tickers
              for (const sym of symbolsNeedingPrice) {
                if (priceMap.has(sym)) continue;
                
                const ticker = tickersArray.find((t: any) => {
                  const tSymbol = String(t.symbol || t.contract || t.tradingPair || t.trading_pair || '').toUpperCase();
                  return tSymbol === sym;
                });
                
                if (ticker) {
                  // Try multiple price field names (Bitunix uses different formats)
                  const last = parseFloat(
                    ticker.lastPrice || 
                    ticker.last_price || 
                    ticker.price || 
                    ticker.close || 
                    ticker.last ||
                    ticker.markPrice ||
                    ticker.mark_price ||
                    ticker.currentPrice ||
                    ticker.current_price ||
                    '0'
                  );
                  if (Number.isFinite(last) && last > 0) {
                    priceMap.set(sym, last);
                    console.log(`✅ [Bitunix] Found price for ${sym}: ${last}`);
                  } else {
                    console.warn(`⚠️ [Bitunix] Ticker for ${sym} found but price is invalid. Fields: ${JSON.stringify(Object.keys(ticker)).substring(0, 200)}`);
                  }
                }
                // Don't log missing tickers individually - will log summary at end
              }
              
              // Fallback: Try individual ticker endpoint for symbols still missing prices (like bot-executor does)
              let singleTickerAttempted = false;
              for (const sym of symbolsNeedingPrice) {
                if (priceMap.has(sym)) continue;
                
                const singleTickerEndpoints = [
                  `https://api.bitunix.com/api/v1/market/ticker?symbol=${sym}&marketType=futures`,
                  `https://fapi.bitunix.com/api/v1/market/ticker?symbol=${sym}&marketType=futures`,
                ];
                
                for (const tickerUrl of singleTickerEndpoints) {
                  try {
                    if (!singleTickerAttempted) {
                      console.log(`🔍 [Bitunix] Trying single ticker endpoints for missing prices...`);
                      singleTickerAttempted = true;
                    }
                    const resp = await fetch(tickerUrl, { 
                      method: 'GET', 
                      headers: { 'Content-Type': 'application/json' },
                      signal: AbortSignal.timeout(5000)
                    });
                    
                    if (!resp.ok) continue;
                    
                    const tickerData = await resp.json().catch(() => null);
                    if (tickerData && tickerData.code === 0 && tickerData.data) {
                      // Try multiple price field names
                      const last = parseFloat(
                        tickerData.data.lastPrice || 
                        tickerData.data.last_price || 
                        tickerData.data.last || 
                        tickerData.data.price || 
                        tickerData.data.markPrice ||
                        tickerData.data.mark_price ||
                        tickerData.data.currentPrice ||
                        '0'
                      );
                      if (Number.isFinite(last) && last > 0) {
                        priceMap.set(sym, last);
                        console.log(`✅ [Bitunix] Found price for ${sym} via single ticker: ${last}`);
                        break; // Found price, stop trying other endpoints for this symbol
                      } else {
                        console.warn(`⚠️ [Bitunix] Single ticker for ${sym} returned invalid price. Data: ${JSON.stringify(tickerData.data).substring(0, 300)}`);
                      }
                    }
                  } catch (err) {
                    continue;
                  }
                }
              }
              
              // Log summary of missing prices once at the end
              const missingPrices = symbolsNeedingPrice.filter(sym => !priceMap.has(sym));
              if (missingPrices.length > 0 && !tickerFetchAttempted) {
                console.warn(`⚠️ [Bitunix] Could not fetch prices for ${missingPrices.length} symbols: ${missingPrices.join(', ')}`);
              }

              // Enrich positions with fetched prices and recompute PnL.
              const missingPricesList: string[] = [];
              for (const pos of mappedPositions) {
                const sym = String(pos.symbol || '').toUpperCase();
                const px = priceMap.get(sym);
                if (px && px > 0) {
                  const oldPrice = pos.currentPrice;
                  pos.currentPrice = px;
                  
                  // CRITICAL: Always recompute PnL when we have a valid current price
                  // Bitunix API often returns unrealizedPNL as 0 even when there's actual PnL
                  // So we ALWAYS recalculate from the current price to get accurate live data
                  if (pos.entryPrice > 0 && pos.size > 0) {
                    const delta = (px - pos.entryPrice) * (pos.side === 'short' ? -1 : 1);
                    pos.unrealizedPnL = delta * pos.size;
                    pos.unrealizedPnLPercentage = (delta / pos.entryPrice) * 100;
                    console.log(`✅ [Bitunix] Recalculated PnL for ${sym}: ${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercentage.toFixed(2)}%) from price ${px} (entry: ${pos.entryPrice})`);
                  }
                } else {
                  // If we couldn't fetch price, use entryPrice as fallback (better than 0)
                  if (pos.currentPrice === 0 && pos.entryPrice > 0) {
                    pos.currentPrice = pos.entryPrice;
                    // If we couldn't get live price, keep API PnL if it's valid, otherwise 0
                    if (!Number.isFinite(pos.unrealizedPnL) || pos.unrealizedPnL === 0) {
                      pos.unrealizedPnL = 0;
                      pos.unrealizedPnLPercentage = 0;
                    }
                    missingPricesList.push(sym);
                  }
                }
              }
              
              // Log summary of missing prices once
              if (missingPricesList.length > 0) {
                console.warn(`⚠️ [Bitunix] Could not fetch prices for ${missingPricesList.length} symbols (using entryPrice as fallback): ${missingPricesList.join(', ')}`);
              }
            } catch (priceErr) {
              console.warn('Bitunix: price enrichment failed', priceErr);
            }
          }

          // Merge SL/TP from TP/SL pending orders API when missing on the position objects.
          try {
            const symbols = Array.from(new Set(mappedPositions.map((p) => String(p.symbol || '').toUpperCase()).filter(Boolean)));
            const positionIds = mappedPositions.map((p) => p.positionId).filter(Boolean) as string[];
            console.log(`🔍 [Bitunix] Fetching TP/SL orders for symbols: ${symbols.join(', ')} and positionIds: ${positionIds.join(', ')}`);
            const ordersBySymbol = new Map<string, any[]>();
            const ordersByPositionId = new Map<string, any[]>();
            
            // First, try fetching ALL TP/SL orders once (more efficient)
            try {
              const allOrders = await fetchAllBitunixTpSlOrders();
              if (allOrders.length > 0) {
                console.log(`📊 [Bitunix] Fetched ${allOrders.length} total TP/SL orders`);
              }
              
              // Group orders by symbol and positionId
              for (const order of allOrders) {
                const oSymbol = String(order.symbol || order.contract || order.tradingPair || '').toUpperCase();
                const oPosId = String(order.positionId || order.position_id || order.posId || '');
                
                if (oSymbol) {
                  if (!ordersBySymbol.has(oSymbol)) {
                    ordersBySymbol.set(oSymbol, []);
                  }
                  ordersBySymbol.get(oSymbol)!.push(order);
                }
                
                if (oPosId) {
                  ordersByPositionId.set(oPosId, (ordersByPositionId.get(oPosId) || []).concat([order]));
                }
              }
            } catch (err) {
              console.warn(`⚠️ [Bitunix] Failed to fetch all TP/SL orders, falling back to per-symbol:`, err instanceof Error ? err.message : String(err));
              
              // Fallback: Try fetching by symbol
              await Promise.all(
                symbols.map(async (sym) => {
                  try {
                    const orders = await fetchBitunixPendingTpSlOrders(sym);
                    if (orders.length > 0) {
                      console.log(`📊 [Bitunix] Fetched ${orders.length} TP/SL orders for ${sym}`);
                    }
                    ordersBySymbol.set(sym, orders);
                  } catch (err) {
                    // Silently fail - reduce log spam
                  }
                })
              );
            }
            
            // Also try fetching by positionId (Bitunix might require positionId instead of symbol)
            await Promise.all(
              positionIds.map(async (posId) => {
                try {
                  const orders = await fetchBitunixPendingTpSlOrdersByPositionId(posId);
                  if (orders.length > 0) {
                    ordersByPositionId.set(posId, orders);
                  }
                } catch (err) {
                  // Silently fail - positionId-based fetch is optional
                }
              })
            );

            const normSide = (raw: any): 'long' | 'short' | null => {
              const s = String(raw || '').toLowerCase();
              if (s === 'long' || s === 'buy') return 'long';
              if (s === 'short' || s === 'sell') return 'short';
              return null;
            };

            const classifyTriggerAsTpOrSl = (
              trigger: number | undefined,
              entry: number,
              side: 'long' | 'short'
            ): { tp?: number; sl?: number } => {
              if (!trigger || !Number.isFinite(trigger) || trigger <= 0) return {};
              if (!Number.isFinite(entry) || entry <= 0) return {};
              // Heuristic: for LONG, TP above entry and SL below entry. For SHORT, inverse.
              if (side === 'long') {
                return trigger >= entry ? { tp: trigger } : { sl: trigger };
              }
              return trigger <= entry ? { tp: trigger } : { sl: trigger };
            };

            for (const pos of mappedPositions) {
              if (pos.stopLoss && pos.stopLoss > 0 && pos.takeProfit && pos.takeProfit > 0) {
                // Position already has TP/SL, skip
                continue;
              }
              const sym = String(pos.symbol || '').toUpperCase();
              const posId = pos.positionId ? String(pos.positionId) : '';
              
              // Try both symbol-based and positionId-based orders
              const ordersBySym = ordersBySymbol.get(sym) || [];
              const ordersByPosId = posId ? (ordersByPositionId.get(posId) || []) : [];
              const orders = ordersByPosId.length > 0 ? ordersByPosId : ordersBySym;
              
              if (!orders.length) {
                // No TP/SL orders found - this is expected if API doesn't support these endpoints
                // Only log if we actually tried to fetch (not if cache was empty)
                continue;
              }

              // Prefer matching by positionId if the API returns it; otherwise match by side if present.
              const relevant = orders.filter((o: any) => {
                const oid = String(o.positionId ?? o.position_id ?? o.posId ?? o.pos_id ?? '');
                if (posId && oid && posId === oid) return true;
                const oside = normSide(o.holdSide ?? o.positionSide ?? o.side);
                if (oside && oside === pos.side) return true;
                return !posId; // if we don't have posId, fall back to symbol-only
              });

              const candidates = relevant.length ? relevant : orders;
              let bestSL: number | undefined;
              let bestTP: number | undefined;

              for (const o of candidates) {
                const tp = extractFirstPositiveNumber(
                  o.tpPrice,
                  o.tp_price,
                  o.takeProfitPrice,
                  o.take_profit_price,
                  o.takeProfit,
                  o.tpTriggerPx,
                  o.tpTriggerPrice,
                  o.triggerPrice,
                  o.trigger_price
                );
                const sl = extractFirstPositiveNumber(
                  o.slPrice,
                  o.sl_price,
                  o.stopLossPrice,
                  o.stop_loss_price,
                  o.stopLoss,
                  o.slTriggerPx,
                  o.slTriggerPrice,
                  o.triggerPrice,
                  o.trigger_price
                );

                // Heuristic: some responses have only a single triggerPrice; use "type" hints if available.
                const kind = String(o.type ?? o.tpslType ?? o.tpSlType ?? o.planType ?? '').toLowerCase();
                if (tp && (!bestTP || tp > bestTP)) {
                  if (kind.includes('tp') || kind.includes('take')) bestTP = tp;
                }
                if (sl && (!bestSL || sl < bestSL)) {
                  if (kind.includes('sl') || kind.includes('stop')) bestSL = sl;
                }

                // If explicit tpPrice/slPrice exist, accept regardless of kind.
                if (extractFirstPositiveNumber(o.tpPrice, o.tp_price, o.takeProfitPrice, o.takeProfit)) bestTP = tp ?? bestTP;
                if (extractFirstPositiveNumber(o.slPrice, o.sl_price, o.stopLossPrice, o.stopLoss)) bestSL = sl ?? bestSL;

                // NEW: If we only have a generic trigger price (common for Bitunix "Position TP/SL"),
                // infer whether it's TP or SL by comparing against the position entry price + side.
                if (!bestTP || !bestSL) {
                  const trigger = extractFirstPositiveNumber(
                    o.triggerPrice,
                    o.trigger_price,
                    o.triggerPx,
                    o.trigger_px,
                    o.price,
                    o.orderPrice,
                    o.order_price
                  );
                  const inferred = classifyTriggerAsTpOrSl(trigger, pos.entryPrice, pos.side);
                  if (inferred.tp && (!bestTP || inferred.tp > bestTP)) bestTP = inferred.tp;
                  if (inferred.sl && (!bestSL || inferred.sl < bestSL)) bestSL = inferred.sl;
                }
              }

              if (!pos.stopLoss && bestSL) {
                console.log(`✅ [Bitunix] Merged SL for ${sym}: ${bestSL}`);
                pos.stopLoss = bestSL;
              }
              if (!pos.takeProfit && bestTP) {
                console.log(`✅ [Bitunix] Merged TP for ${sym}: ${bestTP}`);
                pos.takeProfit = bestTP;
              }
              // Don't log when we can't extract TP/SL - this is expected if orders don't have the right format
            }
          } catch (mergeErr) {
            console.warn('Bitunix TP/SL merge failed:', mergeErr);
          }

          return mappedPositions;
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }
    }
  }

  // If we only got 404 errors and no positions were found, return empty array
  // (404 likely means no positions exist or endpoint doesn't exist, which is a valid state)
  // BUT: Only return empty if we had NO successes at all
  if (has404Errors && !hasSuccess) {
    console.log('Bitunix: All endpoints returned 404 or errors, assuming no open positions');
    return [];
  }
  
  // If we had some successes but no positions found, that's also valid (no open positions)
  if (hasSuccess && !has404Errors) {
    console.log('Bitunix: Endpoints succeeded but no open positions found');
    return [];
  }

  // If we have other errors, log them but still return empty array to avoid breaking the UI
  // (Better to show 0 positions than crash the positions page)
  if (lastError) {
    console.error('Error fetching Bitunix positions:', lastError);
    // Don't throw - return empty array instead to gracefully handle API issues
    return [];
  }

  // Fallback: return empty array if somehow we get here
  return [];
}

/**
 * Close position on Bybit
 */
async function closeBybitPosition(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  side: 'long' | 'short',
  size: number
): Promise<any> {
  const baseUrl = 'https://api.bybit.com';
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const category = 'linear';
  
  // Opposite side to close position
  const closeSide = side === 'long' ? 'Sell' : 'Buy';

  const orderBody = {
    category: category,
    symbol: symbol,
    side: closeSide,
    orderType: 'Market',
    qty: size.toString(),
    reduceOnly: true,
    positionIdx: 0
  };

  const signaturePayload = timestamp + apiKey + recvWindow + JSON.stringify(orderBody);
  const signature = await createBybitSignature(signaturePayload, apiSecret);

  const response = await fetch(`${baseUrl}/v5/order/create`, {
    method: 'POST',
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': signature,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderBody)
  });

  const data = await response.json();
  if (data.retCode !== 0) {
    throw new Error(`Bybit API error (${data.retCode}): ${data.retMsg || 'Unknown error'}`);
  }

  return data.result;
}

/**
 * Close position on OKX
 */
async function closeOKXPosition(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  symbol: string,
  side: 'long' | 'short',
  size: number
): Promise<any> {
  const baseUrl = 'https://www.okx.com';
  const method = 'POST';
  const requestPath = '/api/v5/trade/order';
  
  // OKX uses 'close' side with reduceOnly
  const posSide = side === 'long' ? 'long' : 'short';
  const ordSide = side === 'long' ? 'sell' : 'buy';

  const orderBody = {
    instId: symbol,
    tdMode: 'cross',
    side: ordSide,
    ordType: 'market',
    sz: size.toString(),
    posSide: posSide,
    reduceOnly: true
  };

  const body = JSON.stringify(orderBody);
  const timestamp = new Date().toISOString();
  const signature = await createOKXSignature(timestamp, method, requestPath, body, apiSecret);

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method: 'POST',
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json'
    },
    body
  });

  const data = await response.json();
  if (data.code !== '0') {
    throw new Error(`OKX API error (${data.code}): ${data.msg || 'Unknown error'}`);
  }

  return data.data?.[0];
}

/**
 * Close position on Bitunix
 */
async function closeBitunixPosition(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  side: 'long' | 'short',
  size: number,
  positionId?: string
): Promise<any> {
  // NOTE: Bitunix futures close should be sent as a reduce/close order via the futures trade endpoint.
  // Using older endpoints like `/api/v1/futures/order` can return `code: 2 (System error)`.
  // For futures, the correct domain is typically fapi. The regular api domain often 404s for futures paths.
  const baseUrls = ['https://fapi.bitunix.com'];
  // Bitunix has multiple endpoint variants in the wild; try a small ordered set.
  const endpointsToTry = [
    '/api/v1/futures/trade/place_order',
    '/api/v1/futures/order/place_order',
    '/api/v1/futures/trade/placeOrder',
  ];

  // Opposite side to close (Bitunix expects BUY/SELL)
  const orderSide = side === 'long' ? 'SELL' : 'BUY';

  // Primary payload (matches bot-executor’s working futures order shape)
  const baseOrderParams: Record<string, any> = {
    symbol: symbol.toUpperCase(),
    side: orderSide,
    orderType: 'MARKET',
    qty: String(size),
    tradeSide: 'CLOSE',
    marginCoin: 'USDT',
    reduceOnly: true,
    positionId: positionId ? String(positionId) : undefined,
  };

  // Fallback: some Bitunix gateways reject marginCoin on certain endpoints
  const orderParamVariants: Record<string, any>[] = [
    baseOrderParams,
    { ...baseOrderParams, marginCoin: undefined }
  ].map(v => {
    const cleaned: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined && val !== null && val !== '') cleaned[k] = val;
    }
    return cleaned;
  });

  const errorSummaries: string[] = [];
  let lastErr: any = null;
  for (const baseUrl of baseUrls) {
    for (const endpoint of endpointsToTry) {
      for (const orderParams of orderParamVariants) {
        const timestamp = Date.now().toString();
        const nonce = generateNonce();
        const queryParams = '';
        const body = JSON.stringify(orderParams).replace(/\s+/g, '');
        const signature = await createBitunixSignature(nonce, timestamp, apiKey, queryParams, body, apiSecret);

        const url = `${baseUrl}${endpoint}`;
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body
          });

          const responseText = await response.text();
          let data: any = null;
          try {
            data = JSON.parse(responseText);
          } catch {
            // keep null
          }

          console.log(`[bitunix][close] ${url} status=${response.status} body=${responseText?.slice(0, 300)}`);

          if (!response.ok) {
            const msg = `HTTP ${response.status} @ ${endpoint}: ${responseText?.slice(0, 120)}`;
            errorSummaries.push(msg);
            lastErr = new Error(`Bitunix HTTP ${response.status}: ${responseText?.slice(0, 300)}`);
            continue;
          }

          if (!data) {
            const msg = `Invalid JSON @ ${endpoint}: ${responseText?.slice(0, 120)}`;
            errorSummaries.push(msg);
            lastErr = new Error(`Bitunix invalid JSON: ${responseText?.slice(0, 300)}`);
            continue;
          }

          if (data.code !== 0) {
            const msg = `API code ${data.code} @ ${endpoint}: ${String(data.msg || '').slice(0, 120)}`;
            errorSummaries.push(msg);
            lastErr = new Error(`Bitunix API error (${data.code}): ${data.msg || 'Unknown error'}`);
            continue;
          }

          return data.data;
        } catch (e) {
          errorSummaries.push(`Fetch error @ ${endpoint}: ${String((e as any)?.message || e).slice(0, 120)}`);
          lastErr = e;
        }
      }
    }
  }

  const summary = errorSummaries.length ? ` Attempts: ${errorSummaries.slice(-6).join(' | ')}` : '';
  throw lastErr ? new Error(`${lastErr.message}${summary}`) : new Error(`Failed to close Bitunix position.${summary}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET: Fetch positions
    if (req.method === 'GET' && action === 'list') {
      const startTime = Date.now();
      console.log(`📋 [${new Date().toISOString()}] Positions list request: exchange=${url.searchParams.get('exchange') || 'all'}, user=${user.id}`);
      const exchangeFilter = url.searchParams.get('exchange') || 'all';

      // Get user's API keys
      const { data: apiKeys, error: apiKeysError } = await supabaseClient
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_testnet', false)
        .eq('is_active', true);

      if (apiKeysError) {
        throw new Error(`Failed to fetch API keys: ${apiKeysError.message}`);
      }

      if (!apiKeys || apiKeys.length === 0) {
        return new Response(JSON.stringify({ positions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const allPositions: ExchangePosition[] = [];
      const errors: string[] = [];

      // Group API keys by exchange
      const keysByExchange = new Map<string, any>();
      for (const key of apiKeys) {
        const exchange = key.exchange?.toLowerCase();
        if (exchange && !keysByExchange.has(exchange)) {
          keysByExchange.set(exchange, key);
        }
      }

      // Fetch positions from each exchange with timeout protection
      const exchangePromises = Array.from(keysByExchange.entries()).map(async ([exchange, apiKey]) => {
        if (exchangeFilter !== 'all' && exchangeFilter !== exchange) {
          return { exchange, positions: [], error: null };
        }

        try {
          // Decrypt API keys
          const decryptedApiKey = decrypt(apiKey.api_key);
          const decryptedApiSecret = decrypt(apiKey.api_secret);

          let positions: ExchangePosition[] = [];

          // Add timeout: max 15 seconds per exchange to prevent hanging
          const fetchPromise = (async () => {
            if (exchange === 'bybit') {
              return await fetchBybitPositions(decryptedApiKey, decryptedApiSecret);
            } else if (exchange === 'okx') {
              const passphrase = apiKey.passphrase ? decrypt(apiKey.passphrase) : '';
              return await fetchOKXPositions(decryptedApiKey, decryptedApiSecret, passphrase);
            } else if (exchange === 'bitunix') {
              return await fetchBitunixPositions(decryptedApiKey, decryptedApiSecret);
            }
            return [];
          })();

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout: ${exchange} fetch took longer than 15s`)), 15000);
          });

          positions = await Promise.race([fetchPromise, timeoutPromise]);
          
          console.log(`✅ Fetched ${positions.length} positions from ${exchange}`);
          return { exchange, positions, error: null };
        } catch (error: any) {
          const errorMsg = `${exchange}: ${error.message || String(error)}`;
          console.error(`❌ Failed to fetch positions from ${exchange}:`, errorMsg);
          return { exchange, positions: [], error: errorMsg };
        }
      });

      // Wait for all exchanges with timeout (max 30 seconds total)
      try {
        const allResults = await Promise.race([
          Promise.all(exchangePromises),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: Total fetch took longer than 30s')), 30000);
          })
        ]);

        // Aggregate results
        for (const result of allResults) {
          allPositions.push(...result.positions);
          if (result.error) {
            errors.push(result.error);
          }
        }
      } catch (totalError: any) {
        // If total timeout occurred, try to get any partial results
        try {
          const partialResults = await Promise.allSettled(exchangePromises);
          for (const settled of partialResults) {
            if (settled.status === 'fulfilled') {
              allPositions.push(...settled.value.positions);
              if (settled.value.error) {
                errors.push(settled.value.error);
              }
            } else {
              errors.push(`Promise rejected: ${settled.reason?.message || String(settled.reason)}`);
            }
          }
        } catch {
          // If even settled fails, add timeout error
          errors.push(`Total timeout: ${totalError.message || String(totalError)}`);
        }
      }

      console.log(`📊 Total positions fetched: ${allPositions.length} from ${keysByExchange.size} exchanges${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);

      return new Response(JSON.stringify({ 
        positions: allPositions,
        errors: errors.length > 0 ? errors : undefined
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Close position
    if (req.method === 'POST' && action === 'close') {
      const body = await req.json();
      const { exchange, symbol, side, size, positionId } = body;

      if (!exchange || !symbol || !side || !size) {
        return new Response(JSON.stringify({ error: 'Missing required fields: exchange, symbol, side, size' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get API keys for the exchange
      const { data: apiKeys, error: apiKeysError } = await supabaseClient
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', exchange.toLowerCase())
        .eq('is_testnet', false)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (apiKeysError || !apiKeys) {
        return new Response(JSON.stringify({ 
          error: `No active API keys found for ${exchange}` 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Decrypt API keys
      const decryptedApiKey = decrypt(apiKeys.api_key);
      const decryptedApiSecret = decrypt(apiKeys.api_secret);

      let result: any;

      try {
        if (exchange.toLowerCase() === 'bybit') {
          result = await closeBybitPosition(decryptedApiKey, decryptedApiSecret, symbol, side, size);
        } else if (exchange.toLowerCase() === 'okx') {
          const passphrase = apiKeys.passphrase ? decrypt(apiKeys.passphrase) : '';
          result = await closeOKXPosition(decryptedApiKey, decryptedApiSecret, passphrase, symbol, side, size);
        } else if (exchange.toLowerCase() === 'bitunix') {
          // Bitunix often requires `positionId` when tradeSide is CLOSE (otherwise code=10002 Parameter error).
          // UI currently sends only exchange/symbol/side/size, so we resolve the matching positionId server-side.
          const norm = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          let resolvedPositionId: string | undefined = positionId ? String(positionId) : undefined;
          if (!resolvedPositionId) {
            const openPositions = await fetchBitunixPositions(decryptedApiKey, decryptedApiSecret);
            const target = openPositions.find((p) => norm(p.symbol) === norm(symbol) && p.side === side);
            resolvedPositionId = target?.positionId;
          }

          if (!resolvedPositionId) {
            throw new Error(`Bitunix close requires positionId but none found for ${symbol} ${side}. Refresh positions and try again.`);
          }

          result = await closeBitunixPosition(
            decryptedApiKey,
            decryptedApiSecret,
            symbol,
            side,
            size,
            resolvedPositionId
          );
        } else {
          return new Response(JSON.stringify({ 
            error: `Unsupported exchange: ${exchange}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Position closed successfully',
        result 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ 
        error: `Failed to close position: ${error.message || String(error)}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

    // GET: Fetch closed positions
    if (req.method === 'GET' && action === 'closed-positions') {
      const exchangeFilter = url.searchParams.get('exchange') || 'all';
      const limit = Math.max(10, parseInt(url.searchParams.get('limit') || '10')); // At least 10

      // Fetch closed trades from database
      // Note: trades table uses 'price' (not entry_price), 'amount' (not size), and doesn't have 'leverage'
      let query = supabaseClient
        .from('trades')
        .select(`
          id,
          exchange,
          symbol,
          side,
          amount,
          price,
          pnl,
          fee,
          status,
          executed_at,
          created_at
        `)
        .eq('user_id', user.id)
        .in('status', ['closed', 'filled', 'completed'])
        .not('pnl', 'is', null)
        .order('executed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      // Apply exchange filter if specified
      if (exchangeFilter !== 'all') {
        query = query.eq('exchange', exchangeFilter.toLowerCase());
      }

      const { data: closedTrades, error: tradesError } = await query;

      if (tradesError) {
        return new Response(JSON.stringify({ 
          error: `Failed to fetch closed positions: ${tradesError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Transform trades to ClosedPosition format
      // Note: trades table uses 'price' for entry price, and may not have exit_price
      const closedPositions: ClosedPosition[] = (closedTrades || []).map((trade: any) => {
        const entryPrice = parseFloat(trade.price || trade.entry_price || 0);
        // Exit price may not exist in trades table - use entry price if not available
        // (PnL is already calculated, so exit price is less critical for display)
        const exitPrice = parseFloat(trade.exit_price || trade.price || entryPrice);
        const size = parseFloat(trade.amount || 0);
        const fees = parseFloat(trade.fee || 0);
        const pnl = parseFloat(trade.pnl || 0);
        
        // Calculate PnL percentage if not already calculated
        const pnlPercentage = entryPrice > 0 && size > 0
          ? (pnl / (entryPrice * size)) * 100
          : 0;

        return {
          exchange: trade.exchange || 'unknown',
          symbol: trade.symbol || '',
          side: (trade.side || 'long').toLowerCase() === 'buy' ? 'long' : 'short',
          size,
          entryPrice,
          exitPrice,
          pnl,
          pnlPercentage,
          fees,
          leverage: 1, // Leverage not stored in trades table, default to 1
          closedAt: trade.executed_at || trade.created_at || new Date().toISOString()
        };
      });

      return new Response(JSON.stringify({ 
        closedPositions,
        count: closedPositions.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`❌ [${new Date().toISOString()}] Edge Function error:`, error.message || String(error));
    if (error.stack) {
      console.error(`   Stack: ${error.stack.substring(0, 1000)}`);
    }
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      details: process.env.DENO_ENV === 'development' ? error.stack?.substring(0, 500) : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
