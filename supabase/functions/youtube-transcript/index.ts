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

    // Use youtube-transcript library via CDN
    const transcriptResponse = await fetch(
      `https://youtube-transcript-api.vercel.app/api/transcript?videoId=${videoId}`
    );

    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch YouTube transcript. Video may not have captions.');
    }

    const transcriptData = await transcriptResponse.json();
    
    // Format transcript
    const fullText = transcriptData.map((item: any) => item.text).join(' ');
    const timestamps = transcriptData.map((item: any) => ({
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
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
