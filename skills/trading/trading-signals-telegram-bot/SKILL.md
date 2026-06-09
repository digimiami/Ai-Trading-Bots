---
name: trading-signals-telegram-bot
description: "Build fully autonomous Telegram bots that generate crypto trading signals using free CoinGecko data, distribute to free/premium channels, and handle subscriptions via Stripe + referral system — all on cron with zero manual intervention."
version: 1.0.0
license: MIT
metadata:
  hermes:
    tags: [trading, telegram, crypto, signals, monetization]
---

# Trading Signals Telegram Bot

## Overview

A fully autonomous Telegram bot ecosystem that:
1. Generates crypto trading signals from free market data (CoinGecko)
2. Distributes free signals to public channels
3. Sends premium signals to paid subscribers
4. Handles subscriptions via Stripe
5. Runs on cron — no manual intervention

## Architecture

```
CoinGecko API (free, no key needed)
  → Signal Engine (technical indicators + screener)
    → Free Channel (public Telegram)
    → Premium Channel (Stripe-gated)
      → Stripe Webhook → Telegram bot grants access
```

## Key Components

### 1. Signal Engine

Uses CoinGecko free API (no auth required):

```python
import requests

def get_signal():
    # Top coins by volume
    data = requests.get(
        "https://api.coingecko.com/api/v3/coins/markets",
        params={
            "vs_currency": "usd",
            "order": "volume_desc",
            "per_page": 50,
            "sparkline": "false"
        },
        timeout=10
    ).json()
    
    signals = []
    for coin in data:
        # RSI approximation
        change_24h = coin["price_change_percentage_24h"]
        volume_ratio = coin["total_volume"] / coin["market_cap"] if coin["market_cap"] else 0
        
        if change_24h > 5 and volume_ratio > 0.3:
            signals.append({
                "coin": coin["name"],
                "symbol": coin["symbol"],
                "action": "🚀 STRONG BUY",
                "price": coin["current_price"],
                "change": f"{change_24h:.1f}%",
                "volume_ratio": f"{volume_ratio:.2f}"
            })
    return signals
```

### 2. Telegram Distribution

**Free channel**: sends 1-2 signals per day, delayed
**Premium channel**: real-time signals + alerts + detailed analysis

```python
def post_free_signal(signals):
    msg = "📊 **Daily Free Signal**\n\n"
    for s in signals[:2]:
        msg += f"{s['action']} {s['coin']} ({s['symbol'].upper()})\n"
        msg += f"Price: ${s['price']:,.2f} | 24h: {s['change']}\n\n"
    msg += "💎 Premium signals: t.me/bot?start=pay"
    # post to free channel
```

### 3. Stripe Subscription Flow

```python
import stripe
stripe.api_key = "sk_..."

# Create checkout session
checkout = stripe.checkout.Session.create(
    success_url="https://t.me/YourBot?start=verified",
    cancel_url="https://t.me/YourBot",
    line_items=[{"price": "price_premium_monthly", "quantity": 1}],
    mode="subscription",
)

# Webhook handler
# On checkout.session.completed → grant premium access via Telegram chat_id
```

### 4. Telegram Deep Link Integration

Use short `t.me/BotName?start=pay` links for CTA — NOT bot @mentions, NOT long Stripe URLs. Everything in one bot, no bot-hopping.

### 5. Cron Job Schedule

```bash
# Signal generation: every 4 hours
hermes cron create --schedule "0 */4 * * *" \
  --prompt "Generate crypto signals from CoinGecko. Post 2 free to public channel, full premium to paid channel." \
  --skills trading-signals-telegram-bot

# Stripe check: every 30 min for new subscribers
hermes cron create --schedule "*/30 * * * *" \
  --prompt "Check Stripe for new premium subscribers, grant Telegram access." \
  --skills trading-signals-telegram-bot
```

## Monetization Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 2 delayed signals/day, basic analysis |
| Premium | $9.99/mo | Real-time signals, entry/exit targets, risk score, priority support |
| VIP | $49.99/mo | Premium + copy-trade signals, portfolio tracking, 1-on-1 chat |

## Common Pitfalls

1. **CoinGecko rate limits** — 50 calls/min on free tier. Cache prices for 60s, batch requests
2. **Signal quality** — basic RSI/volume screens produce noise. Layer on additional filters (MACD, order book depth)
3. **Stripe webhook delivery** — use retries + idempotency keys. Stripe retries up to 3 times with exponential backoff
4. **Telegram rate limits** — 30 messages/sec per bot. Use queue for bulk sends
5. **User gating** — verify subscription status on EVERY premium request, not just on signup
6. **CTA format** — use `t.me/BotName?start=pay` deep links, never long Stripe URLs or bot @mentions

## Recovery Context

This skill was rebuilt from scratch after accidental bulk deletion. See `craigslist-ai-flipper` skill's `references/recovery-notes.md` for the full lesson on destructive batch operations.

## Verification

- [ ] Free signal generates and posts correctly
- [ ] Premium channel shows "subscribe" prompt to non-subscribers
- [ ] Stripe checkout → webhook → premium access granted
- [ ] Subscription expiry → premium access revoked
- [ ] Referral tracking works
- [ ] All links use Telegram deep link format
