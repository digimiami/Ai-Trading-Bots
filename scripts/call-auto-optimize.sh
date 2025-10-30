#!/bin/bash

# Auto-Optimize Cron Job Script
# This script calls the auto-optimize Edge Function to optimize all active bots with AI/ML enabled
# Run this via cron daily or weekly: 0 2 * * * /path/to/scripts/call-auto-optimize.sh

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/.env.cron"

# Load configuration if .env.cron exists (skip comments and empty lines, fix line endings)
if [ -f "$CONFIG_FILE" ]; then
    # Create a temporary file with cleaned content
    TEMP_CONFIG=$(mktemp)
    # Remove Windows line endings, comments, and empty lines
    sed 's/\r$//' "$CONFIG_FILE" | grep -v '^#' | grep -v '^$' > "$TEMP_CONFIG"
    # Source the cleaned config
    set -a
    source "$TEMP_CONFIG"
    set +a
    rm -f "$TEMP_CONFIG"
fi

# Default values (override with .env.cron)
SUPABASE_URL="${SUPABASE_URL:-https://dkawxgwdqiirgmmjbvhc.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
LOG_DIR="${LOG_DIR:-/var/log/bot-scheduler}"
LOG_FILE="${LOG_DIR}/auto-optimize.log"
RESPONSE_LOG="${LOG_DIR}/auto-optimize-response.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Timestamp for logging
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Call the auto-optimize function
FULL_URL="${SUPABASE_URL}/functions/v1/auto-optimize"

# Build headers
HEADERS=(-H "Content-Type: application/json")

# Add Authorization header if ANON_KEY is provided
if [ -n "$SUPABASE_ANON_KEY" ]; then
    HEADERS+=(-H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
fi

# Make the request and capture response
RESPONSE=$(curl -X POST "$FULL_URL" \
    "${HEADERS[@]}" \
    -d '{"minConfidence": 0.7}' \
    -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
    -s 2>&1)

# Extract HTTP code and response time
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

# Log response to separate file
echo "[$TIMESTAMP] Response: $BODY" >> "$RESPONSE_LOG"
echo "[$TIMESTAMP] HTTP Code: $HTTP_CODE, Time: ${TIME_TOTAL}s" >> "$RESPONSE_LOG"

# Log to main log file
if [ "$HTTP_CODE" = "200" ]; then
    echo "[$TIMESTAMP] ✅ Auto-optimize called successfully (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    OPTIMIZED_COUNT=$(echo "$BODY" | grep -o '"optimized":[0-9]*' | cut -d: -f2 || echo "0")
    echo "[$TIMESTAMP] Optimized bots: $OPTIMIZED_COUNT" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ❌ Auto-optimize failed (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    echo "[$TIMESTAMP] Error: $BODY" >> "$LOG_FILE"
fi

# Exit with error if HTTP code is not 200
if [ "$HTTP_CODE" != "200" ]; then
    exit 1
fi

exit 0

