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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\n/g, ' ')
    .trim();
}

function parseXmlTranscript(xml: string): Array<{ time: string; text: string }> | null {
  const segments: Array<{ time: string; text: string }> = [];

  // Try srv3 format: <p t="ms" d="ms">text</p>
  const srv3Regex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>(.*?)<\/p>/gs;
  let match;
  while ((match = srv3Regex.exec(xml)) !== null) {
    const rawText = match[3].replace(/<[^>]+>/g, '').trim();
    if (rawText) {
      segments.push({
        time: formatTime(parseInt(match[1]) / 1000),
        text: decodeHTMLEntities(rawText),
      });
    }
  }

  if (segments.length > 0) return segments;

  // Try srv1 format: <text start="seconds" dur="seconds">text</text>
  const srv1Regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
  while ((match = srv1Regex.exec(xml)) !== null) {
    const rawText = match[3].replace(/<[^>]+>/g, '').trim();
    if (rawText) {
      segments.push({
        time: formatTime(parseFloat(match[1])),
        text: decodeHTMLEntities(rawText),
      });
    }
  }

  return segments.length > 0 ? segments : null;
}

// Method 1: InnerTube API - try ALL languages
async function fetchWithInnerTube(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying InnerTube API...');
  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en' },
        },
        videoId,
      }),
    });

    if (!playerRes.ok) { await playerRes.text(); return null; }

    const playerData = await playerRes.json();
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.log('[youtube-transcript] No caption tracks in InnerTube response');
      return null;
    }

    console.log(`[youtube-transcript] InnerTube found ${captionTracks.length} tracks:`,
      captionTracks.map((t: any) => `${t.languageCode} (${t.kind || 'manual'})`));

    // Prefer English, then any language
    const englishTrack = captionTracks.find((t: any) =>
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    );
    const track = englishTrack || captionTracks[0];
    const trackUrl = track.baseUrl;
    if (!trackUrl) return null;

    console.log(`[youtube-transcript] Downloading InnerTube track: ${track.languageCode}`);
    const trackRes = await fetch(trackUrl);
    if (!trackRes.ok) { await trackRes.text(); return null; }

    const xml = await trackRes.text();
    const segments = parseXmlTranscript(xml);
    if (segments && segments.length > 0) {
      console.log(`[youtube-transcript] InnerTube success: ${segments.length} segments`);
      return { text: segments.map(s => s.text).join(' '), timestamps: segments };
    }
  } catch (e) {
    console.error('[youtube-transcript] InnerTube failed:', e);
  }
  return null;
}

// Method 2: Timedtext API - try multiple languages and formats
async function fetchWithTimedText(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying timedtext API...');

  // Try various language + kind + format combos
  const attempts = [
    { lang: 'en', kind: '', fmt: 'srv3' },
    { lang: 'en', kind: '', fmt: 'srv1' },
    { lang: 'en', kind: 'asr', fmt: 'srv1' },
    { lang: 'en-US', kind: '', fmt: 'srv1' },
    { lang: '', kind: '', fmt: 'srv3' },
    { lang: '', kind: '', fmt: 'srv1' },
    { lang: 'es', kind: 'asr', fmt: 'srv1' },
    { lang: 'hi', kind: 'asr', fmt: 'srv1' },
    { lang: 'pt', kind: 'asr', fmt: 'srv1' },
    { lang: 'fr', kind: 'asr', fmt: 'srv1' },
    { lang: 'de', kind: 'asr', fmt: 'srv1' },
    { lang: 'ja', kind: 'asr', fmt: 'srv1' },
    { lang: 'ko', kind: 'asr', fmt: 'srv1' },
    { lang: 'ru', kind: 'asr', fmt: 'srv1' },
    { lang: 'ar', kind: 'asr', fmt: 'srv1' },
    { lang: 'zh', kind: 'asr', fmt: 'srv1' },
  ];

  for (const { lang, kind, fmt } of attempts) {
    try {
      let url = `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=${fmt}`;
      if (lang) url += `&lang=${lang}`;
      if (kind) url += `&kind=${kind}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!res.ok) { await res.text(); continue; }

      const xml = await res.text();
      if (!xml || xml.length < 50) continue;

      const segments = parseXmlTranscript(xml);
      if (segments && segments.length > 0) {
        console.log(`[youtube-transcript] timedtext success: ${segments.length} segments (lang=${lang}, kind=${kind}, fmt=${fmt})`);
        return { text: segments.map(s => s.text).join(' '), timestamps: segments };
      }
    } catch (e) {
      // continue to next attempt
    }
  }
  return null;
}

// Method 3: YouTube Data API v3 - discover available languages, then download via timedtext
async function fetchWithYouTubeAPI(videoId: string, apiKey: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying YouTube Data API v3...');
  try {
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const captionsRes = await fetch(captionsUrl);

    if (!captionsRes.ok) {
      const errText = await captionsRes.text();
      console.error(`[youtube-transcript] Captions list API error: ${captionsRes.status} ${errText}`);
      return null;
    }

    const captionsData = await captionsRes.json();
    const captions = captionsData.items || [];

    if (captions.length === 0) {
      console.log('[youtube-transcript] No captions found via API');
      return null;
    }

    console.log(`[youtube-transcript] Found ${captions.length} caption tracks:`,
      captions.map((c: any) => `${c.snippet.language} (${c.snippet.trackKind})`));

    // Try each discovered language via timedtext
    for (const caption of captions) {
      const lang = caption.snippet.language;
      const kind = caption.snippet.trackKind === 'ASR' ? 'asr' : '';
      
      for (const fmt of ['srv1', 'srv3']) {
        try {
          let url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=${fmt}`;
          if (kind) url += `&kind=${kind}`;

          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (!res.ok) { await res.text(); continue; }

          const xml = await res.text();
          if (!xml || xml.length < 50) continue;

          const segments = parseXmlTranscript(xml);
          if (segments && segments.length > 0) {
            console.log(`[youtube-transcript] API-guided download success: ${segments.length} segments (lang=${lang})`);
            return { text: segments.map(s => s.text).join(' '), timestamps: segments };
          }
        } catch (e) {
          // continue
        }
      }
    }
  } catch (e) {
    console.error('[youtube-transcript] YouTube API failed:', e);
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

    // Method 1: InnerTube (most reliable, handles all languages)
    result = await fetchWithInnerTube(videoId);

    // Method 2: Timedtext API (tries many languages)
    if (!result) {
      result = await fetchWithTimedText(videoId);
    }

    // Method 3: YouTube Data API v3 (discovers exact languages, then downloads)
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!result && youtubeApiKey) {
      result = await fetchWithYouTubeAPI(videoId, youtubeApiKey);
    }

    if (!result || !result.text) {
      return errorResponse('No captions available for this video. Please ensure the video has captions/subtitles enabled.', 422);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${result.text.length} chars, ${result.timestamps.length} segments`);

    return jsonResponse({ success: true, text: result.text, timestamps: result.timestamps, videoId });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(msg, msg.includes('captions') || msg.includes('subtitle') ? 422 : 500);
  }
});
