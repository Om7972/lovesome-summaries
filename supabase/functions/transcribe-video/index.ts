<<<<<<< HEAD
=======
import "https://deno.land/x/xhr@0.1.0/mod.ts";
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
<<<<<<< HEAD
    const { videoUrl, videoType, videoBase64 } = await req.json();

    if (!videoUrl && !videoBase64) {
      throw new Error('No video URL or video file provided');
    }

    console.log(`Processing video: ${videoUrl || 'uploaded file'} (type: ${videoType})`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured. Please set it in your Supabase project settings.');
    }

    let audioFile: File | Blob | null = null;
    let audioFileName = 'audio.mp3';

    if (videoType === 'youtube') {
      // For YouTube videos, first try to get transcripts, then fall back to audio extraction
      // Extract video ID from URL
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
      const match = videoUrl?.match(youtubeRegex);
      const videoId = match ? match[1] : null;
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video URL.');
      }
      
      // Try to get transcript from YouTube first (if available)
      try {
        // Use a public YouTube transcript API service
        // This service fetches available transcripts from YouTube
        const transcriptResponse = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (transcriptResponse.ok) {
          const transcriptXml = await transcriptResponse.text();
          
          // Parse XML transcript and convert to text with timestamps
          // Simple XML parsing for transcript
          const textMatches = transcriptXml.match(/<text start="([^"]+)"[^>]*>([^<]+)<\/text>/g) || [];
          const transcriptParts = textMatches.map(match => {
            const startMatch = match.match(/start="([^"]+)"/);
            const textMatch = match.match(/>([^<]+)</);
            if (startMatch && textMatch) {
              const seconds = parseFloat(startMatch[1]);
              const minutes = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              const timestamp = `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
              // Decode HTML entities
              const text = textMatch[1]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'");
              return `${timestamp} ${text}`;
            }
            return null;
          }).filter((t): t is string => t !== null);
          
          if (transcriptParts.length > 0) {
            const transcription = transcriptParts.join('\n');
            console.log('YouTube transcript retrieved successfully');
            return new Response(
              JSON.stringify({ transcription }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (error) {
        console.log('Could not fetch YouTube transcript, will try audio extraction:', error);
      }
      
      // If transcript not available, try to extract audio and use Whisper
      // For now, we'll provide a helpful error message
      // In production, you would set up a YouTube audio extraction service
      throw new Error('YouTube video does not have available transcripts and audio extraction requires a backend service. Please either: 1) Use a video with captions, 2) Download the video and upload it directly, or 3) Set up a YouTube downloader service (e.g., using yt-dlp) in your backend.');
      
    } else if (videoBase64) {
      // For uploaded videos, decode base64 and create a file
      try {
        const videoBytes = Uint8Array.from(atob(videoBase64), c => c.charCodeAt(0));
        audioFile = new Blob([videoBytes], { type: 'video/mp4' });
        audioFileName = 'uploaded_video.mp4';
      } catch (error) {
        console.error('Error decoding video:', error);
        throw new Error('Failed to decode video file');
      }
    } else {
      throw new Error('Video file or URL is required');
    }

    // If we have a video file, we need to extract audio
    // For simplicity, we'll send the video directly to Whisper API
    // Whisper can handle video files and extract audio automatically
    
    if (!audioFile) {
      throw new Error('No audio file available for transcription');
    }

    // Prepare form data for Whisper API
    // In Deno, we need to create a File object from the Blob
    const file = audioFile instanceof File 
      ? audioFile 
      : new File([audioFile], audioFileName, { type: audioFile.type || 'video/mp4' });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json'); // Get timestamps
    formData.append('language', 'en'); // Specify language for better accuracy

    console.log(`Calling OpenAI Whisper API for transcription... File: ${audioFileName}, Size: ${file.size} bytes`);

    // Call OpenAI Whisper API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large videos

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      console.error('Whisper API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: `Whisper API error (${whisperResponse.status}): ${errorData.error?.message || whisperResponse.statusText}. ${whisperResponse.status === 413 ? 'File too large. Maximum size is 25MB.' : 'Please check your API key and try again.'}`
        }),
        { 
          status: whisperResponse.status >= 500 ? 502 : whisperResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const whisperData = await whisperResponse.json();
    
    // Format transcription with timestamps if available
    let transcription = whisperData.text || '';
    
    // If we have segments with timestamps, format them nicely
    if (whisperData.segments && Array.isArray(whisperData.segments)) {
      transcription = whisperData.segments
        .map((segment: any) => {
          const startMinutes = Math.floor(segment.start / 60);
          const startSeconds = Math.floor(segment.start % 60);
          const timestamp = `[${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}]`;
          return `${timestamp} ${segment.text.trim()}`;
        })
        .join('\n');
    }

    console.log('Video transcribed successfully');

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-video:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Transcription request timed out. The video might be too long. Please try with a shorter video (max 25MB).' }),
        { 
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: `Failed to transcribe video: ${errorMessage}. Please ensure the video has audio and is in a supported format.`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
=======
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    console.log('Transcribing audio file:', audioFile.name);

    // Create form data for OpenAI
    const openAiFormData = new FormData();
    openAiFormData.append('file', audioFile);
    openAiFormData.append('model', 'whisper-1');
    openAiFormData.append('response_format', 'verbose_json');
    openAiFormData.append('timestamp_granularities[]', 'segment');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: openAiFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Transcription complete');

    // Format timestamps
    const timestamps = result.segments?.map((segment: any) => ({
      time: formatTime(segment.start),
      text: segment.text.trim()
    })) || [];

    return new Response(
      JSON.stringify({
        text: result.text,
        timestamps: timestamps
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in transcribe-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
