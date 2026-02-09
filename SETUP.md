# Setup Instructions

## OpenAI API Key Configuration

To use this application, you need to set up your OpenAI API key in Supabase.

### Steps to Configure OPENAI_API_KEY:

1. **Go to your Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard

2. **Open Project Settings**
   - Click on your project
   - Go to "Settings" → "Edge Functions"

3. **Set Environment Variable**
   - Click on "Secrets" or "Environment Variables"
   - Add a new secret with:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: `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`

4. **Deploy Edge Functions**
   - Make sure all edge functions are deployed:
     - `summarize-pdf`
     - `summarize-video`
     - `transcribe-video`
     - `answer-question`

5. **Test the Application**
   - Upload a PDF file to test PDF summarization
   - Upload a video file to test video summarization
   - Enter a YouTube URL (must have captions) to test YouTube video summarization

## Features

### PDF Summarization
- Upload PDF files (up to 20MB)
- Automatic text extraction from PDFs
- AI-powered summarization using OpenAI GPT-4
- Interactive Q&A based on PDF content

### Video Summarization
- Upload video files (MP4, WebM, OGG, MOV, AVI)
- Automatic transcription using OpenAI Whisper API
- AI-powered summarization using OpenAI GPT-4
- Timestamp-based summaries

### YouTube Video Summarization
- Enter YouTube video URLs
- Automatic transcript extraction (if available)
- AI-powered summarization
- Note: Videos without captions require audio extraction service

## Troubleshooting

### "OPENAI_API_KEY not configured" Error
- Make sure you've set the environment variable in Supabase
- Redeploy your edge functions after setting the key
- Check that the key is correct and has sufficient credits

### PDF Text Extraction Issues
- Ensure the PDF contains selectable text (not just images)
- Password-protected PDFs are not supported
- Try a different PDF if extraction fails

### Video Transcription Issues
- Ensure the video file has audio
- Large video files may take longer to process
- YouTube videos must have captions enabled

### YouTube Video Issues
- Only videos with available captions/transcripts can be processed
- For videos without captions, download and upload the video file directly
- Or set up a YouTube audio extraction service in your backend

## API Key Security

⚠️ **Important**: Never commit your API key to version control. Always use environment variables or Supabase secrets.

The API key provided in this setup is for demonstration purposes. For production, use your own OpenAI API key and keep it secure.

