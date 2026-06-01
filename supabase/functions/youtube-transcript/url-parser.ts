// Pure URL parsing utilities — kept dependency-free so tests run without
// pulling the npm `youtube-transcript` package.

export function extractVideoId(url: string): string | null {
  const sanitized = url.trim().substring(0, 500);

  if (/^[a-zA-Z0-9_-]{11}$/.test(sanitized)) return sanitized;

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
      const keys = ["embed", "shorts", "v", "live"];
      for (let i = 0; i < segs.length - 1; i++) {
        if (keys.includes(segs[i]) && /^[a-zA-Z0-9_-]{11}$/.test(segs[i + 1])) {
          return segs[i + 1];
        }
      }
    }
  } catch { /* fall through */ }

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