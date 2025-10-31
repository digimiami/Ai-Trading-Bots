#!/bin/bash

# Show Bot Status Script
# Quick status overview of all active bots

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/.env.cron"

# Load configuration if .env.cron exists
if [ -f "$CONFIG_FILE" ]; then
    TEMP_CONFIG=$(mktemp)
    sed 's/\r$//' "$CONFIG_FILE" | grep -v '^#' | grep -v '^$' > "$TEMP_CONFIG"
    set -a
    source "$TEMP_CONFIG"
    set +a
    rm -f "$TEMP_CONFIG"
fi

# Default values
SUPABASE_URL="${SUPABASE_URL:-https://dkawxgwdqiirgmmjbvhc.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo "${CYAN}║         🤖 Active Bots Status Overview                  ║${NC}"
echo "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "${RED}❌ Error: SUPABASE_ANON_KEY not found${NC}"
    echo "   Please add it to: $CONFIG_FILE"
    exit 1
fi

# Fetch active bots
echo "${BLUE}📡 Fetching bot data from Supabase...${NC}"
echo ""

BOTS=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/trading_bots?status=eq.running&order=created_at.desc" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json")

if [ $? -ne 0 ] || [ -z "$BOTS" ] || [ "$BOTS" = "[]" ]; then
    echo "${YELLOW}⚠️  No active bots found${NC}"
    exit 0
fi

# Count bots
BOT_COUNT=$(echo "$BOTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$BOT_COUNT" = "0" ]; then
    echo "${YELLOW}⚠️  No active bots found${NC}"
    exit 0
fi

echo "${GREEN}✅ Found ${BOT_COUNT} active bot(s)${NC}"
echo ""

# Parse and display each bot
echo "$BOTS" | python3 << 'PYTHON_SCRIPT'
import json
import sys
from datetime import datetime

try:
    bots = json.load(sys.stdin)
    
    for i, bot in enumerate(bots, 1):
        print(f"\n{'='*60}")
        print(f"🤖 Bot #{i}: {bot.get('name', 'N/A')}")
        print(f"{'='*60}")
        
        # Basic Info
        print(f"  ID:      {bot.get('id', 'N/A')}")
        print(f"  Status:  {bot.get('status', 'N/A')}")
        print(f"  Exchange: {bot.get('exchange', 'N/A')}")
        print(f"  Symbol:  {bot.get('symbol', 'N/A')}")
        print(f"  Type:    {bot.get('trading_type', bot.get('tradingType', 'N/A'))}")
        
        # Trading Settings
        print(f"\n  💰 Trading Settings:")
        print(f"    Base Amount: ${bot.get('base_amount', bot.get('baseAmount', 'N/A'))}")
        print(f"    Leverage:    {bot.get('leverage', 'N/A')}x")
        print(f"    Risk Level:  {bot.get('risk_level', bot.get('riskLevel', 'N/A'))}")
        
        # Strategy (if available)
        strategy = bot.get('strategy')
        if strategy:
            if isinstance(strategy, str):
                try:
                    strategy = json.loads(strategy)
                except:
                    pass
            
            if isinstance(strategy, dict):
                print(f"\n  📊 Strategy:")
                rsi = strategy.get('rsiThreshold')
                adx = strategy.get('adxThreshold')
                if rsi:
                    print(f"    RSI Threshold: {rsi}")
                if adx:
                    print(f"    ADX Threshold: {adx}")
        
        # Advanced Config
        config = bot.get('strategy_config')
        if config:
            if isinstance(config, str):
                try:
                    config = json.loads(config)
                except:
                    pass
            
            if isinstance(config, dict):
                print(f"\n  ⚙️  Safety Settings:")
                max_losses = config.get('max_consecutive_losses')
                max_trades = config.get('max_trades_per_day')
                max_positions = config.get('max_concurrent')
                if max_losses:
                    print(f"    Max Consecutive Losses: {max_losses}")
                if max_trades:
                    print(f"    Max Trades/Day: {max_trades}")
                if max_positions:
                    print(f"    Max Positions: {max_positions}")
        
        # Timestamps
        created = bot.get('created_at')
        updated = bot.get('updated_at')
        last_exec = bot.get('last_execution_at')
        
        if created:
            print(f"\n  📅 Created: {created}")
        if updated:
            print(f"  🔄 Updated: {updated}")
        if last_exec:
            print(f"  ⏰ Last Execution: {last_exec}")
        else:
            print(f"  ⏰ Last Execution: Never")
        
except Exception as e:
    print(f"Error parsing bot data: {e}")
    print("\nRaw response:")
    print(json.dumps(json.load(sys.stdin), indent=2))
PYTHON_SCRIPT

echo ""
echo "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo "${CYAN}║         ✅ Status Check Complete                         ║${NC}"
echo "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "${BLUE}💡 Tip: Run 'bash scripts/check-active-bots.sh' for more details${NC}"
echo ""

