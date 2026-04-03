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
  for (const p of patterns) {
    const m = sanitized.match(p);
    if (m?.[1]) return m[1];
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n/g, ' ').trim();
}

function parseXmlTranscript(xml: string): Array<{ time: string; text: string }> | null {
  const segments: Array<{ time: string; text: string }> = [];
  let m;
  const re = /<text\s+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = re.exec(xml)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseFloat(m[1])), text: decodeHTMLEntities(t) });
  }
  if (segments.length > 0) return segments;
  const re2 = /<p\s+t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = re2.exec(xml)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseInt(m[1]) / 1000), text: decodeHTMLEntities(t) });
  }
  return segments.length > 0 ? segments : null;
}

// Fetch YouTube watch page HTML, extract player response JSON, get caption track URLs
async function getPlayerResponse(videoId: string): Promise<any | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html',
    'Accept-Encoding': 'identity',
    'Cookie': 'CONSENT=PENDING+987; SOCS=CAESEwgDEgk1MTIyNjM0NDMaAmVuIAEaBgiA_LyaBg',
  };

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers });
    if (!res.ok) { await res.text(); return null; }
    const html = await res.text();
    console.log(`[youtube-transcript] Page HTML length: ${html.length}`);

    // Find ytInitialPlayerResponse
    const match = html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*var\s/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }

    // Alternative: look for JSON in script tags
    const match2 = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
    if (match2) {
      try {
        return JSON.parse(match2[1]);
      } catch {}
    }

    console.log('[youtube-transcript] Could not extract player response from HTML');
    return null;
  } catch (e) {
    console.error('[youtube-transcript] Page fetch failed:', e);
    return null;
  }
}

async function downloadCaptions(baseUrl: string): Promise<Array<{ time: string; text: string }> | null> {
  try {
    // Add identity encoding to prevent compression issues
    const url = new URL(baseUrl);
    // Ensure we get srv1 format (XML with <text> elements)
    url.searchParams.set('fmt', 'srv1');
    
    const res = await fetch(url.toString(), {
      headers: {
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!res.ok) { await res.text(); return null; }
    const xml = await res.text();
    console.log(`[youtube-transcript] Caption response: ${xml.length} bytes, starts with: ${xml.substring(0, 100)}`);
    
    if (xml.length < 10) return null;
    return parseXmlTranscript(xml);
  } catch (e) {
    console.error('[youtube-transcript] Caption download failed:', e);
    return null;
  }
}

// InnerTube player API with identity encoding
async function fetchInnerTube(videoId: string): Promise<any | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20241126.01.00', hl: 'en' } },
        videoId,
      }),
    });
    if (!res.ok) { await res.text(); return null; }
    return await res.json();
  } catch (e) {
    console.error('[youtube-transcript] InnerTube request failed:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { youtubeUrl, userId } = await req.json();
    if (!youtubeUrl || typeof youtubeUrl !== 'string') return errorResponse('YouTube URL is required', 400);

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return errorResponse('Invalid YouTube URL.', 400);

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    // Check cache
    if (userId) {
      try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: cached } = await supabase
          .from('summaries').select('summary_text, extracted_text')
          .eq('user_id', userId).eq('video_id', videoId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (cached?.summary_text) {
          console.log('[youtube-transcript] Cache hit');
          return jsonResponse({ success: true, text: cached.extracted_text, timestamps: [], videoId, cached: true, cachedSummary: cached.summary_text });
        }
      } catch (e) { console.warn('[youtube-transcript] Cache check failed:', e); }
    }

    // --- Method 1: Watch page extraction ---
    console.log('[youtube-transcript] Method 1: Watch page...');
    let playerData = await getPlayerResponse(videoId);
    let captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    // --- Method 2: InnerTube API ---
    if (!captionTracks?.length) {
      console.log('[youtube-transcript] Method 2: InnerTube...');
      playerData = await fetchInnerTube(videoId);
      captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    }

    if (!captionTracks?.length) {
      console.log('[youtube-transcript] No caption tracks found from any method');
      return errorResponse('No captions available for this video. Please ensure the video has captions/subtitles enabled.', 422);
    }

    console.log(`[youtube-transcript] Found ${captionTracks.length} tracks:`,
      captionTracks.map((t: any) => `${t.languageCode}(${t.kind || 'manual'})`));

    // Prefer English, then any
    const en = captionTracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
    const ordered = en ? [en, ...captionTracks.filter((t: any) => t !== en)] : captionTracks;

    for (const track of ordered) {
      if (!track.baseUrl) continue;
      console.log(`[youtube-transcript] Downloading: ${track.languageCode}`);
      const segments = await downloadCaptions(track.baseUrl);
      if (segments?.length) {
        const text = segments.map(s => s.text).join(' ');
        const elapsed = Date.now() - startTime;
        console.log(`[youtube-transcript] Success in ${elapsed}ms: ${segments.length} segments, ${text.length} chars`);
        return jsonResponse({ success: true, text, timestamps: segments, videoId });
      }
    }

    return errorResponse('Captions were found but could not be downloaded. YouTube may be blocking server requests.', 422);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(msg, 500);
  }
});
