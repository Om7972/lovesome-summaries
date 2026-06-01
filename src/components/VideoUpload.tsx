import { useState, useMemo, useEffect } from "react";
import { Upload, Video, Loader2, Youtube, AlertTriangle, CheckCircle2, XCircle, Circle, ListVideo, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

type ProgressEvent = {
  step: string;
  status: "start" | "success" | "fail";
  info?: Record<string, unknown>;
};

type QualityScore = {
  coverage: number;
  durationMatch: number;
  missingSegments: number;
  segmentCount: number;
  rating: "excellent" | "good" | "fair" | "poor";
};

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onYouTubeSubmit: (url: string) => void;
  isProcessing: boolean;
  youtubeBlocked?: { blocked: boolean; languages: string[]; videoId: string };
  onClearBlocked?: () => void;
}

function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
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
  } catch { /* ignore */ }
  const m = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
            trimmed.match(/(?:embed|shorts|v|live)\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractPlaylistId(url: string): string | null {
  const trimmed = url.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const list = u.searchParams.get("list");
    if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) return list;
  } catch { /* ignore */ }
  const m = trimmed.match(/[?&]list=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

const STEP_LABELS: Record<string, string> = {
  cache: "Checking cached transcript",
  metadata: "Fetching video metadata",
  package: "youtube-transcript package",
  "watch-page": "Watch page extraction",
  innertube: "Innertube player API",
  jina: "Jina Reader proxy",
  playlist: "Loading playlist videos",
  video: "Processing video",
};

function stepLabel(step: string) {
  if (STEP_LABELS[step]) return STEP_LABELS[step];
  // Composite steps like "<videoId>:innertube"
  const parts = step.split(":");
  if (parts.length === 2 && STEP_LABELS[parts[1]]) return STEP_LABELS[parts[1]];
  return step;
}

export const VideoUpload = ({
  onVideoSelect,
  onYouTubeSubmit,
  isProcessing,
  youtubeBlocked,
  onClearBlocked,
}: VideoUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("youtube");
  const [progressSteps, setProgressSteps] = useState<ProgressEvent[]>([]);
  const [quality, setQuality] = useState<QualityScore | null>(null);

  const videoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);
  const playlistId = useMemo(() => extractPlaylistId(youtubeUrl), [youtubeUrl]);

  // progress simulation
  useEffect(() => {
    if (isProcessing) {
      setProgress(0);
      setProgressSteps([]);
      setQuality(null);
      // Start SSE stream alongside the parent's invoke to report live steps.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-transcript`;
      const controller = new AbortController();
      (async () => {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ youtubeUrl, stream: true }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const evt of events) {
              const lines = evt.split("\n");
              const eventLine = lines.find((l) => l.startsWith("event:"));
              const dataLine = lines.find((l) => l.startsWith("data:"));
              if (!eventLine || !dataLine) continue;
              const eventName = eventLine.slice(6).trim();
              try {
                const data = JSON.parse(dataLine.slice(5).trim());
                if (eventName === "progress") setProgressSteps((prev) => [...prev, data]);
                if (eventName === "result" && data?.quality) setQuality(data.quality);
              } catch { /* ignore parse errors */ }
            }
          }
        } catch { /* aborted or network error — silent */ }
      })();

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 800);
      return () => {
        clearInterval(interval);
        controller.abort();
      };
    } else {
      setProgress(100);
    }
    // We deliberately don't depend on youtubeUrl — the request fires when isProcessing flips on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      onVideoSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onVideoSelect(file);
  };

  const handleYouTubeSubmit = () => {
    if (youtubeUrl.trim()) {
      onYouTubeSubmit(youtubeUrl.trim());
    }
  };

  const handleSwitchToUpload = () => {
    onClearBlocked?.();
    setActiveTab("upload");
  };

  return (
    <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="youtube" className="gap-2">
            <Youtube className="h-4 w-4" /> YouTube Link
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" /> Upload Video
          </TabsTrigger>
        </TabsList>

        {/* ---------------- YOUTUBE TAB ---------------- */}
        <TabsContent value="youtube">
          <div className="space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => {
                  setYoutubeUrl(e.target.value);
                  onClearBlocked?.();
                }}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                onClick={handleYouTubeSubmit}
                disabled={!youtubeUrl.trim() || isProcessing}
                className="shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing
                  </>
                ) : (
                  "Summarize"
                )}
              </Button>
            </div>

            {/* Blocked message */}
            <AnimatePresence>
              {youtubeBlocked?.blocked && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
                >
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-semibold text-sm">
                        YouTube blocked transcript extraction
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Try uploading the video directly instead.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSwitchToUpload}
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    Switch to upload
                  </Button>
                  <Button
                    onClick={() => {
                      onClearBlocked?.();
                      if (youtubeUrl.trim()) onYouTubeSubmit(youtubeUrl.trim());
                    }}
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={isProcessing || !youtubeUrl.trim()}
                  >
                    Retry transcript fetch
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview */}
            {videoId && !youtubeBlocked?.blocked && (
              <div className="rounded-xl overflow-hidden border">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="thumbnail"
                  className="w-full"
                />
              </div>
            )}

            {/* Playlist indicator */}
            {playlistId && !videoId && !isProcessing && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                <ListVideo className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Playlist detected</p>
                  <p className="text-xs text-muted-foreground">
                    We'll fetch transcripts for up to 25 videos and return a combined summary.
                  </p>
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-3">
                <Progress value={progress} className="h-2" />
                <p className="text-xs mt-1">{Math.round(progress)}%</p>

                {progressSteps.length > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-3 max-h-48 overflow-y-auto space-y-1.5">
                    {progressSteps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {s.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : s.status === "fail" ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground animate-pulse shrink-0" />
                        )}
                        <span className={s.status === "fail" ? "text-muted-foreground line-through" : ""}>
                          {stepLabel(s.step)}
                        </span>
                        {s.info?.segments && (
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {String(s.info.segments)} segments
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality score */}
            {quality && !isProcessing && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Transcript quality</span>
                  </div>
                  <Badge
                    variant={
                      quality.rating === "excellent" || quality.rating === "good"
                        ? "default"
                        : quality.rating === "fair"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {quality.rating}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">{Math.round(quality.coverage * 100)}%</div>
                    coverage
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{Math.round(quality.durationMatch * 100)}%</div>
                    duration match
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{quality.missingSegments}</div>
                    gaps
                  </div>
                </div>
                {quality.rating === "poor" && (
                  <p className="text-xs text-destructive">
                    Low quality transcript — the summary may be incomplete. Consider uploading the video directly.
                  </p>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------------- UPLOAD TAB ---------------- */}
        <TabsContent value="upload">
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/50 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />

            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>

              <p className="text-lg font-semibold">
                {isDragging ? "Drop your video here" : "Drag & drop your video"}
              </p>

              <p className="text-sm text-muted-foreground">
                MP4, MOV, AVI, WebM
              </p>

              {isProcessing && (
                <div className="w-full max-w-xs">
                  <Progress value={progress} />
                  <p className="text-xs mt-1">
                    {Math.round(progress)}% processing
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};