
export interface TradingBot {
  id: string;
  name: string;
  exchange: 'bybit' | 'okx';
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  leverage: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winRate: number;
  createdAt: string;
  lastTradeAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
  strategy: TradingStrategy;
}

export interface TradingStrategy {
  rsiThreshold: number;
  adxThreshold: number;
  bbWidthThreshold: number;
  emaSlope: number;
  atrPercentage: number;
  vwapDistance: number;
  momentumThreshold: number;
  useMLPrediction: boolean;
  minSamplesForML: number;
}

export interface Trade {
  id: string;
  botId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  status: 'open' | 'closed';
  timestamp: string;
  exchange: 'bybit' | 'okx';
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  rsi: number;
  adx: number;
  bbWidth: number;
  emaSlope: number;
  atrPercentage: number;
  vwapDistance: number;
  momentum: number;
}

export interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  maxPositions: number;
  dailyLossLimit: number;
  slippageThreshold: number;
}
