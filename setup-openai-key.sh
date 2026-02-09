#!/bin/bash

# Script to set OpenAI API Key in Supabase
# Usage: ./setup-openai-key.sh

echo "Setting up OpenAI API Key in Supabase..."

# Your OpenAI API Key
OPENAI_API_KEY="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"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed."
    echo "Install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Set the secret
echo "Setting OPENAI_API_KEY secret..."
supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"

if [ $? -eq 0 ]; then
    echo "✅ Successfully set OPENAI_API_KEY in Supabase!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy your edge functions:"
    echo "   supabase functions deploy summarize-pdf"
    echo "   supabase functions deploy summarize-video"
    echo "   supabase functions deploy transcribe-video"
    echo "   supabase functions deploy answer-question"
    echo ""
    echo "2. Test your application by uploading a PDF or video file"
else
    echo "❌ Failed to set OPENAI_API_KEY"
    echo ""
    echo "Alternative: Set it manually in Supabase Dashboard:"
    echo "1. Go to your Supabase project"
    echo "2. Navigate to Settings → Edge Functions → Secrets"
    echo "3. Add OPENAI_API_KEY with your API key value"
    exit 1
fi

