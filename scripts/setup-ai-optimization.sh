#!/bin/bash

# Setup AI Auto-Optimization for Pablo AI Trading
# This script sets up the database tables and deploys the auto-optimize function

echo "🚀 Setting up AI Auto-Optimization..."
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Source .env file
set -a
source .env
set +a

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo ""
    echo "⚠️  OPENAI_API_KEY not found in .env file"
    echo ""
    echo "To get an OpenAI API key:"
    echo "1. Go to https://platform.openai.com/api-keys"
    echo "2. Create an account or sign in"
    echo "3. Generate a new API key"
    echo "4. Add it to your .env file:"
    echo "   OPENAI_API_KEY=sk-your-actual-api-key-here"
    echo ""
    read -p "Press Enter to continue after adding the key to .env, or Ctrl+C to exit..."
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it:"
    echo "   npm install -g supabase"
    exit 1
fi

echo ""
echo "📋 Next steps:"
echo "1. Ensure database tables are created (run create_ai_learning_tables.sql in Supabase SQL Editor)"
echo "2. Add OPENAI_API_KEY to Supabase Edge Function secrets:"
echo "   supabase secrets set OPENAI_API_KEY=your-key-here"
echo "3. Deploy the auto-optimize function:"
echo "   supabase functions deploy auto-optimize"
echo "4. (Optional) Set up cron job to run auto-optimize periodically"
echo ""

read -p "Do you want to deploy the auto-optimize function now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Deploying auto-optimize function..."
    supabase functions deploy auto-optimize
    
    echo ""
    echo "🔐 Setting OpenAI API key as secret..."
    if [ -n "$OPENAI_API_KEY" ]; then
        supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
        echo "✅ OPENAI_API_KEY secret set"
    else
        echo "⚠️  Please set OPENAI_API_KEY manually:"
        echo "   supabase secrets set OPENAI_API_KEY=your-key-here"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Documentation:"
echo "- See AI_SELF_LEARNING_GUIDE.md for usage instructions"
echo "- See QUICK_START_AI.md for quick reference"
echo ""
echo "🧪 To test the function:"
echo "   curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \\"
echo "     -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"minConfidence\": 0.7}'"
echo ""

