import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { YoutubeTranscript } from "npm:youtube-transcript@1.2.1";

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
  return segments.length > 0 ? segments : null;
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

    // --- Method 1: youtube-transcript npm package ---
    console.log('[youtube-transcript] Method 1: youtube-transcript package...');
    try {
      // Try multiple language configurations
      const langConfigs = [
        { lang: 'en' },
        { lang: 'en-US' },
        {}, // default/auto
      ];

      for (const config of langConfigs) {
        try {
          const items = await YoutubeTranscript.fetchTranscript(videoId, config);
          if (items && items.length > 0) {
            const fullText = items.map((item: any) => item.text).join(' ');
            const timestamps = items.map((item: any) => ({
              time: formatTime((item.offset || 0) / 1000),
              text: item.text,
            }));
            const elapsed = Date.now() - startTime;
            console.log(`[youtube-transcript] Package success in ${elapsed}ms: ${items.length} segments, lang=${config.lang || 'auto'}`);
            return jsonResponse({ success: true, text: fullText, timestamps, videoId });
          }
        } catch (e: any) {
          console.log(`[youtube-transcript] Package attempt (lang=${config.lang || 'auto'}) failed:`, e?.message || e);
        }
      }
    } catch (e) {
      console.error('[youtube-transcript] Package method failed:', e);
    }

    // --- Method 2: Direct watch page extraction + caption download ---
    console.log('[youtube-transcript] Method 2: Watch page extraction...');
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html',
          'Accept-Encoding': 'identity',
          'Cookie': 'CONSENT=PENDING+987; SOCS=CAESEwgDEgk1MTIyNjM0NDMaAmVuIAEaBgiA_LyaBg',
        }
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        // Extract captionTracks
        const match = html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*var\s/)
          || html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
        
        if (match) {
          try {
            const player = JSON.parse(match[1]);
            const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            
            if (tracks?.length) {
              console.log(`[youtube-transcript] Found ${tracks.length} caption tracks`);
              
              // Try each track
              const en = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
              const ordered = en ? [en, ...tracks.filter((t: any) => t !== en)] : tracks;
              
              for (const track of ordered) {
                if (!track.baseUrl) continue;
                
                // Try downloading with fmt=json3 (JSON format, may bypass XML blocks)
                const jsonUrl = new URL(track.baseUrl);
                jsonUrl.searchParams.set('fmt', 'json3');
                
                try {
                  const captRes = await fetch(jsonUrl.toString(), {
                    headers: { 'Accept-Encoding': 'identity' }
                  });
                  if (captRes.ok) {
                    const jsonText = await captRes.text();
                    if (jsonText.length > 10) {
                      try {
                        const captData = JSON.parse(jsonText);
                        const events = captData.events || [];
                        const segments: Array<{ time: string; text: string }> = [];
                        
                        for (const event of events) {
                          if (event.segs) {
                            const text = event.segs.map((s: any) => s.utf8 || '').join('').trim();
                            if (text && text !== '\n') {
                              segments.push({
                                time: formatTime((event.tStartMs || 0) / 1000),
                                text: decodeHTMLEntities(text),
                              });
                            }
                          }
                        }
                        
                        if (segments.length > 0) {
                          const fullText = segments.map(s => s.text).join(' ');
                          const elapsed = Date.now() - startTime;
                          console.log(`[youtube-transcript] JSON3 success: ${segments.length} segments in ${elapsed}ms (${track.languageCode})`);
                          return jsonResponse({ success: true, text: fullText, timestamps: segments, videoId });
                        }
                      } catch {}
                    }
                  } else { await captRes.text(); }
                } catch {}

                // Try XML format
                try {
                  const xmlUrl = new URL(track.baseUrl);
                  xmlUrl.searchParams.set('fmt', 'srv1');
                  const captRes = await fetch(xmlUrl.toString(), {
                    headers: { 'Accept-Encoding': 'identity' }
                  });
                  if (captRes.ok) {
                    const xml = await captRes.text();
                    if (xml.length > 10) {
                      const segs = parseXmlTranscript(xml);
                      if (segs?.length) {
                        const fullText = segs.map(s => s.text).join(' ');
                        const elapsed = Date.now() - startTime;
                        console.log(`[youtube-transcript] XML success: ${segs.length} segments in ${elapsed}ms`);
                        return jsonResponse({ success: true, text: fullText, timestamps: segs, videoId });
                      }
                    }
                  } else { await captRes.text(); }
                } catch {}
              }
            }
          } catch {}
        }
      } else { await pageRes.text(); }
    } catch (e) {
      console.error('[youtube-transcript] Watch page method failed:', e);
    }

    return errorResponse('No captions available for this video. YouTube may be blocking transcript extraction from servers. Please try a different video or upload the video directly.', 422);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(msg, 500);
  }
});
