import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { YoutubeTranscript } from "npm:youtube-transcript@1.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TranscriptSegment = {
  time: string;
  text: string;
};

type CaptionTrackInfo = {
  language: string;
  kind: string;
  name: string | null;
};

type QualityScore = {
  coverage: number;        // 0..1 — fraction of expected duration covered
  durationMatch: number;   // 0..1 — how close transcript span is to video duration
  missingSegments: number; // estimated count of gaps > 30s
  segmentCount: number;
  rating: "excellent" | "good" | "fair" | "poor";
};

type TranscriptPayload = {
  text: string;
  timestamps: TranscriptSegment[];
  source?: string;
  quality?: QualityScore;
  durationSeconds?: number;
  language?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  console.error(`[youtube-transcript] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

function softFailureResponse(
  message: string,
  code: string,
  details: Record<string, unknown> = {},
) {
  console.warn(`[youtube-transcript] ${code}: ${message}`);
  return jsonResponse({ success: false, code, message, ...details }, 200);
}

export function extractVideoId(url: string): string | null {
  const sanitized = url.trim().substring(0, 500);

  // Bare 11-char video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(sanitized)) return sanitized;

  // Try URL parsing first — handles playlists (?v=ID&list=...), mobile (m.youtube.com),
  // music.youtube.com, query param order variations, etc.
  try {
    const withScheme = /^https?:\/\//i.test(sanitized) ? sanitized : `https://${sanitized}`;
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const segs = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /v/ID, /live/ID
      const keys = ["embed", "shorts", "v", "live"];
      for (let i = 0; i < segs.length - 1; i++) {
        if (keys.includes(segs[i]) && /^[a-zA-Z0-9_-]{11}$/.test(segs[i + 1])) {
          return segs[i + 1];
        }
      }
    }
  } catch { /* fall through to regex */ }

  // Regex fallback for malformed URLs
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|v|live)\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = sanitized.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function extractPlaylistId(url: string): string | null {
  const sanitized = url.trim().substring(0, 500);
  try {
    const withScheme = /^https?:\/\//i.test(sanitized) ? sanitized : `https://${sanitized}`;
    const u = new URL(withScheme);
    const list = u.searchParams.get("list");
    if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) return list;
  } catch { /* ignore */ }
  const m = sanitized.match(/[?&]list=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

function parseISO8601Duration(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2] || "0", 10) * 60) + parseInt(m[3] || "0", 10);
}

function timeToSeconds(t: string): number {
  const parts = t.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function computeQualityScore(
  segments: TranscriptSegment[],
  videoDurationSeconds: number,
): QualityScore {
  const segmentCount = segments.length;
  if (segmentCount === 0) {
    return { coverage: 0, durationMatch: 0, missingSegments: 0, segmentCount: 0, rating: "poor" };
  }

  const times = segments.map((s) => timeToSeconds(s.time)).sort((a, b) => a - b);
  const span = times[times.length - 1] - times[0];

  // Count gaps > 30s as missing segments
  let missing = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > 30) missing++;
  }

  let coverage = 1;
  let durationMatch = 1;
  if (videoDurationSeconds > 0) {
    coverage = Math.min(1, span / videoDurationSeconds);
    durationMatch = 1 - Math.min(1, Math.abs(videoDurationSeconds - span) / videoDurationSeconds);
  } else {
    // No duration info: estimate based on segment density
    coverage = Math.min(1, segmentCount / 100);
    durationMatch = 0.75;
  }

  const overall = (coverage * 0.5) + (durationMatch * 0.35) + (Math.max(0, 1 - missing / 20) * 0.15);
  const rating: QualityScore["rating"] =
    overall >= 0.85 ? "excellent" :
    overall >= 0.65 ? "good" :
    overall >= 0.4 ? "fair" : "poor";

  return {
    coverage: Number(coverage.toFixed(2)),
    durationMatch: Number(durationMatch.toFixed(2)),
    missingSegments: missing,
    segmentCount,
    rating,
  };
}

async function fetchVideoMetadata(videoId: string): Promise<{ title: string; durationSeconds: number } | null> {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`,
    );
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return {
      title: item.snippet?.title ?? "",
      durationSeconds: parseISO8601Duration(item.contentDetails?.duration),
    };
  } catch { return null; }
}

async function fetchPlaylistVideoIds(playlistId: string, max = 25): Promise<Array<{ id: string; title: string }>> {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return [];
  const out: Array<{ id: string; title: string }> = [];
  let pageToken = "";
  try {
    while (out.length < max) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("key", apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url.toString());
      if (!res.ok) { await res.text(); break; }
      const data = await res.json();
      for (const item of data.items ?? []) {
        const id = item?.snippet?.resourceId?.videoId;
        if (id) out.push({ id, title: item?.snippet?.title ?? "" });
        if (out.length >= max) break;
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
  } catch (error) {
    console.warn("[youtube-transcript] Playlist fetch failed:", error);
  }
  return out;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/\n/g, " ")
    .trim();
}

function buildTranscriptPayload(timestamps: TranscriptSegment[]) {
  const cleaned = timestamps.filter((segment) => segment.text.trim().length > 0);
  if (cleaned.length === 0) return null;

  return {
    text: cleaned.map((segment) => segment.text).join(" "),
    timestamps: cleaned,
  };
}

function parseXmlTranscript(xml: string): TranscriptSegment[] | null {
  const segments: TranscriptSegment[] = [];
  let match: RegExpExecArray | null;

  const textRegex = /<text\s+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) {
      segments.push({
        time: formatTime(parseFloat(match[1])),
        text: decodeHTMLEntities(text),
      });
    }
  }

  if (segments.length > 0) return segments;

  const paragraphRegex = /<p\s+t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) {
      segments.push({
        time: formatTime(parseInt(match[1], 10) / 1000),
        text: decodeHTMLEntities(text),
      });
    }
  }

  return segments.length > 0 ? segments : null;
}

async function fetchCaptionTrackMetadata(videoId: string): Promise<CaptionTrackInfo[]> {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) {
    console.warn("[youtube-transcript] YOUTUBE_API_KEY is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`,
    );

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[youtube-transcript] Caption metadata lookup failed (${response.status}): ${body.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const tracks = (data.items ?? []).map((item: any) => ({
      language: item?.snippet?.language ?? "unknown",
      kind: item?.snippet?.trackKind ?? "standard",
      name: item?.snippet?.name?.simpleText ?? null,
    }));

    if (tracks.length > 0) {
      console.log(
        `[youtube-transcript] API found ${tracks.length} track(s): ${tracks.map((track) => `${track.language}(${track.kind})`).join(", ")}`,
      );
    }

    return tracks;
  } catch (error) {
    console.warn("[youtube-transcript] Caption metadata lookup crashed:", error);
    return [];
  }
}

function buildLanguageConfigs(captionTracks: CaptionTrackInfo[]) {
  const languages = Array.from(
    new Set(
      ["en", "en-US", ...captionTracks.map((track) => track.language)].filter(Boolean),
    ),
  );

  return [...languages.map((lang) => ({ lang })), {}];
}

async function tryYoutubeTranscriptPackage(videoId: string, captionTracks: CaptionTrackInfo[]) {
  console.log("[youtube-transcript] Method 1: youtube-transcript package...");

  for (const config of buildLanguageConfigs(captionTracks)) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (!items?.length) continue;

      const payload = buildTranscriptPayload(
        items.map((item: any) => ({
          time: formatTime((item.offset || 0) / 1000),
          text: item.text,
        })),
      );

      if (payload) {
        console.log(
          `[youtube-transcript] Package success with ${config.lang || "auto"}: ${payload.timestamps.length} segments`,
        );
        return payload;
      }
    } catch (error: any) {
      console.log(
        `[youtube-transcript] Package attempt failed (${config.lang || "auto"}): ${error?.message || error}`,
      );
    }
  }

  return null;
}

async function tryWatchPageExtraction(videoId: string) {
  console.log("[youtube-transcript] Method 2: watch page extraction...");

  try {
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html",
        "Accept-Encoding": "identity",
        Cookie: "CONSENT=PENDING+987; SOCS=CAESEwgDEgk1MTIyNjM0NDMaAmVuIAEaBgiA_LyaBg",
      },
    });

    if (!pageResponse.ok) {
      await pageResponse.text();
      return null;
    }

    const html = await pageResponse.text();
    const match =
      html.match(/var\s+ytInitialPlayerResponse\s*=\s*({[\s\S]+?})\s*;\s*var\s/) ||
      html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?})\s*;/);

    if (!match) {
      console.log("[youtube-transcript] No player response found in watch page");
      return null;
    }

    const playerData = JSON.parse(match[1]);
    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (!tracks.length) {
      console.log("[youtube-transcript] No caption tracks found in watch page response");
      return null;
    }

    console.log(`[youtube-transcript] Watch page found ${tracks.length} caption track(s)`);

    const englishTrack = tracks.find((track: any) => track.languageCode === "en" || track.languageCode?.startsWith("en"));
    const orderedTracks = englishTrack
      ? [englishTrack, ...tracks.filter((track: any) => track !== englishTrack)]
      : tracks;

    for (const track of orderedTracks) {
      if (!track.baseUrl) continue;

      for (const format of ["json3", "srv1"]) {
        try {
          const captionUrl = new URL(track.baseUrl);
          captionUrl.searchParams.set("fmt", format);

          const captionResponse = await fetch(captionUrl.toString(), {
            headers: { "Accept-Encoding": "identity" },
          });

          if (!captionResponse.ok) {
            await captionResponse.text();
            continue;
          }

          const body = await captionResponse.text();
          if (body.length < 10) continue;

          if (format === "json3") {
            try {
              const json = JSON.parse(body);
              const payload = buildTranscriptPayload(
                (json.events ?? []).flatMap((event: any) => {
                  if (!event?.segs) return [];
                  const text = event.segs.map((segment: any) => segment.utf8 || "").join("").trim();
                  if (!text || text === "\n") return [];

                  return [{
                    time: formatTime((event.tStartMs || 0) / 1000),
                    text: decodeHTMLEntities(text),
                  }];
                }),
              );

              if (payload) {
                console.log(`[youtube-transcript] Watch page JSON3 success: ${payload.timestamps.length} segments`);
                return payload;
              }
            } catch {
              continue;
            }
          }

          const xmlSegments = parseXmlTranscript(body);
          if (xmlSegments?.length) {
            const payload = buildTranscriptPayload(xmlSegments);
            if (payload) {
              console.log(`[youtube-transcript] Watch page XML success: ${payload.timestamps.length} segments`);
              return payload;
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn("[youtube-transcript] Watch page extraction failed:", error);
  }

  return null;
}

async function tryInnertubePlayer(videoId: string) {
  console.log("[youtube-transcript] Method 3: Innertube player API...");

  // Mimic the ANDROID/WEB client – often bypasses cloud-IP blocks on /watch
  const clients = [
    {
      name: "ANDROID",
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "19.09.37",
          androidSdkVersion: 30,
          hl: "en",
          gl: "US",
          userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
        },
      },
      userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    },
    {
      name: "WEB",
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
          hl: "en",
          gl: "US",
        },
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  ];

  for (const client of clients) {
    try {
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            "Accept-Language": "en-US,en;q=0.9",
          },
          body: JSON.stringify({ context: client.context, videoId }),
        },
      );

      if (!res.ok) {
        console.log(`[youtube-transcript] Innertube ${client.name} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (!tracks.length) {
        console.log(`[youtube-transcript] Innertube ${client.name}: no tracks`);
        continue;
      }

      const englishTrack = tracks.find(
        (t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"),
      );
      const ordered = englishTrack
        ? [englishTrack, ...tracks.filter((t: any) => t !== englishTrack)]
        : tracks;

      for (const track of ordered) {
        if (!track.baseUrl) continue;
        for (const format of ["json3", "srv1"]) {
          try {
            const url = new URL(track.baseUrl);
            url.searchParams.set("fmt", format);
            const cr = await fetch(url.toString(), {
              headers: { "Accept-Encoding": "identity", "User-Agent": client.userAgent },
            });
            if (!cr.ok) continue;
            const body = await cr.text();
            if (body.length < 10) continue;

            if (format === "json3") {
              try {
                const json = JSON.parse(body);
                const payload = buildTranscriptPayload(
                  (json.events ?? []).flatMap((event: any) => {
                    if (!event?.segs) return [];
                    const text = event.segs.map((s: any) => s.utf8 || "").join("").trim();
                    if (!text || text === "\n") return [];
                    return [{
                      time: formatTime((event.tStartMs || 0) / 1000),
                      text: decodeHTMLEntities(text),
                    }];
                  }),
                );
                if (payload) {
                  console.log(`[youtube-transcript] Innertube ${client.name} JSON3 success: ${payload.timestamps.length} segments`);
                  return payload;
                }
              } catch { /* fall through */ }
            }

            const xml = parseXmlTranscript(body);
            if (xml?.length) {
              const payload = buildTranscriptPayload(xml);
              if (payload) {
                console.log(`[youtube-transcript] Innertube ${client.name} XML success: ${payload.timestamps.length} segments`);
                return payload;
              }
            }
          } catch { /* try next format */ }
        }
      }
    } catch (error) {
      console.warn(`[youtube-transcript] Innertube ${client.name} crashed:`, error);
    }
  }

  return null;
}

async function tryJinaReader(videoId: string) {
  console.log("[youtube-transcript] Method 4: Jina Reader proxy...");
  try {
    const res = await fetch(`https://r.jina.ai/https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
    });
    if (!res.ok) {
      console.log(`[youtube-transcript] Jina HTTP ${res.status}`);
      return null;
    }
    const body = await res.text();
    if (!body || body.length < 200) return null;

    // Strip Jina markdown header lines so we keep only the meaningful content
    const cleaned = body
      .replace(/^Title:.*$/im, "")
      .replace(/^URL Source:.*$/im, "")
      .replace(/^Markdown Content:.*$/im, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (cleaned.length < 200) return null;

    const text = cleaned.substring(0, 50000);
    console.log(`[youtube-transcript] Jina success: ${text.length} chars`);
    return { text, timestamps: [] as TranscriptSegment[] };
  } catch (error) {
    console.warn("[youtube-transcript] Jina Reader failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const payload = await req.json().catch(() => null);
    const youtubeUrl = payload?.youtubeUrl;
    const userId = payload?.userId;

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return softFailureResponse("YouTube URL is required.", "MISSING_URL");
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return softFailureResponse("Invalid YouTube URL.", "INVALID_URL");
    }

    console.log(`[youtube-transcript] Processing video: ${videoId}`);

    if (userId) {
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: cached } = await supabase
          .from("summaries")
          .select("summary_text, extracted_text")
          .eq("user_id", userId)
          .eq("video_id", videoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.summary_text) {
          console.log("[youtube-transcript] Cache hit");
          return jsonResponse({
            success: true,
            text: cached.extracted_text,
            timestamps: [],
            videoId,
            cached: true,
            cachedSummary: cached.summary_text,
          });
        }
      } catch (error) {
        console.warn("[youtube-transcript] Cache check failed:", error);
      }
    }

    const captionTracks = await fetchCaptionTrackMetadata(videoId);

    const packageTranscript = await tryYoutubeTranscriptPackage(videoId, captionTracks);
    if (packageTranscript) {
      const elapsed = Date.now() - startTime;
      console.log(`[youtube-transcript] Success in ${elapsed}ms via package`);
      return jsonResponse({ success: true, videoId, ...packageTranscript });
    }

    const watchPageTranscript = await tryWatchPageExtraction(videoId);
    if (watchPageTranscript) {
      const elapsed = Date.now() - startTime;
      console.log(`[youtube-transcript] Success in ${elapsed}ms via watch page extraction`);
      return jsonResponse({ success: true, videoId, ...watchPageTranscript });
    }

    const innertubeTranscript = await tryInnertubePlayer(videoId);
    if (innertubeTranscript) {
      const elapsed = Date.now() - startTime;
      console.log(`[youtube-transcript] Success in ${elapsed}ms via Innertube`);
      return jsonResponse({ success: true, videoId, ...innertubeTranscript });
    }

    const jinaTranscript = await tryJinaReader(videoId);
    if (jinaTranscript) {
      const elapsed = Date.now() - startTime;
      console.log(`[youtube-transcript] Success in ${elapsed}ms via Jina Reader`);
      return jsonResponse({ success: true, videoId, source: "jina", ...jinaTranscript });
    }

    const availableLanguages = Array.from(new Set(captionTracks.map((track) => track.language)));

    if (availableLanguages.length > 0) {
      return softFailureResponse(
        `Captions exist for this video (${availableLanguages.join(", ")}), but YouTube blocked transcript download from the server. Please upload the video directly instead.`,
        "CAPTIONS_BLOCKED",
        { videoId, availableLanguages },
      );
    }

    return softFailureResponse(
      "No captions are available for this video. Please choose a video with captions or upload the video directly.",
      "CAPTIONS_UNAVAILABLE",
      { videoId, availableLanguages: [] },
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[youtube-transcript] Failed after ${elapsed}ms:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Soft-fail with 200 so the client never crashes — surface a retry signal instead.
    return softFailureResponse(
      `We hit an unexpected issue extracting this transcript: ${message}. Please retry or upload the video directly.`,
      "SERVICE_FAILED",
      { fallback: true, retryable: true },
    );
  }
});
