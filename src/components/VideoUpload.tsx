import { useState, useMemo, useEffect } from "react";
import { Upload, Video, Loader2, Youtube, AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onYouTubeSubmit: (url: string) => void;
  isProcessing: boolean;
  youtubeBlocked?: { blocked: boolean; languages: string[]; videoId: string };
  onClearBlocked?: () => void;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
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

  const videoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

  // progress simulation
  useEffect(() => {
    if (isProcessing) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
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

            {/* Progress */}
            {isProcessing && (
              <div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs mt-1">{Math.round(progress)}%</p>
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