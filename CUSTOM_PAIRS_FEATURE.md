# Custom Trading Pairs Feature

## Overview
Added the ability to create bots with custom or manual trading pairs instead of being limited to a dropdown selection.

## What's New

### Frontend Changes (`src/pages/create-bot/page.tsx`)
1. **New State Fields:**
   - `customPairs`: string - Stores user-entered trading pairs
   - `useCustomPairs`: boolean - Toggles between dropdown and custom input

2. **UI Updates:**
   - Radio buttons to choose between "popular pairs" and "custom pairs"
   - Textarea for entering multiple trading pairs
   - Pairs can be entered separated by commas or new lines
   - Input is automatically converted to uppercase

3. **Validation:**
   - Validates that at least one pair is entered when custom mode is enabled
   - Trims whitespace and filters out empty entries

### Backend Changes (`supabase/functions/bot-management/index.ts`)
1. **New Fields Handled:**
   - `symbols`: array - Array of trading pairs
   - `customPairs`: string - Raw user input for reference
   - `finalSymbol`: string - Main symbol (first in the array)

2. **Logic:**
   - Supports both single symbol (dropdown) and multiple symbols (custom)
   - Stores symbols as JSON array in database
   - Maintains backward compatibility with existing bots

### Database Changes (`add_custom_pairs_columns.sql`)
1. **New Columns:**
   - `symbols`: JSONB - Stores array of trading pairs
   - `custom_pairs`: TEXT - Stores raw user input

## How to Use

### Option 1: Use Popular Pairs (Default)
1. Keep "Select from popular pairs" radio button selected
2. Choose from the dropdown (BTCUSDT, ETHUSDT, etc.)
3. Bot will trade only that pair

### Option 2: Use Custom Pairs
1. Select "Use custom pairs" radio button
2. Enter trading pairs in the textarea
3. Format options:
   - Comma-separated: `BTCUSDT, ETHUSDT, SOLUSDT`
   - New line-separated: 
     ```
     BTCUSDT
     ETHUSDT
     SOLUSDT
     ```
4. The bot will trade all entered pairs

## Example
```
BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT
```

Or:

```
BTCUSDT
ETHUSDT  
SOLUSDT
ADAUSDT
```

## Database Migration

Run this SQL in Supabase SQL Editor:

```sql
-- Add custom pairs and symbols columns to trading_bots table
ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS symbols JSONB;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS custom_pairs TEXT;

-- Set default for symbols if it doesn't exist
UPDATE public.trading_bots 
SET symbols = jsonb_build_array(symbol) 
WHERE symbols IS NULL;
```

## Benefits

1. **Flexibility**: Trade any pair, not just pre-selected ones
2. **Multi-Pair Bots**: Create bots that trade multiple pairs simultaneously
3. **Custom Strategies**: Implement pair-specific trading strategies
4. **Backward Compatible**: Existing bots continue to work

## Technical Details

- Symbols are stored as JSONB array in database
- Frontend parses input by splitting on newlines or commas
- Automatic uppercase conversion for consistency
- Whitespace trimming and validation
- Error handling for empty or invalid input

## Future Enhancements

- Pair validation against exchange API
- Volume and liquidity filtering
- Automatic pair suggestions based on volatility
- Save custom pair lists for reuse
- Import pairs from CSV file

