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
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl) {
      throw new Error('YouTube URL is required');
    }

    console.log('Fetching YouTube transcript for:', youtubeUrl);

    // Extract video ID from URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Fetch video page to extract captions
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const videoPageHtml = await videoPageResponse.text();
    
    // Extract caption tracks from page
    const captionTracksMatch = videoPageHtml.match(/"captionTracks":(\[.*?\])/);
    if (!captionTracksMatch) {
      throw new Error('No captions available for this video. Please ensure the video has captions enabled or try uploading the video file directly.');
    }

    const captionTracks = JSON.parse(captionTracksMatch[1]);
    if (captionTracks.length === 0) {
      throw new Error('No captions available for this video.');
    }

    // Get the first available caption track (usually auto-generated English)
    const captionUrl = captionTracks[0].baseUrl;
    
    // Fetch the caption XML
    const captionResponse = await fetch(captionUrl);
    const captionXml = await captionResponse.text();
    
    // Parse XML to extract text and timestamps
    const textMatches = [...captionXml.matchAll(/<text start="([^"]+)"[^>]*>([^<]+)<\/text>/g)];
    
    if (textMatches.length === 0) {
      throw new Error('Failed to parse captions from video.');
    }
    
    const transcriptData = textMatches.map(match => ({
      offset: parseFloat(match[1]) * 1000,
      text: decodeHTMLEntities(match[2])
    }));
    
    // Format transcript
    const fullText = transcriptData.map(item => item.text).join(' ');
    const timestamps = transcriptData.map(item => ({
      time: formatTime(item.offset / 1000),
      text: item.text
    }));

    console.log('YouTube transcript fetched successfully');

    return new Response(
      JSON.stringify({
        text: fullText,
        timestamps: timestamps
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in youtube-transcript function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
