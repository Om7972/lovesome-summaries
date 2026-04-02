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

async function getTranscript(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> }> {
  const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Step 1: Get video page HTML to extract the initial player response
  const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  const html = await pageResponse.text();
  console.log(`[youtube-transcript] Page HTML length: ${html.length}`);

  // Extract ytInitialPlayerResponse
  let playerResponse: any = null;
  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|<\/script)/s);
  if (prMatch) {
    try {
      playerResponse = JSON.parse(prMatch[1]);
    } catch (e) {
      console.warn('[youtube-transcript] Failed to parse ytInitialPlayerResponse');
    }
  }

  // If page parsing fails, try innertube API
  if (!playerResponse) {
    console.log('[youtube-transcript] Trying innertube player API...');
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({
        context: { client: { hl: 'en', gl: 'US', clientName: 'WEB', clientVersion: '2.20241201.00.00' } },
        videoId,
      }),
    });
    playerResponse = await resp.json();
  }

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('No captions available for this video. Please ensure the video has captions/subtitles enabled.');
  }

  // Prefer English
  const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
  let captionUrl = (enTrack || tracks[0]).baseUrl;
  captionUrl = captionUrl.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

  console.log(`[youtube-transcript] Found ${tracks.length} caption tracks, using: ${(enTrack || tracks[0]).languageCode}`);

  // Fetch transcript as JSON3 format (most reliable)
  const json3Url = captionUrl + (captionUrl.includes('?') ? '&' : '?') + 'fmt=json3';
  const json3Response = await fetch(json3Url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  
  if (json3Response.ok) {
    const jsonText = await json3Response.text();
    if (jsonText.length > 0) {
      try {
        const jsonData = JSON.parse(jsonText);
        const events = jsonData.events || [];
        const segments = events
          .filter((e: any) => e.segs && e.tStartMs !== undefined)
          .map((e: any) => ({
            offset: (e.tStartMs || 0) / 1000,
            text: (e.segs || []).map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
          }))
          .filter((item: any) => item.text.length > 0);

        if (segments.length > 0) {
          console.log(`[youtube-transcript] JSON3 parsed ${segments.length} segments`);
          return {
            text: segments.map((s: any) => s.text).join(' '),
            timestamps: segments.map((s: any) => ({ time: formatTime(s.offset), text: s.text })),
          };
        }
      } catch (e) {
        console.warn('[youtube-transcript] JSON3 parse error:', e);
      }
    }
  }

  // Fallback: fetch XML format
  const xmlResponse = await fetch(captionUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });
  const captionXml = await xmlResponse.text();
  console.log(`[youtube-transcript] XML length: ${captionXml.length}`);

  const textMatches = [...captionXml.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)];
  if (textMatches.length === 0) {
    throw new Error('Failed to parse captions from video. The video may not have subtitles enabled.');
  }

  const transcriptData = textMatches.map(match => ({
    offset: parseFloat(match[1]),
    text: decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '')),
  })).filter(item => item.text.length > 0);

  return {
    text: transcriptData.map(item => item.text).join(' '),
    timestamps: transcriptData.map(item => ({ time: formatTime(item.offset), text: item.text })),
  };
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
      return errorResponse('Invalid YouTube URL.', 400);
    }

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    // Check cache
    if (userId) {
      try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: cached } = await supabase
          .from('summaries')
          .select('summary_text, extracted_text')
          .eq('user_id', userId)
          .eq('video_id', videoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.summary_text) {
          console.log(`[youtube-transcript] Cache hit`);
          return jsonResponse({ success: true, text: cached.extracted_text, timestamps: [], videoId, cached: true, cachedSummary: cached.summary_text });
        }
      } catch (e) {
        console.warn('[youtube-transcript] Cache check failed:', e);
      }
    }

    const { text, timestamps } = await getTranscript(videoId);
    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${text.length} chars`);

    return jsonResponse({ success: true, text, timestamps, videoId });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
