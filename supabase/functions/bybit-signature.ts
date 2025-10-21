// Proper Bybit API signature implementation
// This file contains the correct signature generation for Bybit API

export class BybitSignature {
  static async createSignature(params: string, secret: string): Promise<string> {
    // Bybit expects HMAC-SHA256 signature in lowercase hex format
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(params);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    
    // Convert to lowercase hex string as required by Bybit
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  
  static async createOrderSignature(params: any, secret: string): Promise<string> {
    // For POST requests, Bybit expects the signature to be calculated differently
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Create the parameter string
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Add timestamp and recvWindow
    const fullParamString = `${paramString}&timestamp=${timestamp}&recv_window=${recvWindow}`;
    
    return await this.createSignature(fullParamString, secret);
  }
}

// Example usage for balance API
export async function fetchBybitBalanceWithSignature(apiKey: string, apiSecret: string, isTestnet: boolean) {
  const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  
  try {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Create parameter string
    const params = `accountType=UNIFIED&timestamp=${timestamp}&recv_window=${recvWindow}`;
    
    // Create signature
    const signature = await BybitSignature.createSignature(params, apiSecret);
    
    // Make the request
    const response = await fetch(`${baseUrl}/v5/account/wallet-balance?${params}&api_key=${apiKey}&sign=${signature}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }
    
    return data;
  } catch (error) {
    console.error('Bybit API error:', error);
    throw error;
  }
}

// Example usage for order API
export async function placeBybitOrderWithSignature(apiKey: string, apiSecret: string, isTestnet: boolean, orderParams: any) {
  const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  
  try {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Add required parameters
    const params = {
      ...orderParams,
      timestamp: timestamp,
      recv_window: recvWindow
    };
    
    // Create signature
    const signature = await BybitSignature.createOrderSignature(params, apiSecret);
    
    // Create query string for POST request
    const queryString = new URLSearchParams(params).toString();
    
    // Make the request
    const response = await fetch(`${baseUrl}/v5/order/create?${queryString}&api_key=${apiKey}&sign=${signature}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }
    
    return data;
  } catch (error) {
    console.error('Bybit order error:', error);
    throw error;
  }
}
