# Deploy AI Assistant Backtesting Fix

The AI assistant has been updated to fix the "backtest is not defined" error. You need to redeploy the edge function for the changes to take effect.

## Quick Deploy

```bash
# Navigate to your project directory
cd "path/to/your/project"

# Deploy the ai-assistant function
supabase functions deploy ai-assistant
```

## What Was Fixed

1. **Added explicit prohibition against code generation**: The AI will no longer generate executable JavaScript code or code blocks
2. **Clarified backtesting guidance**: The AI now only provides text-based guidance, not executable code
3. **Enhanced error prevention**: Added multiple layers of instructions to prevent the AI from referencing undefined variables

## After Deployment

Once deployed, when users ask about backtesting:
- ✅ The AI will provide helpful text guidance
- ✅ The AI will explain how to navigate to `/backtest`
- ✅ The AI will NOT generate executable code
- ✅ The AI will NOT reference undefined variables like `backtest`

## Testing

After deployment, test by asking the AI assistant:
- "Use backtesting to find best performance pairs for my trading strategy"
- "How do I backtest my trading strategy?"
- "What pairs should I backtest?"

The AI should respond with helpful guidance without any errors.

## If Issues Persist

1. Check Supabase function logs: `supabase functions logs ai-assistant`
2. Verify the deployment: Check that the latest code is deployed
3. Clear browser cache and try again
4. Check that your OpenAI/DeepSeek API key is configured correctly

