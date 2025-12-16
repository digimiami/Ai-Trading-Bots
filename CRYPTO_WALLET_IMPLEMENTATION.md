# Crypto Wallet Implementation

## Overview

A complete crypto wallet system has been added to enable users to buy and send BTC (Bitcoin). The implementation includes database schema, backend API, and frontend interface.

## What Was Added

### 1. Database Schema (`supabase/migrations/20250124_create_crypto_wallet_system.sql`)

Three main tables were created:

- **`crypto_wallets`**: Stores user wallet addresses and metadata
- **`wallet_balances`**: Tracks current balances per wallet
- **`wallet_transactions`**: Records all transactions (buy, send, receive)

Features:
- Automatic balance updates via database triggers
- Row Level Security (RLS) policies for data protection
- Support for multiple cryptocurrencies (BTC, ETH, USDT, etc.)
- Transaction history tracking

### 2. Backend Edge Function (`supabase/functions/crypto-wallet/index.ts`)

API endpoints:
- `GET /` - Get wallet info, balances, and transactions
- `POST /create-wallet` - Create a new wallet address
- `POST /buy` - Initiate BTC purchase
- `POST /send` - Send BTC to an address
- `GET /transactions` - Get transaction history

### 3. Frontend Wallet Page (`src/pages/wallet/page.tsx`)

Features:
- View wallet balance and address
- Buy BTC with USD or BTC
- Send BTC to other addresses
- View transaction history
- Copy wallet address to clipboard
- Responsive design with dark mode support

### 4. Navigation & Routing

- Added `/wallet` route to router
- Added "Wallet" link to navigation menu

## Next Steps for Production

### 1. Integrate Payment Providers for Buying BTC

The current implementation uses mock payment URLs. For production, integrate with:

**Option A: Coinbase Commerce**
- API: https://commerce.coinbase.com/docs/api/
- Supports BTC purchases with credit card/bank transfer
- Handles KYC/AML compliance

**Option B: MoonPay**
- API: https://www.moonpay.com/api
- Simple integration
- Supports multiple payment methods

**Option C: Transak**
- API: https://docs.transak.com/
- Good for international users
- Supports many cryptocurrencies

**Implementation Example:**
```typescript
// In crypto-wallet/index.ts, update generatePaymentUrl function
async function generatePaymentUrl(provider: string, params: any): Promise<string> {
  if (provider === 'coinbase') {
    // Create Coinbase Commerce charge
    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'X-CC-Api-Key': Deno.env.get('COINBASE_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bitcoin Purchase',
        description: `Buy ${params.amount} BTC`,
        local_price: {
          amount: params.amount,
          currency: params.currency,
        },
        pricing_type: 'fixed_price',
        metadata: {
          transaction_id: params.transactionId,
        },
      }),
    });
    const data = await response.json();
    return data.data.hosted_url;
  }
  // ... other providers
}
```

### 2. Integrate Bitcoin Wallet Service for Sending BTC

The current implementation uses mock transaction hashes. For production, integrate with:

**Option A: BlockCypher API**
- API: https://www.blockcypher.com/dev/bitcoin/
- Free tier available
- Handles transaction signing and broadcasting

**Option B: Blockchain.info API**
- API: https://www.blockchain.com/api
- Well-documented
- Good for basic operations

**Option C: Your Own Bitcoin Node**
- Full control
- Requires infrastructure setup
- Use libraries like `bitcoinjs-lib`

**Implementation Example:**
```typescript
// In crypto-wallet/index.ts, update simulateSendTransaction function
async function sendBitcoinTransaction(
  fromAddress: string,
  toAddress: string,
  amount: number,
  fee: number,
  privateKey: string // Store securely, never expose
): Promise<string> {
  // Use BlockCypher API
  const response = await fetch('https://api.blockcypher.com/v1/btc/main/txs/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: [{ addresses: [fromAddress] }],
      outputs: [{ addresses: [toAddress], value: Math.floor(amount * 100000000) }], // Convert to satoshis
    }),
  });
  
  const tx = await response.json();
  // Sign transaction with private key (use bitcoinjs-lib)
  // Broadcast signed transaction
  const broadcastResponse = await fetch('https://api.blockcypher.com/v1/btc/main/txs/send', {
    method: 'POST',
    body: JSON.stringify(signedTx),
  });
  
  return broadcastResponse.json().hash;
}
```

### 3. Generate Real Bitcoin Addresses

Currently using mock addresses. For production:

**Option A: Use HD Wallet (Hierarchical Deterministic)**
- Generate addresses from a master seed
- Use libraries like `bip32`, `bip39`, `bitcoinjs-lib`
- Store encrypted seed phrase securely

**Option B: Use a Wallet Service**
- Services like BlockCypher provide address generation
- They handle key management
- Less control but easier to implement

**Implementation Example:**
```typescript
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

function generateBitcoinAddress(userId: string, index: number): string {
  // Derive from master seed (store securely)
  const masterSeed = getMasterSeedForUser(userId);
  const root = bip32.fromSeed(masterSeed);
  const path = `m/44'/0'/0'/0/${index}`;
  const keyPair = root.derivePath(path);
  
  // Generate P2PKH address (starts with 1)
  const { address } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.bitcoin,
  });
  
  return address!;
}
```

### 4. Security Considerations

**Private Key Management:**
- Never store private keys in plain text
- Use encryption at rest
- Consider hardware security modules (HSM) for production
- Implement key rotation policies

**Transaction Security:**
- Implement rate limiting
- Add 2FA for large transactions
- Require email confirmation for sends
- Implement withdrawal limits

**Compliance:**
- KYC/AML checks for large purchases
- Transaction monitoring
- Regulatory reporting (if required)
- User identity verification

### 5. Environment Variables Needed

Add these to Supabase Edge Function secrets:

```bash
# Payment Providers
COINBASE_API_KEY=your_coinbase_api_key
MOONPAY_API_KEY=your_moonpay_api_key
TRANSAK_API_KEY=your_transak_api_key

# Bitcoin Services
BLOCKCYPHER_API_TOKEN=your_blockcypher_token
BLOCKCHAIN_API_KEY=your_blockchain_api_key

# Wallet Security
WALLET_ENCRYPTION_KEY=your_encryption_key
MASTER_SEED_PASSPHRASE=your_passphrase
```

### 6. Testing

Before going live:
1. Test on Bitcoin testnet first
2. Test with small amounts
3. Verify transaction confirmations
4. Test error handling (insufficient balance, invalid addresses, etc.)
5. Test payment provider webhooks
6. Load test the system

## Current Limitations

1. **Mock Addresses**: Currently generates placeholder addresses
2. **Mock Transactions**: Sending BTC doesn't actually broadcast to blockchain
3. **Mock Payments**: Buying BTC doesn't integrate with real payment providers
4. **No Key Management**: Private keys are not generated/stored
5. **No Testnet Support**: Only mainnet addresses

## Usage

1. **Run the migration**:
   ```sql
   -- In Supabase SQL Editor
   -- Run: supabase/migrations/20250124_create_crypto_wallet_system.sql
   ```

2. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy crypto-wallet
   ```

3. **Access the wallet**:
   - Navigate to `/wallet` in the app
   - Or click "Wallet" in the navigation menu

4. **Create a wallet**:
   - The wallet is automatically created when you first buy BTC
   - Or call the API endpoint manually

## Support

For questions or issues, refer to:
- Bitcoin documentation: https://bitcoin.org/en/developer-documentation
- BlockCypher docs: https://www.blockcypher.com/dev/bitcoin/
- Coinbase Commerce docs: https://commerce.coinbase.com/docs/api/

---

**Note**: This implementation provides the foundation for a crypto wallet. For production use, you must integrate with real payment providers and Bitcoin wallet services, implement proper key management, and ensure compliance with local regulations.

