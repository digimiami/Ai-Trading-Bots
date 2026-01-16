#!/bin/bash

# ML Auto-Retrain Cron Job Script
# This script calls the ml-auto-retrain Edge Function to check and retrain ML models
# Run this via cron daily: 0 2 * * * /path/to/scripts/call-ml-auto-retrain.sh

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
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_DIR="${LOG_DIR:-/var/log/bot-scheduler}"
LOG_FILE="${LOG_DIR}/ml-auto-retrain.log"
RESPONSE_LOG="${LOG_DIR}/ml-auto-retrain-response.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Timestamp for logging
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check if required variables are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "[$TIMESTAMP] ❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set" >> "$LOG_FILE"
    exit 1
fi

if [ -z "$CRON_SECRET" ]; then
    echo "[$TIMESTAMP] ❌ ERROR: CRON_SECRET not set" >> "$LOG_FILE"
    exit 1
fi

# Call the ml-auto-retrain function
FULL_URL="${SUPABASE_URL}/functions/v1/ml-auto-retrain"

# Build headers
HEADERS=(-H "Content-Type: application/json")
HEADERS+=(-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
HEADERS+=(-H "x-cron-secret: ${CRON_SECRET}")

# Make the request and capture response
RESPONSE=$(curl -X POST "$FULL_URL" \
    "${HEADERS[@]}" \
    -d '{}' \
    -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
    -s 2>&1)

# Extract HTTP code and response time
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

# Log response
echo "[$TIMESTAMP] Response (HTTP $HTTP_CODE, ${TIME_TOTAL}s):" >> "$RESPONSE_LOG"
echo "$BODY" >> "$RESPONSE_LOG"
echo "---" >> "$RESPONSE_LOG"

# Log to main log file
if [ "$HTTP_CODE" = "200" ]; then
    echo "[$TIMESTAMP] ✅ ML Auto-Retrain completed successfully (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    
    # Try to extract summary from JSON response
    if command -v jq &> /dev/null; then
        CHECKED=$(echo "$BODY" | jq -r '.checked // "N/A"')
        RETRAINED=$(echo "$BODY" | jq -r '.retrained // "N/A"')
        echo "[$TIMESTAMP]    Checked: $CHECKED bots, Retrained: $RETRAINED" >> "$LOG_FILE"
    fi
else
    echo "[$TIMESTAMP] ❌ ML Auto-Retrain failed (HTTP $HTTP_CODE, ${TIME_TOTAL}s)" >> "$LOG_FILE"
    echo "[$TIMESTAMP]    Response: $BODY" >> "$LOG_FILE"
    exit 1
fi

exit 0
