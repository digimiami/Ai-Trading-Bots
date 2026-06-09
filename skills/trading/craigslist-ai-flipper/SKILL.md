---
name: craigslist-ai-flipper
description: "Scans Craigslist listings, scores flip potential (profit margin, demand signals), and alerts via Telegram — all cron-driven, zero manual intervention."
version: 1.0.0
license: MIT
metadata:
  hermes:
    tags: [trading, flipping, scraper, telegram]
---

# Craigslist AI Flipper

## Overview

An autonomous bot that:
1. Scrapes Craigslist listings in target categories (electronics, furniture, cars, etc.)
2. Scores each listing for flip potential — profit margin, demand signals, market comparables
3. Sends high-score alerts to Telegram
4. Runs on cron — fully autonomous

## When to Use

- User asks for a CL flipping bot / scanner
- You're building an arbitrage/scalping system for physical goods
- Need to automate deal-finding on classifieds

## Architecture

```
CL Scraper (Python/requests + BeautifulSoup) 
  → Scoring Engine (margin calc, demand signals)
    → Telegram Alert (telegram_service or simple HTTP API)
      → Runs on cron every N hours
```

## Key Components

### 1. Scraper Setup

```python
# core scraper using requests + BeautifulSoup
import requests
from bs4 import BeautifulSoup
import re

def search_craigslist(city="miami", query="iphone", category="sss"):
    """Search CL for potential flips. sss=electronics"""
    url = f"https://{city}.craigslist.org/search/{category}?query={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    soup = BeautifulSoup(resp.text, "html.parser")
    # extract listings
    ...
```

### 2. Scoring Engine

Score listings on:
- **Price gap**: listing price vs recent sold comps (eBay sold, FB Marketplace)
- **Demand signal**: search volume, keyword freshness
- **Time factor**: listing age — newer = better
- **Category multiplier**: electronics > furniture > general
- **Seller signals**: no photo = risky, detailed desc = legit

```python
def score_listing(listing):
    score = 50  # base
    # price comp logic
    if listing["price"] < comp_avg * 0.7:
        score += 30
    if listing["has_photos"]:
        score += 10
    if listing["age_hours"] < 24:
        score += 10
    return min(score, 100)
```

### 3. Telegram Alert

Send high-scoring listings via Telegram:

```python
import requests

def send_alert(listing, score):
    text = f"💰 **{listing['title']}** — Score: {score}/100\n"
    text += f"Price: ${listing['price']}\n"
    text += f"Est Flip: ${listing['flip_profit']}\n"
    text += f"{listing['url']}"
    
    requests.post(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}
    )
```

### 4. Cron Job

```bash
# Run every 6 hours
hermes cron create \
  --schedule "0 */6 * * *" \
  --prompt "Run craigslist flipper: search miami for iphone, macbook, ps5. Score. Alert TG if score > 70." \
  --skills craigslist-ai-flipper
```

## Common Pitfalls

1. **CL blocks aggressive scrapers** — add delays between requests (3-5s), rotate user-agents
2. **Price parsing fails** — CL uses inconsistent formatting ($1,234 vs $1234 vs OBO). Use regex, strip non-numeric
3. **False positives** — listings that are too good to be true (scams). Add flag for "no photo", "no phone", "too new account"
4. **Geography matters** — local market comps vary wildly. Keep city-specific pricing data
5. **Rate limits** — CL has soft rate limits. Use proxies if scraping >100 listings at once

## Verification

- [ ] Scraper returns listings for at least 3 cities
- [ ] Scoring produces 0-100 range
- [ ] Telegram alert fires with clickable link
- [ ] Cron job runs autonomously
- [ ] No duplicate alerts for same listing
