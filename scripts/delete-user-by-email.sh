#!/bin/bash
# ============================================
# Delete User by Email
# Usage: ./delete-user-by-email.sh <email>
# Example: ./delete-user-by-email.sh alex.johnson@email.com
# ============================================

EMAIL="${1:-alex.johnson@email.com}"

if [ -z "$EMAIL" ]; then
    echo "❌ Error: Email address is required"
    echo "Usage: $0 <email>"
    exit 1
fi

echo "🔍 Finding user: $EMAIL..."

# Get Supabase URL and Service Role Key from environment or .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    echo "Set them in .env file or as environment variables"
    exit 1
fi

# Find user ID
USER_ID=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"user_email\": \"${EMAIL}\"}" | jq -r '.id // empty')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    # Try direct query
    USER_ID=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/users?email=eq.${EMAIL}&select=id" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" | jq -r '.[0].id // empty')
fi

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    echo "❌ User not found: $EMAIL"
    exit 1
fi

echo "✅ Found user ID: $USER_ID"
echo "🗑️  Deleting user..."

# Call admin Edge Function to delete user
RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/admin-management-enhanced" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"action\": \"deleteUser\", \"userId\": \"${USER_ID}\"}")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
    echo "✅ User deleted successfully!"
    echo "$RESPONSE" | jq '.'
else
    echo "❌ Failed to delete user:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi



