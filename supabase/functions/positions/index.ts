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
  // `get_pending_positions` / `get_history_positions` are more reliable.
  const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com'];
  const endpoints = [
    '/api/v1/futures/position/get_pending_positions',
    '/api/v1/futures/position/get_history_positions',
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

  // Prefer no-query (some accounts succeed more reliably) then typical variants.
  const queryVariants = [
    '',
    'marginCoin=USDT',
    'marketType=futures',
    'marketType=futures&marginCoin=USDT',
  ];

  let lastError: any = null;

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
            lastError = new Error(`Bitunix API error (${data.code}) on ${endpoint}: ${data.msg || 'Unknown error'}`);
            continue;
          }

          const positions = parsePositionsFromResponse(data)
            .filter((p: any) => extractSize(p) > 0);

          if (!positions.length) {
            // Successful response but empty; try other variants/endpoints.
            continue;
          }

          return positions.map((p: any) => {
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
            const currentPrice = parseFloat(p.markPrice || p.lastPrice || p.price || p.curPrice || '0') || entryPrice;
            const unrealizedPnL = parseFloat(p.unrealisedPnl || p.unrealizedPnl || p.pnl || '0');

            const sideRaw = String(p.side || p.positionSide || p.holdSide || p.posSide || '').toLowerCase();
            const isShort = sideRaw === 'short' || sideRaw === 'sell';
            const side: 'long' | 'short' = isShort ? 'short' : 'long';

            // If the API doesn't provide PnL, compute a simple estimate.
            const computedPnl =
              Number.isFinite(unrealizedPnL) && unrealizedPnL !== 0
                ? unrealizedPnL
                : (currentPrice - entryPrice) * size * (isShort ? -1 : 1);

            const unrealizedPnLPercentage =
              entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 * (isShort ? -1 : 1) : 0;

            const leverage = parseFloat(p.leverage || p.leverageRatio || '1') || 1;
            const marginUsed =
              parseFloat(p.marginUsed || p.margin || '0') ||
              (leverage > 0 ? (size * entryPrice) / leverage : size * entryPrice);

            return {
              exchange: 'bitunix',
              symbol: p.symbol || p.contract || p.tradingPair || p.instId || '',
              side,
              size,
              entryPrice,
              currentPrice,
              unrealizedPnL: computedPnl,
              unrealizedPnLPercentage,
              leverage,
              marginUsed,
              stopLoss: parseFloat(p.stopLoss || p.stop_loss || p.slPrice || p.sl_price || '0') || undefined,
              takeProfit: parseFloat(p.takeProfit || p.take_profit || p.tpPrice || p.tp_price || '0') || undefined,
            };
          });
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }
    }
  }

  console.error('Error fetching Bitunix positions:', lastError);
  throw lastError || new Error('Error fetching Bitunix positions');
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
  size: number
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
    marginCoin: 'USDT'
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

      // Fetch positions from each exchange
      for (const [exchange, apiKey] of keysByExchange.entries()) {
        if (exchangeFilter !== 'all' && exchangeFilter !== exchange) {
          continue;
        }

        try {
          // Decrypt API keys
          const decryptedApiKey = decrypt(apiKey.api_key);
          const decryptedApiSecret = decrypt(apiKey.api_secret);

          let positions: ExchangePosition[] = [];

          if (exchange === 'bybit') {
            positions = await fetchBybitPositions(decryptedApiKey, decryptedApiSecret);
          } else if (exchange === 'okx') {
            const passphrase = apiKey.passphrase ? decrypt(apiKey.passphrase) : '';
            positions = await fetchOKXPositions(decryptedApiKey, decryptedApiSecret, passphrase);
          } else if (exchange === 'bitunix') {
            positions = await fetchBitunixPositions(decryptedApiKey, decryptedApiSecret);
          }

          allPositions.push(...positions);
        } catch (error: any) {
          errors.push(`${exchange}: ${error.message || String(error)}`);
        }
      }

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
      const { exchange, symbol, side, size } = body;

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
          result = await closeBitunixPosition(decryptedApiKey, decryptedApiSecret, symbol, side, size);
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
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
