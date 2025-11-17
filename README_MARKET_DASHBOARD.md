# Real-Time Crypto Market Analysis Dashboard

A comprehensive real-time cryptocurrency market analysis dashboard built with Bybit API integration, WebSocket support, and Docker deployment.

## Features

- **Real-Time Price Updates**: WebSocket connection to Bybit for live price ticks
- **Market Overview**: Price tiles for top cryptocurrencies
- **Market Cap**: Estimated market capitalization
- **Inflows/Outflows**: Calculated based on volume and price changes
- **Top Gainers**: Best performing assets in 24h
- **Rapid Changes**: Assets with >5% change in 24h
- **Technical Indicators**: VWAP, ATR, RSI calculated on backend
- **Alerts**: Large trades and 24h highs notifications
- **Rate Limiting**: Built-in rate limiting and exponential backoff

## Architecture

### Backend (Supabase Edge Function)
- **Location**: `supabase/functions/market-data/index.ts`
- **Endpoints**:
  - `GET /functions/v1/market-data?action=all` - Get all market data
  - `GET /functions/v1/market-data?action=symbol&symbol=BTCUSDT` - Get single symbol
  - `GET /functions/v1/market-data?action=alerts` - Get alerts

### Frontend
- **Location**: `src/pages/market-dashboard/page.tsx`
- **Route**: `/market-dashboard`
- **Features**:
  - Real-time price updates via WebSocket
  - Interactive price tiles
  - Expandable details (VWAP, ATR, RSI)
  - Alert notifications
  - Top gainers display
  - Rapid changes table

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

### 2. Deploy Edge Function

Deploy the market-data Edge Function to Supabase:

```bash
supabase functions deploy market-data
```

### 3. Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173/market-dashboard`

### 4. Docker Deployment

#### Build and Run

```bash
docker-compose up --build
```

#### Environment Variables for Docker

Create a `.env` file with:

```env
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_URL=https://your-project.supabase.co
```

#### Production Build

```bash
docker build -t market-dashboard .
docker run -p 3000:80 --env-file .env market-dashboard
```

## API Usage

### Get All Market Data

```bash
curl "https://your-project.supabase.co/functions/v1/market-data?action=all" \
  -H "apikey: your-anon-key"
```

### Get Single Symbol

```bash
curl "https://your-project.supabase.co/functions/v1/market-data?action=symbol&symbol=BTCUSDT" \
  -H "apikey: your-anon-key"
```

### Get Alerts

```bash
curl "https://your-project.supabase.co/functions/v1/market-data?action=alerts" \
  -H "apikey: your-anon-key"
```

## Rate Limiting

- **Limit**: 100 requests per minute per IP
- **Window**: 60 seconds
- **Backoff**: Exponential (1s, 2s, 4s) for failed requests

## WebSocket Connection

The dashboard automatically connects to Bybit WebSocket for real-time price updates:

- **Endpoint**: `wss://stream.bybit.com/v5/public/spot`
- **Subscription**: Ticker updates for all tracked symbols
- **Auto-reconnect**: 5 seconds after disconnect

## Technical Indicators

### VWAP (Volume Weighted Average Price)
Calculated from last 200 hourly candles using typical price (H+L+C)/3.

### ATR (Average True Range)
14-period ATR calculated from high, low, and close prices.

### RSI (Relative Strength Index)
14-period RSI indicating overbought (>70) or oversold (<30) conditions.

## Alert Rules

### 24h High Alert
Triggers when current price is within 0.1% of 24h high.

### Large Volume Alert
Triggers when 24h volume exceeds $1B USD.

## Monitoring

### Health Check

Docker health check runs every 30 seconds:

```bash
docker ps  # Check health status
```

### Logs

View logs:

```bash
docker-compose logs -f market-dashboard
```

## Security

- API keys stored in `.env` (not committed to git)
- Rate limiting prevents abuse
- CORS headers configured
- Security headers in nginx config

## Performance

- **Data Refresh**: Every 30 seconds
- **WebSocket**: Real-time price updates
- **Caching**: Static assets cached for 1 year
- **Gzip**: Enabled for all text responses

## Troubleshooting

### WebSocket Not Connecting

1. Check browser console for errors
2. Verify Bybit WebSocket endpoint is accessible
3. Check network connectivity

### Rate Limit Errors

1. Reduce request frequency
2. Implement client-side caching
3. Use WebSocket for real-time updates instead of polling

### API Errors

1. Verify Supabase Edge Function is deployed
2. Check environment variables
3. Review Edge Function logs in Supabase dashboard

## Future Enhancements

- [ ] Historical price charts
- [ ] More technical indicators (MACD, Bollinger Bands)
- [ ] Custom alert rules
- [ ] Portfolio tracking
- [ ] News integration
- [ ] Social sentiment analysis
- [ ] Order book visualization

## License

MIT

