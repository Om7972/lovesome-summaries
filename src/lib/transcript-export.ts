type Segment = { time: string; text: string };

function timeToSeconds(t: string): number {
  // Strip any non MM:SS / HH:MM:SS prefix like "[Title] 01:23"
  const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const c = m[3] ? parseInt(m[3], 10) : null;
  if (c !== null) return a * 3600 + b * 60 + c;
  return a * 60 + b;
}

function fmt(seconds: number, sep: string): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`;
}

export function toSRT(segments: Segment[]): string {
  const out: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = timeToSeconds(segments[i].time);
    const next = segments[i + 1] ? timeToSeconds(segments[i + 1].time) : start + 4;
    const end = Math.max(start + 1, next);
    out.push(`${i + 1}`);
    out.push(`${fmt(start, ",")} --> ${fmt(end, ",")}`);
    out.push(segments[i].text.trim());
    out.push("");
  }
  return out.join("\n");
}

export function toVTT(segments: Segment[]): string {
  const out: string[] = ["WEBVTT", ""];
  for (let i = 0; i < segments.length; i++) {
    const start = timeToSeconds(segments[i].time);
    const next = segments[i + 1] ? timeToSeconds(segments[i + 1].time) : start + 4;
    const end = Math.max(start + 1, next);
    out.push(`${fmt(start, ".")} --> ${fmt(end, ".")}`);
    out.push(segments[i].text.trim());
    out.push("");
  }
  return out.join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTranscriptSRT(segments: Segment[], baseName = "transcript") {
  downloadFile(`${baseName}.srt`, toSRT(segments), "application/x-subrip");
}

export function downloadTranscriptVTT(segments: Segment[], baseName = "transcript") {
  downloadFile(`${baseName}.vtt`, toVTT(segments), "text/vtt");
}