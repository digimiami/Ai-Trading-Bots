#!/bin/bash
# Test script for subscription renewal endpoint
# Run this on your VPS to verify the endpoint works

SUPABASE_URL="https://dkawxgwdqiirgmmjbvhc.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U"
CRON_SECRET="22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc"

echo "🧪 Testing Subscription Renewal Endpoint..."
echo ""

response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/subscription-renewal" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}')

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

echo "Response Code: $http_code"
echo "Response Body:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" = "200" ]; then
  echo "✅ Endpoint is working correctly!"
elif [ "$http_code" = "401" ]; then
  echo "❌ Unauthorized - Check SUBSCRIPTION_RENEWAL_SECRET in Supabase"
  echo "   Make sure the secret value matches: ${CRON_SECRET}"
elif [ "$http_code" = "500" ]; then
  echo "⚠️  Server error - Check Edge Function logs in Supabase Dashboard"
else
  echo "⚠️  Unexpected response code: $http_code"
fi

