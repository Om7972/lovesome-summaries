import { useState, useMemo } from "react";
import { Upload, Video, Link as LinkIcon, Loader2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onYouTubeSubmit: (url: string) => void;
  isProcessing: boolean;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const VideoUpload = ({ onVideoSelect, onYouTubeSubmit, isProcessing }: VideoUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [progress, setProgress] = useState(0);

  const videoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

  // Simulate progress
  useState(() => {
    if (isProcessing) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) { clearInterval(interval); return 90; }
          return prev + Math.random() * 10;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  });

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) onVideoSelect(file);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onVideoSelect(file);
  };
  const handleYouTubeSubmit = () => {
    if (youtubeUrl.trim()) onYouTubeSubmit(youtubeUrl.trim());
  };

  return (
    <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
      <Tabs defaultValue="youtube" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="youtube" className="gap-2">
            <Youtube className="h-4 w-4" /> YouTube Link
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" /> Upload Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="youtube">
          <div className="space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                onClick={handleYouTubeSubmit}
                disabled={!youtubeUrl.trim() || isProcessing}
                className="shrink-0 animated-gradient text-primary-foreground btn-glow"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing</>
                ) : (
                  "Summarize"
                )}
              </Button>
            </div>

            {/* YouTube Preview */}
            <AnimatePresence>
              {videoId && !isProcessing && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl overflow-hidden border border-border/50"
                >
                  <div className="aspect-video">
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing Progress */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {videoId && (
                    <div className="rounded-xl overflow-hidden border border-primary/30">
                      <div className="aspect-video relative">
                        <img
                          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover opacity-50"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                          <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Transcribing & summarizing...</span>
                      <span className="text-xs font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isProcessing && !videoId && (
              <p className="text-xs text-muted-foreground text-center">Paste a YouTube URL to see a preview</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/50 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold mb-2">
                  {isDragging ? "Drop your video here" : "Drag & drop your video"}
                </p>
                <p className="text-sm text-muted-foreground">MP4, MOV, AVI, MKV, WebM</p>
              </div>
              {isProcessing && (
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{Math.round(progress)}% processing...</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
