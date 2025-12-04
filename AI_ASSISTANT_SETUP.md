# AI Assistant Feature Setup Guide

## Overview

The AI Assistant is a comprehensive chat interface that helps users understand bot settings, trading strategies, risk management, and platform features. It uses OpenAI or DeepSeek API to provide intelligent, context-aware responses.

## Features

- **Comprehensive Knowledge Base**: Understands all bot settings, trading strategies, and platform features
- **Interactive Chat Interface**: Real-time conversation with the AI assistant
- **Context-Aware Responses**: Maintains conversation history for better context
- **Multiple AI Providers**: Supports both OpenAI and DeepSeek APIs
- **User-Friendly**: Clear, formatted responses with examples

## Setup Instructions

### Step 1: Deploy Edge Function

1. Navigate to your Supabase project dashboard
2. Go to **Edge Functions** → **Create a new function**
3. Name it: `ai-assistant`
4. Copy the contents of `supabase/functions/ai-assistant/index.ts`
5. Deploy the function

### Step 2: Configure API Keys (Option 1: Edge Function Secrets - Recommended)

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add one or both of the following secrets:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
   
   OR
   
   - **Name**: `DEEPSEEK_API_KEY`
   - **Value**: Your DeepSeek API key (starts with `sk-...`)

**Note**: If both are set, DeepSeek will be preferred. Users can override this in Settings.

### Step 3: Configure API Keys (Option 2: User Settings - Alternative)

Users can also configure their own API keys in the Settings page:

1. Go to **Settings** → **AI API Configuration**
2. Enter your OpenAI or DeepSeek API key
3. The AI Assistant will use these keys if Edge Function secrets are not available

**Priority Order**:
1. User-provided API keys (from Settings)
2. Edge Function secrets (OPENAI_API_KEY or DEEPSEEK_API_KEY)

### Step 4: Access the AI Assistant

1. Navigate to **AI Assistant** from the main navigation menu
2. Start asking questions about:
   - Bot configuration settings
   - Trading strategies (RSI, ADX, Bollinger Bands, etc.)
   - Risk management parameters
   - Platform features
   - General trading questions

## Knowledge Base Coverage

The AI Assistant has comprehensive knowledge about:

### Bot Settings
- Basic settings (name, exchange, symbol, leverage, etc.)
- Strategy settings (RSI, ADX, Bollinger Bands, EMA, ATR, VWAP, Momentum)
- Advanced configuration (directional bias, regime filters, risk management, etc.)

### Trading Concepts
- Risk management principles
- Technical indicators explained
- Trading strategies (trend following, mean reversion, breakout, scalping, swing trading)
- Common mistakes to avoid

### Platform Features
- Bot management
- Trade management
- Settings & configuration
- Analytics & reporting

### Best Practices
- Starting with paper trading
- Conservative settings
- Risk management
- Diversification

## Usage Examples

### Example Questions:

1. **Bot Settings**:
   - "What does RSI threshold do?"
   - "How should I set my stop loss?"
   - "What's the difference between bias_mode 'auto' and 'long-only'?"

2. **Trading Strategies**:
   - "Explain how ADX works"
   - "What is a good R:R ratio for take profit?"
   - "How do I configure a trend-following strategy?"

3. **Risk Management**:
   - "What's a safe leverage for beginners?"
   - "How do I calculate position size?"
   - "What should my daily loss limit be?"

4. **Platform Features**:
   - "How do I create a bot?"
   - "What is paper trading?"
   - "How do I clone a bot?"

## Technical Details

### Frontend Component
- **Location**: `src/pages/ai-assistant/page.tsx`
- **Features**:
  - Real-time chat interface
  - Message history
  - Loading states
  - Error handling
  - API configuration check

### Edge Function
- **Location**: `supabase/functions/ai-assistant/index.ts`
- **Features**:
  - User authentication
  - API key management (user-provided or environment secrets)
  - Comprehensive knowledge base prompt
  - Conversation history support
  - OpenAI/DeepSeek API integration

### Knowledge Base
The knowledge base is built into the Edge Function's system prompt and includes:
- All bot configuration settings with explanations
- Trading concepts and strategies
- Platform features
- Best practices
- Common mistakes

## Troubleshooting

### "AI API key not configured" Error

**Solution**: 
1. Check that you've set `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` in Edge Function secrets, OR
2. Configure your API key in Settings → AI API Configuration

### "Unauthorized" Error

**Solution**: Make sure you're logged in to the platform

### Slow Responses

**Possible Causes**:
- Large conversation history (limited to last 10 messages)
- API rate limits
- Network latency

**Solution**: Clear chat history if it becomes too long

### API Rate Limits

If you hit rate limits:
- Use DeepSeek (often has higher rate limits)
- Reduce conversation frequency
- Consider upgrading your API plan

## Security Notes

- API keys are stored securely:
  - Edge Function secrets (server-side only)
  - User localStorage (client-side, for user's own keys)
- User authentication is required for all requests
- API keys are never exposed in responses or logs

## Future Enhancements

Potential improvements:
- Chat history persistence in database
- Favorite/bookmarked responses
- Quick action buttons (e.g., "Create bot with these settings")
- Integration with bot creation form
- Voice input/output
- Multi-language support

## Support

For issues or questions:
1. Check this documentation
2. Review the AI Assistant's responses (it knows about the platform!)
3. Contact support through the Contact page

