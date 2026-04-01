import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  console.error(`[youtube-transcript] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

function extractVideoId(url: string): string | null {
  // Sanitize URL
  const sanitized = url.trim().substring(0, 500);
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = sanitized.match(pattern);
    if (match?.[1]) return match[1];
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { youtubeUrl, userId } = await req.json();

    // Input validation
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return errorResponse('YouTube URL is required', 400);
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return errorResponse('Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.', 400);
    }

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    // Check cache — if this user already summarized this video, return cached
    if (userId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        const { data: cached } = await supabase
          .from('summaries')
          .select('summary_text, extracted_text')
          .eq('user_id', userId)
          .eq('video_id', videoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.summary_text) {
          console.log(`[youtube-transcript] Cache hit for video ${videoId}`);
          return jsonResponse({
            success: true,
            text: cached.extracted_text,
            timestamps: [],
            videoId,
            cached: true,
            cachedSummary: cached.summary_text,
          });
        }
      } catch (e) {
        console.warn('[youtube-transcript] Cache check failed, proceeding without cache:', e);
      }
    }

    // Fetch video page to extract captions
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const videoPageHtml = await videoPageResponse.text();
    
    const captionTracksMatch = videoPageHtml.match(/"captionTracks":(\[.*?\])/);
    if (!captionTracksMatch) {
      return errorResponse('No captions available for this video. Please ensure the video has captions enabled.', 422);
    }

    const captionTracks = JSON.parse(captionTracksMatch[1]);
    if (captionTracks.length === 0) {
      return errorResponse('No captions available for this video.', 422);
    }

    const captionUrl = captionTracks[0].baseUrl;
    const captionResponse = await fetch(captionUrl);
    const captionXml = await captionResponse.text();
    
    const textMatches = [...captionXml.matchAll(/<text start="([^"]+)"[^>]*>([^<]+)<\/text>/g)];
    
    if (textMatches.length === 0) {
      return errorResponse('Failed to parse captions from video.', 422);
    }
    
    const transcriptData = textMatches.map(match => ({
      offset: parseFloat(match[1]) * 1000,
      text: decodeHTMLEntities(match[2])
    }));
    
    const fullText = transcriptData.map(item => item.text).join(' ');
    const timestamps = transcriptData.map(item => ({
      time: formatTime(item.offset / 1000),
      text: item.text
    }));

    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${fullText.length} chars`);

    return jsonResponse({
      success: true,
      text: fullText,
      timestamps,
      videoId,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
