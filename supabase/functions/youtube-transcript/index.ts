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
  // srv1/srv3 text elements
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = re.exec(xml)) !== null) {
    const t = m[3].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseFloat(m[1])), text: decodeHTMLEntities(t) });
  }
  if (segments.length > 0) return segments;
  // srv3 <p> elements
  const re2 = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = re2.exec(xml)) !== null) {
    const t = m[3].replace(/<[^>]+>/g, '').trim();
    if (t) segments.push({ time: formatTime(parseInt(m[1]) / 1000), text: decodeHTMLEntities(t) });
  }
  return segments.length > 0 ? segments : null;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cookie': 'CONSENT=YES+cb; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnBpwY',
};

// Primary method: fetch watch page, extract captionTracks with signed URLs, download
async function fetchFromWatchPage(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Method 1: Watch page extraction...');
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) { await res.text(); return null; }
    const html = await res.text();
    
    // Try multiple patterns to find captionTracks
    let tracks: any[] = [];
    
    // Pattern 1: ytInitialPlayerResponse
    const p1 = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
    if (p1) {
      try { tracks = JSON.parse(p1[1]); } catch {}
    }
    
    // Pattern 2: broader search
    if (!tracks.length) {
      const p2 = html.match(/captionTracks":\s*(\[.*?\])/);
      if (p2) {
        try { tracks = JSON.parse(p2[1]); } catch {}
      }
    }

    // Pattern 3: search in ytInitialPlayerResponse variable
    if (!tracks.length) {
      const playerMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/);
      if (playerMatch) {
        try {
          const player = JSON.parse(playerMatch[1]);
          tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        } catch {}
      }
    }

    if (!tracks.length) {
      console.log('[youtube-transcript] No captionTracks in page (page length:', html.length, ')');
      // Log a snippet to debug
      const idx = html.indexOf('captionTrack');
      if (idx > -1) {
        console.log('[youtube-transcript] Found captionTrack at index', idx, ':', html.substring(idx, idx + 200));
      }
      return null;
    }

    console.log(`[youtube-transcript] Found ${tracks.length} tracks:`, tracks.map((t: any) => t.languageCode));

    // Prefer English
    const en = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
    const ordered = en ? [en, ...tracks.filter((t: any) => t !== en)] : tracks;

    for (const track of ordered) {
      if (!track.baseUrl) { console.log('[youtube-transcript] Track missing baseUrl:', track.languageCode); continue; }
      try {
        console.log(`[youtube-transcript] Downloading track ${track.languageCode}: ${track.baseUrl.substring(0, 100)}...`);
        const r = await fetch(track.baseUrl);
        console.log(`[youtube-transcript] Download status: ${r.status}, content-type: ${r.headers.get('content-type')}`);
        if (!r.ok) { const t = await r.text(); console.log('[youtube-transcript] Download error body:', t.substring(0, 200)); continue; }
        const xml = await r.text();
        console.log(`[youtube-transcript] Downloaded XML length: ${xml.length}, preview: ${xml.substring(0, 200)}`);
        const segs = parseXmlTranscript(xml);
        console.log(`[youtube-transcript] Parsed segments: ${segs?.length || 0}`);
        if (segs?.length) {
          console.log(`[youtube-transcript] Success via watch page: ${segs.length} segments (${track.languageCode})`);
          return { text: segs.map(s => s.text).join(' '), timestamps: segs };
        }
      } catch (e) { console.error(`[youtube-transcript] Download failed for ${track.languageCode}:`, e); }
    }
  } catch (e) {
    console.error('[youtube-transcript] Watch page failed:', e);
  }
  return null;
}

// Method 2: InnerTube player API
async function fetchWithInnerTube(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Method 2: InnerTube API...');
  try {
    // Try multiple client types
    const clients = [
      { clientName: 'WEB', clientVersion: '2.20240101.00.00' },
      { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30 },
      { clientName: 'IOS', clientVersion: '19.09.3' },
    ];

    for (const client of clients) {
      try {
        const r = await fetch('https://www.youtube.com/youtubei/v1/player', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...BROWSER_HEADERS,
          },
          body: JSON.stringify({
            context: { client: { ...client, hl: 'en' } },
            videoId,
          }),
        });
        if (!r.ok) { await r.text(); continue; }
        const data = await r.json();
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!tracks?.length) continue;

        console.log(`[youtube-transcript] InnerTube (${client.clientName}) found ${tracks.length} tracks`);
        
        const en = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
        const track = en || tracks[0];
        if (!track.baseUrl) continue;

        const tr = await fetch(track.baseUrl);
        if (!tr.ok) { await tr.text(); continue; }
        const xml = await tr.text();
        const segs = parseXmlTranscript(xml);
        if (segs?.length) {
          console.log(`[youtube-transcript] InnerTube success: ${segs.length} segments (${track.languageCode})`);
          return { text: segs.map(s => s.text).join(' '), timestamps: segs };
        }
      } catch {}
    }
  } catch (e) {
    console.error('[youtube-transcript] InnerTube failed:', e);
  }
  return null;
}

// Method 3: Direct timedtext with discovered languages from YouTube Data API
async function fetchWithTimedText(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Method 3: Timedtext + API discovery...');

  const languages: Array<{ lang: string; kind: string }> = [];
  
  // Use YouTube Data API to discover exact languages
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (apiKey) {
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`);
      if (r.ok) {
        const data = await r.json();
        for (const item of (data.items || [])) {
          languages.push({
            lang: item.snippet.language,
            kind: item.snippet.trackKind === 'ASR' ? 'asr' : '',
          });
        }
        console.log(`[youtube-transcript] API discovered: ${languages.map(l => `${l.lang}(${l.kind || 'manual'})`).join(', ')}`);
      } else { await r.text(); }
    } catch {}
  }

  // Add common fallbacks
  const fallbacks = [
    { lang: 'en', kind: '' }, { lang: 'en', kind: 'asr' },
    { lang: 'es', kind: 'asr' }, { lang: 'hi', kind: 'asr' },
    { lang: 'pt', kind: 'asr' }, { lang: 'fr', kind: 'asr' },
    { lang: 'de', kind: 'asr' }, { lang: 'ja', kind: 'asr' },
  ];
  for (const fb of fallbacks) {
    if (!languages.some(l => l.lang === fb.lang && l.kind === fb.kind)) {
      languages.push(fb);
    }
  }

  for (const { lang, kind } of languages) {
    for (const fmt of ['srv1', 'srv3']) {
      try {
        let url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=${fmt}`;
        if (kind) url += `&kind=${kind}`;
        const r = await fetch(url, { headers: BROWSER_HEADERS });
        if (!r.ok) { await r.text(); continue; }
        const xml = await r.text();
        if (!xml || xml.length < 50) continue;
        const segs = parseXmlTranscript(xml);
        if (segs?.length) {
          console.log(`[youtube-transcript] Timedtext success: ${segs.length} segments (${lang}, ${kind || 'manual'})`);
          return { text: segs.map(s => s.text).join(' '), timestamps: segs };
        }
      } catch {}
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
    if (!youtubeUrl || typeof youtubeUrl !== 'string') return errorResponse('YouTube URL is required', 400);
    
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return errorResponse('Invalid YouTube URL.', 400);

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    // Check cache
    if (userId) {
      try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: cached } = await supabase
          .from('summaries')
          .select('summary_text, extracted_text')
          .eq('user_id', userId).eq('video_id', videoId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (cached?.summary_text) {
          console.log('[youtube-transcript] Cache hit');
          return jsonResponse({ success: true, text: cached.extracted_text, timestamps: [], videoId, cached: true, cachedSummary: cached.summary_text });
        }
      } catch (e) { console.warn('[youtube-transcript] Cache check failed:', e); }
    }

    let result: { text: string; timestamps: Array<{ time: string; text: string }> } | null = null;

    result = await fetchFromWatchPage(videoId);
    if (!result) result = await fetchWithInnerTube(videoId);
    if (!result) result = await fetchWithTimedText(videoId);

    if (!result?.text) {
      return errorResponse('No captions available for this video. Please ensure the video has captions/subtitles enabled.', 422);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Done in ${elapsed}ms, ${result.text.length} chars`);
    return jsonResponse({ success: true, text: result.text, timestamps: result.timestamps, videoId });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(msg, msg.includes('captions') ? 422 : 500);
  }
});
