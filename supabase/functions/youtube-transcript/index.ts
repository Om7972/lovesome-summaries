import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { Innertube } from "npm:youtubei.js@13.2.0";

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

    // Use youtubei.js for robust transcript extraction
    console.log('[youtube-transcript] Initializing youtubei.js...');
    const yt = await Innertube.create({ lang: 'en', location: 'US' });
    
    console.log('[youtube-transcript] Fetching transcript info...');
    const info = await yt.getInfo(videoId);
    const transcriptInfo = await info.getTranscript();
    
    if (!transcriptInfo?.transcript?.content?.body?.initial_segments) {
      console.log('[youtube-transcript] No transcript segments found, trying captions...');
      
      // Fallback: try getting captions directly
      const captions = info.captions;
      if (!captions?.caption_tracks?.length) {
        return errorResponse('No captions available for this video. Please ensure the video has captions/subtitles enabled.', 422);
      }

      // Try downloading the first available caption track
      const track = captions.caption_tracks.find((t: any) => t.language_code === 'en') || captions.caption_tracks[0];
      console.log(`[youtube-transcript] Trying caption track: ${track.language_code}`);
      
      const captionUrl = track.base_url;
      const res = await fetch(captionUrl);
      if (!res.ok) {
        await res.text();
        return errorResponse('Failed to download captions.', 500);
      }
      
      const xml = await res.text();
      const segments: Array<{ time: string; text: string }> = [];
      const re = /<text\s+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const t = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        if (t) segments.push({ time: formatTime(parseFloat(m[1])), text: t });
      }
      
      if (segments.length > 0) {
        const text = segments.map(s => s.text).join(' ');
        const elapsed = Date.now() - startTime;
        console.log(`[youtube-transcript] Caption fallback success: ${segments.length} segments in ${elapsed}ms`);
        return jsonResponse({ success: true, text, timestamps: segments, videoId });
      }
      
      return errorResponse('No captions available for this video.', 422);
    }

    const segments = transcriptInfo.transcript.content.body.initial_segments
      .filter((seg: any) => seg.snippet?.text)
      .map((seg: any) => ({
        time: formatTime((seg.start_ms || 0) / 1000),
        text: seg.snippet.text,
      }));

    if (segments.length === 0) {
      return errorResponse('Transcript was empty.', 422);
    }

    const fullText = segments.map((s: any) => s.text).join(' ');
    const elapsed = Date.now() - startTime;
    console.log(`[youtube-transcript] Success in ${elapsed}ms, ${fullText.length} chars, ${segments.length} segments`);

    return jsonResponse({ success: true, text: fullText, timestamps: segments, videoId });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    
    if (msg.includes('Could not find player') || msg.includes('sign in')) {
      return errorResponse('This video requires age verification or sign-in. Please try a different video.', 422);
    }
    
    return errorResponse(msg.includes('captions') || msg.includes('transcript') 
      ? 'No captions available for this video. Please ensure the video has captions/subtitles enabled.'
      : msg, msg.includes('captions') ? 422 : 500);
  }
});
