# Debugging Backtest Error in AI Assistant

## Current Issue
The AI assistant is calling the `run_backtest` function, but the backtest engine is returning an error. The error message shown to users is generic and doesn't reveal the actual issue.

## What We've Fixed So Far

1. ✅ Added `run_backtest` function to AI assistant
2. ✅ Made function description mandatory and explicit
3. ✅ Auto-calculate dates (defaults to last 30 days)
4. ✅ Auto-generate name if not provided
5. ✅ Pass user auth token to backtest engine
6. ✅ Improved error handling and logging
7. ✅ Validate and clean symbols array

## Current Status
- Function is being called by AI ✅
- Function is executing ✅
- Backtest engine is returning an error ❌

## To Debug - Check Supabase Logs

### 1. Check AI Assistant Logs
Go to: Supabase Dashboard → Edge Functions → ai-assistant → Logs

Look for:
- `🔧 [executeRunBacktest] Starting backtest with params:`
- `❌ [executeRunBacktest] Backtest engine error:`
- The actual error message and status code
- The request data being sent

### 2. Check Backtest Engine Logs
Go to: Supabase Dashboard → Edge Functions → backtest-engine → Logs

Look for:
- Authentication errors
- Parameter validation errors
- Any errors during backtest execution

### 3. Common Issues to Check

#### Authentication (401 Error)
- User token might not be valid
- Token might not be passed correctly
- Check if token is extracted from request headers

#### Parameter Validation (400 Error)
- Missing required parameters
- Invalid date format
- Invalid symbols format
- Exchange not supported (only 'bybit' is supported)

#### Internal Server Error (500 Error)
- Backtest engine might have a bug
- Historical data might not be available
- API rate limits

## What to Look For in Logs

1. **Request Data**: Check what data is being sent to backtest engine
   ```json
   {
     "name": "...",
     "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
     "startDate": "2024-12-08T00:00:00.000Z",
     "endDate": "2025-01-07T00:00:00.000Z",
     ...
   }
   ```

2. **Error Response**: Check the actual error from backtest engine
   - Status code (401, 400, 500, etc.)
   - Error message
   - Error details

3. **Authentication**: Check if user token is being passed
   - Look for "User token provided: Yes/No" in logs
   - Check if token is valid

## Next Steps

1. **Check the logs** to see the actual error
2. **Share the error details** from Supabase logs
3. **Fix the specific issue** based on the error

## Possible Fixes Based on Error Type

### If 401 (Unauthorized):
- Ensure user token is being passed correctly
- Check if token is valid and not expired
- Verify token extraction from request headers

### If 400 (Bad Request):
- Check if all required parameters are present
- Verify date format (ISO 8601)
- Ensure symbols are in correct format
- Check if exchange is 'bybit' (only supported exchange)

### If 500 (Internal Server Error):
- Check backtest engine logs for specific error
- Verify historical data is available for the date range
- Check if there are any API rate limits

## Current Code Status

The function should:
- ✅ Auto-calculate dates (last 30 days)
- ✅ Auto-generate name
- ✅ Validate symbols
- ✅ Pass user auth token
- ✅ Handle errors gracefully

All code changes have been committed and pushed. The issue is likely in the backtest engine or the data being sent to it.

