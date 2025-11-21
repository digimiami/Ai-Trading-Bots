#!/bin/bash

# Bot Scheduler Cron Job Script
# This script calls the bot-scheduler Edge Function to execute all running bots
# Run this via cron every 5 minutes: */5 * * * * /path/to/scripts/call-bot-scheduler.sh

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
CRON_SECRET="${CRON_SECRET:-c3f0b1a2d4e59687a9b0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f78a}"
LOG_DIR="${LOG_DIR:-/var/log/bot-scheduler}"
LOG_FILE="${LOG_DIR}/bot-scheduler.log"
RESPONSE_LOG="${LOG_DIR}/response.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Timestamp for logging
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Call the bot-scheduler function
FULL_URL="${SUPABASE_URL}/functions/v1/bot-scheduler"

# Build headers
HEADERS=(-H "x-cron-secret: ${CRON_SECRET}" -H "Content-Type: application/json")

# Add apikey header if ANON_KEY is provided (for Supabase edge runtime access)
if [ -n "$SUPABASE_ANON_KEY" ]; then
    HEADERS+=(-H "apikey: ${SUPABASE_ANON_KEY}")
fi

# Make the request and capture response
RESPONSE=$(curl -X POST "$FULL_URL" \
    "${HEADERS[@]}" \
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
    echo "[$TIMESTAMP] ✅ Bot scheduler called successfully (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    echo "$BODY" | grep -o '"botsExecuted":[0-9]*' >> "$LOG_FILE" || true
else
    echo "[$TIMESTAMP] ❌ Bot scheduler failed (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    echo "[$TIMESTAMP] Error: $BODY" >> "$LOG_FILE"
fi

# Exit with error if HTTP code is not 200
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Error: HTTP $HTTP_CODE - $BODY" >&2
    exit 1
fi

# Show success message when run manually
echo "✅ Bot scheduler called successfully"
echo "📊 Response: $BODY"
echo "⏱️  Time: ${TIME_TOTAL}s"
echo "📝 Full logs: $LOG_FILE"

exit 0

