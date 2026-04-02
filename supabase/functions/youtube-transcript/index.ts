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
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\n/g, ' ').trim();
}

async function getTranscriptViaInnerTube(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> }> {
  // Step 1: Fetch video page to get initial player data
  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const html = await videoPageResponse.text();

  // Try multiple patterns to find caption tracks
  let captionUrl: string | null = null;

  // Pattern 1: captionTracks in ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        // Prefer English, fallback to first track
        const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
        captionUrl = (enTrack || tracks[0]).baseUrl;
      }
    } catch (e) {
      console.warn('[youtube-transcript] Failed to parse ytInitialPlayerResponse:', e);
    }
  }

  // Pattern 2: Direct captionTracks JSON
  if (!captionUrl) {
    const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (captionTracksMatch) {
      try {
        const tracks = JSON.parse(captionTracksMatch[1]);
        if (tracks.length > 0) {
          const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
          captionUrl = (enTrack || tracks[0]).baseUrl;
        }
      } catch (e) {
        console.warn('[youtube-transcript] Failed to parse captionTracks:', e);
      }
    }
  }

  // Pattern 3: Try the innertube API directly
  if (!captionUrl) {
    console.log('[youtube-transcript] Trying innertube API...');
    const innertubeResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            hl: 'en',
            gl: 'US',
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
          },
        },
        videoId,
      }),
    });
    const innertubeData = await innertubeResponse.json();
    const tracks = innertubeData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks && tracks.length > 0) {
      const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
      captionUrl = (enTrack || tracks[0]).baseUrl;
    }
  }

  if (!captionUrl) {
    throw new Error('No captions available for this video. Please ensure the video has captions enabled.');
  }

  // Fetch and parse the caption XML
  const captionResponse = await fetch(captionUrl);
  const captionXml = await captionResponse.text();

  console.log(`[youtube-transcript] Caption XML length: ${captionXml.length}, first 200 chars: ${captionXml.substring(0, 200)}`);

  // More flexible regex that handles various XML formats including nested tags and empty content
  const textMatches = [...captionXml.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)];

  if (textMatches.length === 0) {
    // Try alternative format: JSON-based captions
    console.warn('[youtube-transcript] XML regex found 0 matches, trying JSON format...');
    
    // Some caption URLs return JSON when fmt=json3 is appended
    const jsonUrl = captionUrl + (captionUrl.includes('?') ? '&' : '?') + 'fmt=json3';
    const jsonResponse = await fetch(jsonUrl);
    const jsonText = await jsonResponse.text();
    
    try {
      const jsonData = JSON.parse(jsonText);
      const events = jsonData.events || [];
      const segments = events
        .filter((e: any) => e.segs && e.tStartMs !== undefined)
        .map((e: any) => ({
          offset: (e.tStartMs || 0) / 1000,
          text: (e.segs || []).map((s: any) => s.utf8 || '').join('').trim(),
        }))
        .filter((item: any) => item.text.length > 0);

      if (segments.length === 0) {
        throw new Error('Failed to parse captions from video.');
      }

      const fullText = segments.map((item: any) => item.text).join(' ');
      const timestamps = segments.map((item: any) => ({
        time: formatTime(item.offset),
        text: item.text,
      }));

      return { text: fullText, timestamps };
    } catch (jsonErr) {
      console.error('[youtube-transcript] JSON parse also failed:', jsonErr);
      throw new Error('Failed to parse captions from video.');
    }
  }

  const transcriptData = textMatches.map(match => ({
    offset: parseFloat(match[1]),
    text: decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '')),
  })).filter(item => item.text.length > 0);

  const fullText = transcriptData.map(item => item.text).join(' ');
  const timestamps = transcriptData.map(item => ({
    time: formatTime(item.offset),
    text: item.text,
  }));

  return { text: fullText, timestamps };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { youtubeUrl, userId } = await req.json();

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return errorResponse('YouTube URL is required', 400);
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return errorResponse('Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.', 400);
    }

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    // Check cache
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
        console.warn('[youtube-transcript] Cache check failed:', e);
      }
    }

    const { text, timestamps } = await getTranscriptViaInnerTube(videoId);

    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${text.length} chars`);

    return jsonResponse({
      success: true,
      text,
      timestamps,
      videoId,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
