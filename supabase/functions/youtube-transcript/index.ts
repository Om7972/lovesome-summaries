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

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

// Decode HTML entities in transcript text
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

// Method 1: YouTube Data API v3 - get captions list and download
async function fetchWithYouTubeAPI(videoId: string, apiKey: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying YouTube Data API v3...');

  // Step 1: List available captions
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

  // Log available captions
  console.log(`[youtube-transcript] Found ${captions.length} caption tracks:`, captions.map((c: any) => `${c.snippet.language} (${c.snippet.trackKind})`));

  // Note: Downloading captions via Data API requires OAuth, so we use this info
  // to confirm captions exist, then fall back to the timedtext endpoint
  return null;
}

// Method 2: YouTube timedtext API (public endpoint)
async function fetchWithTimedText(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying timedtext API...');

  const languages = ['en', 'en-US', 'en-GB', ''];
  
  for (const lang of languages) {
    const langParam = lang ? `&lang=${lang}` : '';
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}${langParam}&fmt=srv3`;
    
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (!res.ok) {
        await res.text();
        continue;
      }

      const xml = await res.text();
      if (!xml || xml.length < 50) continue;

      const segments: Array<{ time: string; text: string; startMs: number }> = [];
      const regex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>(.*?)<\/p>/gs;
      let match;

      while ((match = regex.exec(xml)) !== null) {
        const startMs = parseInt(match[1]);
        const rawText = match[3].replace(/<[^>]+>/g, '').trim();
        if (rawText) {
          segments.push({
            time: formatTime(startMs / 1000),
            text: decodeHTMLEntities(rawText),
            startMs,
          });
        }
      }

      // Try srv1 format if srv3 didn't parse
      if (segments.length === 0) {
        const srv1Regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
        while ((match = srv1Regex.exec(xml)) !== null) {
          const startSec = parseFloat(match[1]);
          const rawText = match[3].replace(/<[^>]+>/g, '').trim();
          if (rawText) {
            segments.push({
              time: formatTime(startSec),
              text: decodeHTMLEntities(rawText),
              startMs: startSec * 1000,
            });
          }
        }
      }

      if (segments.length > 0) {
        console.log(`[youtube-transcript] timedtext success: ${segments.length} segments (lang: ${lang || 'auto'})`);
        return {
          text: segments.map(s => s.text).join(' '),
          timestamps: segments.map(s => ({ time: s.time, text: s.text })),
        };
      }
    } catch (e) {
      console.warn(`[youtube-transcript] timedtext failed for lang=${lang}:`, e);
    }
  }

  // Also try the srv1 format endpoint
  try {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    if (res.ok) {
      const xml = await res.text();
      const segments: Array<{ time: string; text: string }> = [];
      const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const rawText = match[3].replace(/<[^>]+>/g, '').trim();
        if (rawText) {
          segments.push({
            time: formatTime(parseFloat(match[1])),
            text: decodeHTMLEntities(rawText),
          });
        }
      }
      if (segments.length > 0) {
        console.log(`[youtube-transcript] srv1 success: ${segments.length} segments`);
        return { text: segments.map(s => s.text).join(' '), timestamps: segments };
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.warn('[youtube-transcript] srv1 fallback failed:', e);
  }

  return null;
}

// Method 3: InnerTube API (YouTube's internal API)
async function fetchWithInnerTube(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> } | null> {
  console.log('[youtube-transcript] Trying InnerTube API...');

  try {
    // First get the player response to find caption tracks
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
          },
        },
        videoId,
      }),
    });

    if (!playerRes.ok) {
      await playerRes.text();
      return null;
    }

    const playerData = await playerRes.json();
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.log('[youtube-transcript] No caption tracks in InnerTube response');
      return null;
    }

    // Prefer English tracks
    const englishTrack = captionTracks.find((t: any) =>
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    ) || captionTracks[0];

    const trackUrl = englishTrack.baseUrl;
    if (!trackUrl) return null;

    console.log(`[youtube-transcript] Downloading track: ${englishTrack.languageCode}`);

    const trackRes = await fetch(trackUrl);
    if (!trackRes.ok) {
      await trackRes.text();
      return null;
    }

    const xml = await trackRes.text();
    const segments: Array<{ time: string; text: string }> = [];
    const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const rawText = match[3].replace(/<[^>]+>/g, '').trim();
      if (rawText) {
        segments.push({
          time: formatTime(parseFloat(match[1])),
          text: decodeHTMLEntities(rawText),
        });
      }
    }

    if (segments.length > 0) {
      console.log(`[youtube-transcript] InnerTube success: ${segments.length} segments`);
      return { text: segments.map(s => s.text).join(' '), timestamps: segments };
    }
  } catch (e) {
    console.error('[youtube-transcript] InnerTube failed:', e);
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

    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

    // Try multiple methods in order of reliability
    let result: { text: string; timestamps: Array<{ time: string; text: string }> } | null = null;

    // Method 1: InnerTube API (most reliable, no API key needed)
    result = await fetchWithInnerTube(videoId);

    // Method 2: Timedtext API
    if (!result) {
      result = await fetchWithTimedText(videoId);
    }

    // Method 3: YouTube Data API v3 (to verify captions exist)
    if (!result && youtubeApiKey) {
      await fetchWithYouTubeAPI(videoId, youtubeApiKey);
      // If API confirms captions exist but we couldn't download them,
      // try timedtext one more time with auto-generated captions
      try {
        const autoUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv1`;
        const autoRes = await fetch(autoUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (autoRes.ok) {
          const xml = await autoRes.text();
          const segments: Array<{ time: string; text: string }> = [];
          const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
          let match;
          while ((match = regex.exec(xml)) !== null) {
            const rawText = match[3].replace(/<[^>]+>/g, '').trim();
            if (rawText) {
              segments.push({
                time: formatTime(parseFloat(match[1])),
                text: decodeHTMLEntities(rawText),
              });
            }
          }
          if (segments.length > 0) {
            console.log(`[youtube-transcript] ASR fallback success: ${segments.length} segments`);
            result = { text: segments.map(s => s.text).join(' '), timestamps: segments };
          }
        } else {
          await autoRes.text();
        }
      } catch (e) {
        console.warn('[youtube-transcript] ASR fallback failed:', e);
      }
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
    const status = msg.includes('captions') || msg.includes('subtitle') ? 422 : 500;
    return errorResponse(msg, status);
  }
});
