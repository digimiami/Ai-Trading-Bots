#!/bin/bash

# Check Active Bots Script
# Shows all running bots with their settings and recent activity

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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🔍 Active Bots Checker"
echo "=========================================="
echo ""

# Check if psql is available (for direct database access)
if command -v psql &> /dev/null; then
    echo "📊 Method: Direct database query (psql)"
    echo ""
    
    # Try to read database connection from .env or ask user
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        DB_URL=$(grep "DATABASE_URL" "${PROJECT_ROOT}/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
        if [ -n "$DB_URL" ]; then
            echo "✅ Found database connection"
            echo ""
            
            psql "$DB_URL" -c "
SELECT 
    id,
    name,
    status,
    exchange,
    symbol,
    trading_type,
    created_at,
    updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY created_at DESC;
" 2>/dev/null || echo "⚠️  Could not connect to database"
        fi
    else
        echo "⚠️  No .env file found for database connection"
    fi
else
    echo "📊 Method: Supabase API"
    echo ""
    
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        echo "❌ Error: SUPABASE_ANON_KEY not found in .env.cron"
        echo "   Please add it to: $CONFIG_FILE"
        exit 1
    fi
    
    # Use Supabase REST API to query bots
    echo "Fetching active bots from Supabase..."
    echo ""
    
    RESPONSE=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/trading_bots?status=eq.running&order=created_at.desc" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json")
    
    if [ $? -eq 0 ]; then
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    else
        echo "❌ Failed to fetch bots from Supabase"
    fi
fi

echo ""
echo "=========================================="
echo "✅ Check complete"
echo "=========================================="

