#!/bin/bash

# Deployment Script: Testnet Removal Update
# This script deploys the updated functions after testnet removal

set -e  # Exit on error

echo "🚀 Starting deployment of testnet removal update..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Deploy bot-executor function
echo -e "${YELLOW}📦 Deploying bot-executor function...${NC}"
if supabase functions deploy bot-executor; then
    echo -e "${GREEN}✅ bot-executor deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy bot-executor${NC}"
    exit 1
fi
echo ""

# Deploy api-keys function
echo -e "${YELLOW}📦 Deploying api-keys function...${NC}"
if supabase functions deploy api-keys; then
    echo -e "${GREEN}✅ api-keys deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy api-keys${NC}"
    exit 1
fi
echo ""

# Optional: Run SQL scripts (uncomment if you want to run them automatically)
# echo -e "${YELLOW}📝 Running SQL fix scripts...${NC}"
# if supabase db execute --file fix_bots_not_trading.sql; then
#     echo -e "${GREEN}✅ SQL scripts executed successfully${NC}"
# else
#     echo -e "${YELLOW}⚠️  SQL script execution failed or skipped${NC}"
#     echo "You can run it manually in Supabase SQL Editor"
# fi
# echo ""

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run fix_bots_not_trading.sql in Supabase SQL Editor"
echo "2. Verify function logs: supabase functions logs bot-executor"
echo "3. Test API key management in Settings page"
echo "4. Check bot execution logs for any errors"

