# AI Assistant "backtest is not defined" Error - Summary

## Problem
The AI assistant is returning a 500 error with "backtest is not defined" when users ask questions, even simple ones like "btcusdt".

## Error Type
JavaScript `ReferenceError` - code is trying to access a variable `backtest` that doesn't exist.

## Fixes Applied

### 1. Early Detection Workaround ✅
- Detects backtesting-related questions before calling AI API
- Returns direct helpful response
- Handles typos like "basktest"
- Excludes trading pairs like "btcusdt" from triggering

### 2. Enhanced System Instructions ✅
- Explicitly tells AI not to generate code
- Lists available functions
- Warns against calling non-existent backtest function
- Multiple layers of instructions

### 3. Function Call Error Handling ✅
- Catches unknown function calls
- Handles backtest function attempts gracefully
- Provides guidance when backtest function is called

### 4. Comprehensive Error Handling ✅
- Catches ReferenceErrors specifically
- Sanitizes error messages
- Provides user-friendly error messages
- Detailed logging for debugging

### 5. Improved Error Logging ✅
- Logs error name, message, and stack
- Logs function execution details
- Logs AI API call details
- Helps identify where error occurs

## Current Status
Error still occurs even after deployment. This suggests:
1. The error is happening in a place we haven't caught yet
2. The error is in the AI API response processing
3. The error is in template literal evaluation
4. The error is in the knowledge base content

## Next Steps - Check Supabase Logs

1. **Go to Supabase Dashboard**:
   - Navigate to: Edge Functions → ai-assistant → Logs

2. **Look for**:
   - Error messages containing "backtest is not defined"
   - The full stack trace
   - The exact line number where error occurs
   - The user's message that triggered it
   - Any ReferenceError entries

3. **Key Information to Find**:
   - Where exactly the error occurs (which function/line)
   - What the full error message is
   - What the stack trace shows
   - Whether it's in function execution, AI response processing, or elsewhere

## Possible Root Causes

1. **AI Generating Code**: AI might be generating JavaScript code in responses that references `backtest`
2. **Template Literal Issue**: Template literals might be evaluated incorrectly
3. **Knowledge Base Content**: Knowledge base might contain code-like syntax
4. **Function Call Processing**: Error might occur when processing function calls
5. **AI Response Parsing**: Error might occur when parsing AI API response

## Temporary Solution
The early detection workaround should catch most backtesting questions and return helpful responses without calling the AI API. However, the error still occurs for other messages.

## To Permanently Fix
We need to identify the exact location where "backtest is not defined" error occurs by checking Supabase function logs.

