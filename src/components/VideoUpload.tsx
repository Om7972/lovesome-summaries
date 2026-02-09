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
      file.type.startsWith("video/") && 
      (file.type.includes("mp4") || file.type.includes("webm") || file.type.includes("ogg"))
    );

    if (videoFile) {
      // For now, we'll just simulate processing
      onVideoSubmit(URL.createObjectURL(videoFile), "upload");
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid video file (MP4, WebM, OGG)",
        variant: "destructive",
      });
    }
  }, [onVideoSubmit, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/") && 
        (file.type.includes("mp4") || file.type.includes("webm") || file.type.includes("ogg"))) {
      onVideoSubmit(URL.createObjectURL(file), "upload");
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid video file (MP4, WebM, OGG)",
        variant: "destructive",
      });
    }
  };

  return (
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