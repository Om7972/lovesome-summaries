<<<<<<< HEAD
<<<<<<< HEAD
import { useState, useCallback } from "react";
import { Upload, Youtube, Loader2, Link, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface VideoUploadProps {
  onVideoSubmit: (videoSource: string, type: "youtube" | "upload") => void;
  isProcessing: boolean;
}

export const VideoUpload = ({ onVideoSubmit, isProcessing }: VideoUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [isYoutubeValid, setIsYoutubeValid] = useState(false);
  const { toast } = useToast();

  const validateYoutubeLink = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return youtubeRegex.test(url);
  };

  const handleYoutubeLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setYoutubeLink(value);
    setIsYoutubeValid(validateYoutubeLink(value));
  };

  const handleYoutubeSubmit = () => {
    if (isYoutubeValid) {
      onVideoSubmit(youtubeLink, "youtube");
    } else {
      toast({
        title: "Invalid YouTube Link",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      });
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => 
      file.type.startsWith("video/") || 
      file.name.endsWith(".mp4") || 
      file.name.endsWith(".webm") || 
      file.name.endsWith(".ogg") ||
      file.name.endsWith(".mov") ||
      file.name.endsWith(".avi")
    );

    if (videoFile) {
      // Pass the file directly via blob URL
      onVideoSubmit(URL.createObjectURL(videoFile), "upload");
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid video file (MP4, WebM, OGG, MOV, AVI)",
        variant: "destructive",
      });
    }
  }, [onVideoSubmit, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith("video/") || 
        file.name.endsWith(".mp4") || 
        file.name.endsWith(".webm") || 
        file.name.endsWith(".ogg") ||
        file.name.endsWith(".mov") ||
        file.name.endsWith(".avi"))) {
      onVideoSubmit(URL.createObjectURL(file), "upload");
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid video file (MP4, WebM, OGG, MOV, AVI)",
        variant: "destructive",
      });
=======
import { useState } from "react";
import { Upload, Video, Link } from "lucide-react";
=======
import { useState, useMemo } from "react";
import { Upload, Video, Link as LinkIcon, Loader2, Youtube, AlertTriangle, Globe } from "lucide-react";
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
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
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const VideoUpload = ({ onVideoSelect, onYouTubeSubmit, isProcessing, youtubeBlocked, onClearBlocked }: VideoUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("youtube");

  const videoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

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

<<<<<<< HEAD
  const handleYouTubeSubmit = () => {
    if (youtubeUrl.trim()) {
      onYouTubeSubmit(youtubeUrl.trim());
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
    }
=======
  const handleSwitchToUpload = () => {
    onClearBlocked?.();
    setActiveTab("upload");
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
  };

  return (
<<<<<<< HEAD
    <div className="space-y-8">
      {/* YouTube Link Input */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Youtube className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold">YouTube Video</h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Paste a YouTube link to transcribe and summarize the video content
          </p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeLink}
                onChange={handleYoutubeLinkChange}
                className="pl-10"
                disabled={isProcessing}
                aria-label="YouTube video URL"
              />
            </div>
            <Button 
              onClick={handleYoutubeSubmit}
              disabled={!isYoutubeValid || isProcessing}
              className="shrink-0"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Process Video"
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      {/* Video File Upload */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Upload Video File</h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Upload a video file to transcribe and summarize its content
          </p>
          
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative rounded-xl border-2 border-dashed p-8 transition-all duration-300
              ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-card"}
              ${isProcessing ? "opacity-50 pointer-events-none" : "hover:border-primary/50"}
            `}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              {isProcessing ? (
                <>
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">Processing your video...</p>
                    <p className="text-sm text-muted-foreground">
                      Transcribing and summarizing content
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <div className="rounded-full bg-gradient-primary p-3">
                      <Play className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl -z-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">Drop your video here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse your files
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground items-center">
                    <Upload className="h-4 w-4" />
                    <span>Supports MP4, WebM, OGG files up to 100MB</span>
                  </div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                    aria-label="Upload video file"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
=======
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

        <TabsContent value="youtube">
          <div className="space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => { setYoutubeUrl(e.target.value); onClearBlocked?.(); }}
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

            {/* YouTube Blocked Fallback */}
            <AnimatePresence>
              {youtubeBlocked?.blocked && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">YouTube blocked transcript extraction</p>
                      <p className="text-xs text-muted-foreground">
                        YouTube prevents server-side transcript downloads. You can download the video and upload it directly for transcription.
                      </p>
                    </div>
                  </div>

                  {youtubeBlocked.languages.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Available captions:</span>
                      {youtubeBlocked.languages.map((lang) => (
                        <Badge key={lang} variant="secondary" className="text-xs">
                          {lang.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button onClick={handleSwitchToUpload} variant="outline" size="sm" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    Switch to direct video upload
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* YouTube Preview */}
            <AnimatePresence>
              {videoId && !isProcessing && !youtubeBlocked?.blocked && (
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

            {!isProcessing && !videoId && !youtubeBlocked?.blocked && (
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
                <p className="text-sm text-muted-foreground">MP4, MOV, AVI, MKV, WebM (max 25MB)</p>
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
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
