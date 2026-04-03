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
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\n/g, ' ').trim();
}

function parseXmlTranscript(xml: string): Array<{ time: string; text: string }> | null {
  const segments: Array<{ time: string; text: string }> = [];
  // srv3: <p t="ms">
  let match;
  const srv3 = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>(.*?)<\/p>/gs;
  while ((match = srv3.exec(xml)) !== null) {
    const t = match[3].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseInt(match[1]) / 1000), text: decodeHTMLEntities(t) });
  }
  if (segments.length > 0) return segments;
  // srv1: <text start="sec">
  const srv1 = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
  while ((match = srv1.exec(xml)) !== null) {
    const t = match[3].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseFloat(match[1])), text: decodeHTMLEntities(t) });
  }
  return segments.length > 0 ? segments : null;
}

// Get available caption track URLs from YouTube's watch page
async function getCaptionTracksFromPage(videoId: string): Promise<Array<{ lang: string; baseUrl: string }>> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    if (!res.ok) { await res.text(); return []; }
    const html = await res.text();

    // Extract captionTracks from ytInitialPlayerResponse
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) {
      console.log('[youtube-transcript] No captionTracks found in page HTML');
      return [];
    }

    const tracks = JSON.parse(match[1]);
    console.log(`[youtube-transcript] Page extraction found ${tracks.length} tracks:`,
      tracks.map((t: any) => t.languageCode));
    
    return tracks.map((t: any) => ({ lang: t.languageCode, baseUrl: t.baseUrl }));
  } catch (e) {
    console.error('[youtube-transcript] Page extraction failed:', e);
    return [];
  }
}

// Method 1: Extract caption URLs from watch page HTML and download
async function fetchFromWatchPage(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying watch page extraction...');
  const tracks = await getCaptionTracksFromPage(videoId);
  
  // Prefer English
  const englishTrack = tracks.find(t => t.lang === 'en' || t.lang.startsWith('en'));
  const orderedTracks = englishTrack ? [englishTrack, ...tracks.filter(t => t !== englishTrack)] : tracks;

  for (const track of orderedTracks) {
    try {
      const res = await fetch(track.baseUrl);
      if (!res.ok) { await res.text(); continue; }
      const xml = await res.text();
      const segments = parseXmlTranscript(xml);
      if (segments && segments.length > 0) {
        console.log(`[youtube-transcript] Watch page download success: ${segments.length} segments (lang=${track.lang})`);
        return { text: segments.map(s => s.text).join(' '), timestamps: segments };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Method 2: InnerTube API
async function fetchWithInnerTube(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying InnerTube API...');
  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en' } },
        videoId,
      }),
    });
    if (!playerRes.ok) { await playerRes.text(); return null; }
    const data = await playerRes.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) { console.log('[youtube-transcript] No tracks from InnerTube'); return null; }

    const en = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
    const track = en || tracks[0];
    if (!track.baseUrl) return null;

    console.log(`[youtube-transcript] InnerTube downloading: ${track.languageCode}`);
    const res = await fetch(track.baseUrl);
    if (!res.ok) { await res.text(); return null; }
    const xml = await res.text();
    const segments = parseXmlTranscript(xml);
    if (segments?.length) {
      console.log(`[youtube-transcript] InnerTube success: ${segments.length} segments`);
      return { text: segments.map(s => s.text).join(' '), timestamps: segments };
    }
  } catch (e) { console.error('[youtube-transcript] InnerTube failed:', e); }
  return null;
}

// Method 3: Timedtext API with language discovery via YouTube Data API
async function fetchWithTimedTextAndAPI(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying timedtext with API discovery...');

  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  const languages = ['en', 'en-US'];

  // Use YouTube Data API to discover available languages
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        console.log(`[youtube-transcript] API found ${items.length} tracks:`,
          items.map((c: any) => `${c.snippet.language} (${c.snippet.trackKind})`));
        
        for (const item of items) {
          const lang = item.snippet.language;
          if (!languages.includes(lang)) languages.push(lang);
        }
      } else { await res.text(); }
    } catch (e) { console.warn('[youtube-transcript] API discovery failed:', e); }
  }

  // Add common languages as fallback
  for (const l of ['es', 'hi', 'pt', 'fr', 'de', 'ja', 'ko', 'ru', 'ar', 'zh', '']) {
    if (!languages.includes(l)) languages.push(l);
  }

  for (const lang of languages) {
    for (const kind of ['', 'asr']) {
      for (const fmt of ['srv1', 'srv3']) {
        try {
          let url = `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=${fmt}`;
          if (lang) url += `&lang=${lang}`;
          if (kind) url += `&kind=${kind}`;
          
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (!res.ok) { await res.text(); continue; }
          const xml = await res.text();
          if (!xml || xml.length < 50) continue;
          const segments = parseXmlTranscript(xml);
          if (segments?.length) {
            console.log(`[youtube-transcript] timedtext success: ${segments.length} segments (lang=${lang}, kind=${kind})`);
            return { text: segments.map(s => s.text).join(' '), timestamps: segments };
          }
        } catch (e) { /* continue */ }
      }
    }
  }
  return null;
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

    let result: { text: string; timestamps: Array<{ time: string; text: string }> } | null = null;

    // Method 1: Watch page HTML extraction (gets signed URLs directly)
    result = await fetchFromWatchPage(videoId);

    // Method 2: InnerTube API
    if (!result) result = await fetchWithInnerTube(videoId);

    // Method 3: Timedtext + API discovery
    if (!result) result = await fetchWithTimedTextAndAPI(videoId);

    if (!result?.text) {
      return errorResponse('No captions available for this video. Please ensure the video has captions/subtitles enabled.', 422);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${result.text.length} chars, ${result.timestamps.length} segments`);

    return jsonResponse({ success: true, text: result.text, timestamps: result.timestamps, videoId });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(msg, msg.includes('captions') ? 422 : 500);
  }
});
