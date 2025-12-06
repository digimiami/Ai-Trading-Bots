# Deployment Guide: Testnet Removal Update

This guide covers deploying the testnet removal changes to your Supabase project.

## Prerequisites

- Supabase CLI installed and authenticated
- Access to your Supabase project
- Git repository up to date

## Deployment Steps

### 1. Deploy Updated Edge Functions

Deploy the updated functions that have testnet functionality removed:

```bash
# Deploy bot-executor function
supabase functions deploy bot-executor

# Deploy api-keys function
supabase functions deploy api-keys
```

### 2. Run SQL Fix Scripts

Execute the fixed SQL scripts in Supabase SQL Editor to resolve the `tb.is_testnet` column error:

#### Option A: Using Supabase Dashboard
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix_bots_not_trading.sql`
4. Click **Run** to execute

#### Option B: Using Supabase CLI
```bash
# Run the fix script
supabase db execute --file fix_bots_not_trading.sql
```

### 3. Verify Deployment

#### Check Function Logs
```bash
# Check bot-executor logs
supabase functions logs bot-executor --limit 50

# Check api-keys logs
supabase functions logs api-keys --limit 50
```

#### Verify SQL Scripts
Run the diagnostic script to verify bots are working correctly:

```sql
-- In Supabase SQL Editor, run:
SELECT * FROM bot_health_status 
WHERE health_status != 'HEALTHY'
ORDER BY health_status, name;
```

### 4. Test API Key Management

1. Go to Settings page in your application
2. Verify that testnet toggle switches are removed
3. Try saving a new API key (should work without testnet option)
4. Test API connection (should use mainnet only)

### 5. Test Bot Execution

1. Check bot execution logs for any errors
2. Verify bots are using mainnet API endpoints only
3. Confirm no testnet-related errors in logs

## Rollback Instructions

If you need to rollback:

```bash
# Redeploy previous version (if you have version control)
git checkout <previous-commit-hash>
supabase functions deploy bot-executor
supabase functions deploy api-keys
```

## Changes Summary

### Functions Updated
- ✅ `bot-executor`: Removed all testnet parameters, always uses mainnet
- ✅ `api-keys`: Removed testnet from API key management

### SQL Scripts Fixed
- ✅ `diagnose_bots_not_trading.sql`: Removed `tb.is_testnet` references
- ✅ `fix_bots_not_trading.sql`: Fixed API key join conditions

### Frontend Updated
- ✅ Settings page: Removed testnet toggles
- ✅ API key forms: Removed testnet options
- ✅ Types: Removed testnet from interfaces

## Post-Deployment Checklist

- [ ] Functions deployed successfully
- [ ] SQL scripts executed without errors
- [ ] Bot health status view created
- [ ] API key management works without testnet
- [ ] Bot execution uses mainnet only
- [ ] No testnet-related errors in logs
- [ ] Frontend builds and runs correctly

## Troubleshooting

### If functions fail to deploy:
```bash
# Check Supabase CLI version
supabase --version

# Update if needed
npm install -g supabase

# Re-authenticate
supabase login
```

### If SQL scripts fail:
- Ensure you're running them in the correct database
- Check that all tables exist (`trading_bots`, `api_keys`, `users`, etc.)
- Verify you have proper permissions

### If bots still show testnet errors:
- Clear browser cache
- Rebuild frontend: `npm run build`
- Check function logs for specific errors

## Support

If you encounter issues:
1. Check function logs in Supabase Dashboard
2. Review SQL script errors in SQL Editor
3. Verify all prerequisites are met
4. Check that database schema is up to date

