# PowerShell script to set OpenAI API Key in Supabase
# Usage: .\setup-openai-key.ps1

Write-Host "Setting up OpenAI API Key in Supabase..." -ForegroundColor Cyan

# Your OpenAI API Key
$OPENAI_API_KEY = "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"

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
} catch {
    Write-Host "Error: Supabase CLI is not installed." -ForegroundColor Red
    Write-Host "Install it from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Set the secret
Write-Host "Setting OPENAI_API_KEY secret..." -ForegroundColor Yellow
supabase secrets set "OPENAI_API_KEY=$OPENAI_API_KEY"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully set OPENAI_API_KEY in Supabase!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Deploy your edge functions:"
    Write-Host "   supabase functions deploy summarize-pdf"
    Write-Host "   supabase functions deploy summarize-video"
    Write-Host "   supabase functions deploy transcribe-video"
    Write-Host "   supabase functions deploy answer-question"
    Write-Host ""
    Write-Host "2. Test your application by uploading a PDF or video file" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to set OPENAI_API_KEY" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Set it manually in Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "1. Go to your Supabase project"
    Write-Host "2. Navigate to Settings → Edge Functions → Secrets"
    Write-Host "3. Add OPENAI_API_KEY with your API key value"
    exit 1
}

