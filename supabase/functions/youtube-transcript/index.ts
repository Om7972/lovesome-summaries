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

const INNERTUBE_CLIENT = {
  hl: 'en',
  gl: 'US',
  clientName: 'WEB',
  clientVersion: '2.20241201.00.00',
};

async function getTranscript(videoId: string): Promise<{ text: string; timestamps: Array<{ time: string; text: string }> }> {
  // Use innertube get_transcript API which is more reliable from server-side
  // First, get the video page to extract serialized share entity
  const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const html = await pageResp.text();
  console.log(`[youtube-transcript] Page length: ${html.length}`);

  // Method 1: Try to extract transcript from the page data directly
  // Look for engagementPanels with transcript data
  const transcriptPanelMatch = html.match(/"transcriptRenderer":\s*(\{[\s\S]*?\})\s*,\s*"trackingParams"/);
  
  // Method 2: Use innertube get_transcript API
  // We need the serializedShareEntity or params from the page
  const paramsMatch = html.match(/"serializedShareEntity":"([^"]+)"/);
  
  // Method 3: Direct approach - scrape from timedtext with proper cookies
  // Extract consent cookie from page response
  const setCookies = pageResp.headers.get('set-cookie') || '';
  
  // Try to get the player response
  let playerResponse: any = null;
  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|<\/script)/s);
  if (prMatch) {
    try { playerResponse = JSON.parse(prMatch[1]); } catch (e) { /* ignore */ }
  }
  
  if (!playerResponse) {
    // Fallback: innertube player API
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: INNERTUBE_CLIENT },
        videoId,
      }),
    });
    playerResponse = await resp.json();
  }
  
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('No captions available for this video. Please ensure the video has captions/subtitles enabled.');
  }
  
  console.log(`[youtube-transcript] Found ${tracks.length} caption tracks`);
  
  // Prefer English
  const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
  let captionUrl = (enTrack || tracks[0]).baseUrl;
  captionUrl = captionUrl.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  
  // Try fetching with cookies from the page response
  const cookieHeader = setCookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  
  // Try JSON3 format with cookies
  const json3Url = captionUrl + '&fmt=json3';
  console.log(`[youtube-transcript] Fetching JSON3 with cookies...`);
  const json3Resp = await fetch(json3Url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
  });
  const json3Text = await json3Resp.text();
  console.log(`[youtube-transcript] JSON3 response: ${json3Text.length} bytes, status: ${json3Resp.status}`);
  
  if (json3Text.length > 10) {
    try {
      const data = JSON.parse(json3Text);
      const events = data.events || [];
      const segments = events
        .filter((e: any) => e.segs && e.tStartMs !== undefined)
        .map((e: any) => ({
          offset: (e.tStartMs || 0) / 1000,
          text: (e.segs || []).map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
        }))
        .filter((item: any) => item.text.length > 0);
      
      if (segments.length > 0) {
        console.log(`[youtube-transcript] Parsed ${segments.length} segments from JSON3`);
        return {
          text: segments.map((s: any) => s.text).join(' '),
          timestamps: segments.map((s: any) => ({ time: formatTime(s.offset), text: s.text })),
        };
      }
    } catch (e) {
      console.warn('[youtube-transcript] JSON3 parse error:', e);
    }
  }
  
  // Try XML format with cookies
  console.log(`[youtube-transcript] Fetching XML with cookies...`);
  const xmlResp = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
  });
  const xmlText = await xmlResp.text();
  console.log(`[youtube-transcript] XML response: ${xmlText.length} bytes, status: ${xmlResp.status}`);
  
  if (xmlText.length > 10) {
    const textMatches = [...xmlText.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)];
    if (textMatches.length > 0) {
      const transcriptData = textMatches.map(match => ({
        offset: parseFloat(match[1]),
        text: decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '')),
      })).filter(item => item.text.length > 0);
      
      return {
        text: transcriptData.map(item => item.text).join(' '),
        timestamps: transcriptData.map(item => ({ time: formatTime(item.offset), text: item.text })),
      };
    }
  }

  // Method 4: Extract transcript from ytInitialData engagement panels
  const initialDataMatch = html.match(/ytInitialData\s*=\s*(\{.+?\})\s*;\s*(?:window|<\/script)/s);
  if (initialDataMatch) {
    try {
      const initialData = JSON.parse(initialDataMatch[1]);
      const panels = initialData?.engagementPanels || [];
      for (const panel of panels) {
        const content = panel?.engagementPanelSectionListRenderer?.content?.continuationItemRenderer;
        if (content) {
          const token = content?.continuationEndpoint?.getTranscriptEndpoint?.params;
          if (token) {
            console.log(`[youtube-transcript] Found transcript continuation token, fetching...`);
            const transcriptResp = await fetch('https://www.youtube.com/youtubei/v1/get_transcript', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
              },
              body: JSON.stringify({
                context: { client: INNERTUBE_CLIENT },
                params: token,
              }),
            });
            const transcriptData = await transcriptResp.json();
            console.log(`[youtube-transcript] get_transcript keys: ${JSON.stringify(Object.keys(transcriptData))}`);
            
            // Try multiple response structure paths
            let cueGroups: any[] | null = null;
            
            // Path 1: actions -> updateEngagementPanelAction
            const body1 = transcriptData?.actions?.[0]?.updateEngagementPanelAction?.content
              ?.transcriptRenderer?.body?.transcriptBodyRenderer;
            if (body1?.cueGroups) cueGroups = body1.cueGroups;
            
            // Path 2: actions -> appendContinuationItemsAction
            if (!cueGroups) {
              const body2 = transcriptData?.actions?.[0]?.appendContinuationItemsAction?.continuationItems;
              if (body2) {
                console.log(`[youtube-transcript] Found appendContinuationItemsAction`);
                for (const item of body2) {
                  const renderer = item?.transcriptRenderer?.body?.transcriptBodyRenderer;
                  if (renderer?.cueGroups) { cueGroups = renderer.cueGroups; break; }
                }
              }
            }
            
            // Path 3: Direct transcript search renderer
            if (!cueGroups) {
              const body3 = transcriptData?.actions?.[0]?.updateEngagementPanelAction?.content
                ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
              if (body3) {
                console.log(`[youtube-transcript] Found search panel segments: ${body3.length}`);
                const segments = body3.map((s: any) => {
                  const seg = s.transcriptSegmentRenderer;
                  if (!seg) return null;
                  return {
                    offset: parseInt(seg.startMs || '0') / 1000,
                    text: seg.snippet?.runs?.map((r: any) => r.text).join('') || seg.snippet?.simpleText || '',
                  };
                }).filter((s: any) => s && s.text.length > 0);
                
                if (segments.length > 0) {
                  console.log(`[youtube-transcript] Parsed ${segments.length} segments from search panel`);
                  return {
                    text: segments.map((s: any) => s.text).join(' '),
                    timestamps: segments.map((s: any) => ({ time: formatTime(s.offset), text: s.text })),
                  };
                }
              }
            }
            
            if (!cueGroups) {
              // Log the full structure for debugging
              console.log(`[youtube-transcript] get_transcript response sample: ${JSON.stringify(transcriptData).substring(0, 500)}`);
            }
            
            if (body?.cueGroups) {
              const segments = body.cueGroups.map((group: any) => {
                const cue = group.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer;
                if (!cue) return null;
                return {
                  offset: parseInt(cue.startOffsetMs || '0') / 1000,
                  text: cue.cue?.simpleText || cue.cue?.runs?.map((r: any) => r.text).join('') || '',
                };
              }).filter((s: any) => s && s.text.length > 0);
              
              if (segments.length > 0) {
                console.log(`[youtube-transcript] Parsed ${segments.length} segments from get_transcript`);
                return {
                  text: segments.map((s: any) => s.text).join(' '),
                  timestamps: segments.map((s: any) => ({ time: formatTime(s.offset), text: s.text })),
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[youtube-transcript] ytInitialData parse error:', e);
    }
  }
  
  throw new Error('Could not retrieve captions for this video. YouTube may be blocking server-side requests. Try a different video or check if captions are available.');
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
